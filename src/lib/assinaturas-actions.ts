"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  criarEnvelope,
  atualizarAssinanteTramitaSign,
  atualizarEnvelopeTramitaSign,
  getEnvelopeCriadoPor,
  getEnvelopeById,
  getEnvelopeParaEnvio,
  cancelarEnvelope,
  excluirEnvelope,
  atualizarEmailAssinante,
  type DocumentoInput,
  type AssinanteInput,
} from "./assinaturas-db";
import { getClientFull } from "./clients-db";
import { getModeloById } from "./modelos-db";
import { getEscritorioConfig } from "./escritorio-db";
import { getAdvogadosParaDocumento } from "./colaboradores-db";
import { buildModeloVars, replaceVars } from "./modelo-vars";
import {
  blocksToHtml,
  textToHtml,
  substituteVariablesInBlocks,
} from "./modelo-blocks";
import { renderModeloParaPdf } from "./modelo-pdf-render";
import { enviarEmailEnvelopeEnviado } from "./email";
import { revalidatePath } from "next/cache";
import {
  tramitaSignAtivo,
  tramitaCriarCliente,
  tramitaObterUserId,
  tramitaUploadArquivo,
  tramitaCriarEnvelopeAssinatura,
  tramitaAtualizarSignatarios,
  tramitaEnviarEnvelopeAssinatura,
  type TramitaSignerInput,
} from "./tramitasign";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function salvarEnvelopeAction(
  formData: FormData
): Promise<{ id: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "criar"))
    throw new Error("Sem permissão.");

  const nome = formData.get("nome") as string;
  const prazo = (formData.get("prazo") as string) || null;
  const enviar = formData.get("enviar") === "1";
  const notifAssinantes = formData.get("notif_assinantes") === "1";
  const notifCriador = formData.get("notif_criador") === "1";
  const notifEscritorio = formData.get("notif_escritorio") === "1";
  const clienteId = (formData.get("cliente_id") as string) || "";

  if (!nome?.trim()) throw new Error("Informe o nome do envelope.");
  if (!clienteId || !UUID_RE.test(clienteId))
    throw new Error("Selecione o cliente do envelope.");

  const assinantesJson = formData.get("assinantes") as string;
  const modelosJson = formData.get("modelos") as string;

  const assinantes = JSON.parse(assinantesJson || "[]") as AssinanteInput[];
  const modelosSelecionados = JSON.parse(modelosJson || "[]") as Array<{
    modeloId: string;
    ordem: number;
  }>;

  if (modelosSelecionados.length === 0)
    throw new Error("Selecione ao menos um modelo de documento.");

  const client = await getClientFull(clienteId);
  if (!client) throw new Error("Cliente não encontrado.");
  const escritorioConfig = await getEscritorioConfig();
  // Sem timeZone explícito, o servidor (UTC) data o documento um dia à
  // frente pra gerações após as 21h no horário de Brasília — mesmo bug já
  // corrigido em gerar-modelo/route.ts e clientes/[id]/gerar-documento/route.ts,
  // só faltava aqui (documento enviado a assinatura eletrônica).
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const advogados = await getAdvogadosParaDocumento().catch(() => []);
  const vars = buildModeloVars(client, escritorioConfig, date, advogados);

  // A ordem de seleção no wizard já é a ordem de envio — só respeitamos o
  // "ordem" enviado por cada item, sem reordenar aqui. O HTML aqui é só pra
  // pré-visualização na nossa própria tela (aba "Documentos" do envelope) —
  // o que vai pro TramitaSign é um PDF de verdade, gerado à parte em
  // enviarEnvelopeParaTramitaSign.
  const documentos: DocumentoInput[] = [];
  for (const m of modelosSelecionados) {
    const modelo = await getModeloById(m.modeloId);
    if (!modelo) continue;

    let html: string;
    if (modelo.conteudo_blocks) {
      const blocks = substituteVariablesInBlocks(modelo.conteudo_blocks, vars);
      html = blocksToHtml(blocks);
    } else {
      html = textToHtml(replaceVars(modelo.conteudo, vars));
    }

    documentos.push({
      modeloId: m.modeloId,
      nome: modelo.titulo,
      htmlContent: html,
      ordem: m.ordem,
    });
  }

  if (documentos.length === 0)
    throw new Error("Nenhum dos modelos selecionados foi encontrado.");

  const { id, assinantes: assinantesCriados } = await criarEnvelope({
    nome,
    prazo,
    status: enviar ? "aguardando" : "rascunho",
    notifAssinantes,
    notifCriador,
    notifEscritorio,
    criadoPor: session.login,
    clienteId,
    assinantes,
    documentos,
  });

  if (enviar && assinantesCriados.length > 0) {
    processarEnvioEnvelope({
      envelopeId: id,
      envelopeNome: nome,
      clienteNome: client.name,
      notifCriador,
      notifEscritorio,
      criadorEmail: session.login,
      escritorioEmail: escritorioConfig.email,
    }).catch((e) =>
      console.error("[assinaturas] processarEnvioEnvelope falhou:", e)
    );
  }

  revalidatePath("/dashboard/assinaturas");
  return { id };
}

/**
 * Faz o envio (ou reenvio) de um envelope inteiro ao TramitaSign, do zero:
 * renderiza cada modelo em PDF de verdade, sobe pro TramitaSign, cria o
 * envelope remoto, cadastra os assinantes e manda pra assinatura.
 *
 * A API real do TramitaSign modela isso como UM envelope remoto com vários
 * assinantes/documentos dentro — não um "documento" isolado por pessoa,
 * como a implementação anterior (removida) assumia. Por isso essa função
 * trabalha no envelope inteiro, não num assinante isolado: um reenvio
 * refaz o processo completo e atualiza o link de todo mundo que ainda não
 * assinou.
 */
export async function enviarEnvelopeParaTramitaSign(
  envelopeId: string
): Promise<{ error?: string }> {
  const env = await getEnvelopeParaEnvio(envelopeId);
  if (!env) return { error: "Envelope não encontrado." };

  const assinantesParaEnviar = env.assinantes.filter(
    (a) => a.tipo !== "eu_mesmo" && a.status !== "assinado"
  );
  if (assinantesParaEnviar.length === 0) return {};

  const gravarErroEmTodos = async (erro: string) => {
    for (const a of assinantesParaEnviar) {
      await atualizarAssinanteTramitaSign(a.id, {
        signerId: null,
        link: null,
        erro,
      });
    }
  };

  const client = await getClientFull(env.clienteId);
  if (!client) {
    const erro = "Cliente do envelope não encontrado.";
    await gravarErroEmTodos(erro);
    return { error: erro };
  }

  const escritorioConfig = await getEscritorioConfig();
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const advogados = await getAdvogadosParaDocumento().catch(() => []);
  const vars = buildModeloVars(client, escritorioConfig, date, advogados);

  // 1. Usuário do escritório dono do envelope (obrigatório na criação — a
  //    chave de API não é uma pessoa). Confere isso primeiro, antes de
  //    gastar tempo gerando/subindo PDF: se a API key/URL estiverem
  //    erradas, é aqui que dá pra saber mais rápido e mais claro.
  const userIdResultado = await tramitaObterUserId();
  const userId = userIdResultado.userId;
  if (!userId) {
    const erro = `Não foi possível obter o usuário do TramitaSign${userIdResultado.erro ? ` (${userIdResultado.erro})` : ""}.`;
    await gravarErroEmTodos(erro);
    return { error: erro };
  }

  // 2. Renderiza cada documento do envelope como PDF de verdade e sobe pro
  //    TramitaSign (a API deles só aceita arquivo, não HTML).
  const uploadIds: number[] = [];
  for (const doc of env.documentos) {
    if (!doc.modeloId) continue;
    const modelo = await getModeloById(doc.modeloId);
    if (!modelo) continue;

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderModeloParaPdf({
        modelo,
        client,
        escritorioConfig,
        vars,
        date,
      });
    } catch (e) {
      console.error("[assinaturas] renderModeloParaPdf falhou:", e);
      const erro = `Falha ao gerar o PDF de "${doc.nome}".`;
      await gravarErroEmTodos(erro);
      return { error: erro };
    }

    const upload = await tramitaUploadArquivo(pdfBuffer, `${doc.nome}.pdf`);
    if (!upload.id) {
      const erro = `Falha ao enviar o PDF de "${doc.nome}" para o TramitaSign${upload.erro ? ` (${upload.erro})` : ""}.`;
      await gravarErroEmTodos(erro);
      return { error: erro };
    }
    uploadIds.push(upload.id);
  }
  if (uploadIds.length === 0) {
    const erro = "Nenhum documento válido para enviar.";
    await gravarErroEmTodos(erro);
    return { error: erro };
  }

  // 3. Cria o envelope remoto (nasce em rascunho) já com os documentos.
  const criado = await tramitaCriarEnvelopeAssinatura({
    userId,
    nome: env.nome,
    uploadIds,
  });
  if (!criado?.id) {
    const erro = "Falha ao criar o envelope no TramitaSign.";
    await gravarErroEmTodos(erro);
    return { error: erro };
  }
  await atualizarEnvelopeTramitaSign(envelopeId, criado.id);

  // 4. Cria um cliente (customer) no TramitaSign pra cada assinante e monta
  //    a lista de signers do envelope.
  const signers: TramitaSignerInput[] = [];
  const assinanteIdPorEmail = new Map<string, string>();
  for (const a of assinantesParaEnviar) {
    const cliente = await tramitaCriarCliente({
      nome: a.nome,
      email: a.email || null,
      telefone: null,
      cpf: null,
    });
    if (!cliente?.id) {
      await atualizarAssinanteTramitaSign(a.id, {
        signerId: null,
        link: null,
        erro: "Falha ao criar o cliente no TramitaSign.",
      });
      continue;
    }
    signers.push({
      signerType: "customer",
      customerId: Number(cliente.id),
      signatureType:
        a.papel === "testemunha" || a.papel === "avalista"
          ? a.papel
          : "assinante",
      selfieRequired: a.valSelfie,
      documentPhotoRequired: a.valDocumento,
    });
    if (a.email) assinanteIdPorEmail.set(a.email.toLowerCase(), a.id);
  }
  if (signers.length === 0) {
    return { error: "Nenhum assinante pôde ser cadastrado no TramitaSign." };
  }

  const okSigners = await tramitaAtualizarSignatarios(criado.id, signers);
  if (!okSigners) {
    const erro = "Falha ao definir os assinantes no TramitaSign.";
    for (const assinanteId of assinanteIdPorEmail.values()) {
      await atualizarAssinanteTramitaSign(assinanteId, {
        signerId: null,
        link: null,
        erro,
      });
    }
    return { error: erro };
  }

  // 5. Envia de verdade — a resposta traz o link de assinatura de cada
  //    assinante.
  const enviado = await tramitaEnviarEnvelopeAssinatura(criado.id);
  if (!enviado) {
    const erro = "Falha ao enviar o envelope para assinatura no TramitaSign.";
    for (const assinanteId of assinanteIdPorEmail.values()) {
      await atualizarAssinanteTramitaSign(assinanteId, {
        signerId: null,
        link: null,
        erro,
      });
    }
    return { error: erro };
  }

  // 6. Casa cada signer devolvido com o assinante nosso (por e-mail) e
  //    grava o link de assinatura.
  let algumSemLink = false;
  for (const s of enviado.signers) {
    const assinanteId = s.email
      ? assinanteIdPorEmail.get(s.email.toLowerCase())
      : undefined;
    if (!assinanteId) continue;
    if (!s.signatureLink) algumSemLink = true;
    await atualizarAssinanteTramitaSign(assinanteId, {
      signerId: s.id,
      link: s.signatureLink,
      erro: s.signatureLink
        ? null
        : "Envelope enviado, mas o TramitaSign não retornou o link de assinatura deste assinante.",
    });
  }

  return algumSemLink
    ? { error: "Envio parcial — confira o assinante sem link." }
    : {};
}

async function processarEnvioEnvelope(params: {
  envelopeId: string;
  envelopeNome: string;
  clienteNome: string;
  notifCriador: boolean;
  notifEscritorio: boolean;
  criadorEmail: string;
  escritorioEmail: string | null;
}) {
  const {
    envelopeId,
    envelopeNome,
    clienteNome,
    notifCriador,
    notifEscritorio,
    criadorEmail,
    escritorioEmail,
  } = params;

  const ativo = tramitaSignAtivo();
  if (ativo) {
    const r = await enviarEnvelopeParaTramitaSign(envelopeId);
    if (r.error)
      console.error("[assinaturas] envio ao TramitaSign falhou:", r.error);
  }

  if (!notifCriador && !notifEscritorio) return;

  const envelope = await getEnvelopeById(envelopeId);
  const resultados = (envelope?.assinantes ?? [])
    .filter((a) => a.tipo !== "eu_mesmo")
    .map((a) => ({ nome: a.nome, email: a.email, link: a.tramitasignLink }));

  const envelopeUrl = `https://lideradv.vercel.app/dashboard/assinaturas/${envelopeId}`;
  const destinatarios = [
    notifCriador ? criadorEmail : null,
    notifEscritorio ? escritorioEmail : null,
  ].filter((v, i, arr): v is string => v != null && arr.indexOf(v) === i);

  for (const para of destinatarios) {
    await enviarEmailEnvelopeEnviado({
      para,
      envelopeNome,
      clienteNome,
      envelopeUrl,
      assinantes: resultados,
      tramitaSignAtivo: ativo,
    }).catch((e) => console.error("[email] envelope enviado falhou:", e));
  }
}

// Mesma regra de acesso já usada na página de detalhe: quem não é
// Administrador(a)/Sócio(a) só mexe em envelope que ele mesmo criou.
async function podeEditarEnvelope(
  session: { login: string; categoria: string },
  envelopeId: string
): Promise<boolean> {
  const criadoPor = await getEnvelopeCriadoPor(envelopeId);
  if (!criadoPor) return false;
  if (
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)"
  )
    return true;
  return criadoPor === session.login;
}

export async function cancelarEnvelopeAction(
  envelopeId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(envelopeId)) return { error: "ID inválido." };
  if (!(await podeEditarEnvelope(session, envelopeId)))
    return { error: "Sem permissão." };

  await cancelarEnvelope(envelopeId);
  revalidatePath("/dashboard/assinaturas");
  revalidatePath(`/dashboard/assinaturas/${envelopeId}`);
  return {};
}

export async function excluirEnvelopeAction(
  envelopeId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "excluir"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(envelopeId)) return { error: "ID inválido." };
  if (!(await podeEditarEnvelope(session, envelopeId)))
    return { error: "Sem permissão." };

  await excluirEnvelope(envelopeId);
  revalidatePath("/dashboard/assinaturas");
  return {};
}

/**
 * Reenvia o envelope inteiro ao TramitaSign (não só o assinante clicado —
 * a API real deles trabalha no envelope como um todo). Disparado a partir
 * de qualquer assinante pendente sem link na tela de detalhe.
 */
export async function reenviarAssinaturaAction(
  envelopeId: string,
  assinanteId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(envelopeId) || !UUID_RE.test(assinanteId))
    return { error: "ID inválido." };
  if (!(await podeEditarEnvelope(session, envelopeId)))
    return { error: "Sem permissão." };
  if (!tramitaSignAtivo())
    return { error: "Integração com TramitaSign não está ativa." };

  const r = await enviarEnvelopeParaTramitaSign(envelopeId);
  revalidatePath(`/dashboard/assinaturas/${envelopeId}`);
  return r;
}

export async function atualizarEmailAssinanteAction(
  envelopeId: string,
  assinanteId: string,
  email: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(envelopeId) || !UUID_RE.test(assinanteId))
    return { error: "ID inválido." };
  if (!(await podeEditarEnvelope(session, envelopeId)))
    return { error: "Sem permissão." };

  const trimmed = email.trim();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return { error: "E-mail inválido." };

  const result = await atualizarEmailAssinante(assinanteId, trimmed);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/dashboard/assinaturas/${envelopeId}`);
  return {};
}
