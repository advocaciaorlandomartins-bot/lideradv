"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  criarEnvelope,
  atualizarAssinanteTramitaSign,
  getEnvelopeCriadoPor,
  cancelarEnvelope,
  excluirEnvelope,
  atualizarEmailAssinante,
  getAssinanteParaReenvio,
  type DocumentoInput,
  type AssinanteInput,
  type AssinanteCriado,
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
  escapeHtml,
} from "./modelo-blocks";
import { enviarEmailEnvelopeEnviado } from "./email";
import { revalidatePath } from "next/cache";
import {
  tramitaSignAtivo,
  tramitaCriarCliente,
  tramitaEnviarDocumento,
  tramitaObterUserId,
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
  // "ordem" enviado por cada item, sem reordenar aqui.
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
    const documentoHtmlCombinado = documentos
      .sort((a, b) => a.ordem - b.ordem)
      .map(
        (d) =>
          `<h2>${escapeHtml(d.nome)}</h2>\n${d.htmlContent}\n<div style="margin:24px 0"><hr></div>`
      )
      .join("\n");

    processarEnvioEnvelope({
      envelopeId: id,
      envelopeNome: nome,
      clienteNome: client.name,
      assinantesCriados,
      documentoHtml: documentoHtmlCombinado,
      notifAssinantes,
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

async function processarEnvioEnvelope(params: {
  envelopeId: string;
  envelopeNome: string;
  clienteNome: string;
  assinantesCriados: AssinanteCriado[];
  documentoHtml: string;
  notifAssinantes: boolean;
  notifCriador: boolean;
  notifEscritorio: boolean;
  criadorEmail: string;
  escritorioEmail: string | null;
}) {
  const {
    envelopeId,
    envelopeNome,
    clienteNome,
    assinantesCriados,
    documentoHtml,
    notifAssinantes,
    notifCriador,
    notifEscritorio,
    criadorEmail,
    escritorioEmail,
  } = params;

  const ativo = tramitaSignAtivo();
  const resultados: { nome: string; email: string; link: string | null }[] = [];

  if (ativo) {
    try {
      const userId = await tramitaObterUserId();

      for (const a of assinantesCriados) {
        if (a.tipo === "eu_mesmo") continue;

        let erro: string | null = null;
        if (!userId) {
          erro =
            "Não foi possível obter o usuário do TramitaSign (API key/URL configuradas mas a resposta não trouxe um id válido).";
        }

        const cliente = userId
          ? await tramitaCriarCliente({
              nome: a.nome,
              email: a.email || null,
              telefone: null,
              cpf: null,
            })
          : null;
        if (userId && !cliente?.id) {
          erro = "Falha ao criar o cliente no TramitaSign.";
        }

        let link: string | null = null;
        let documentoId: string | null = null;
        if (cliente?.id && userId) {
          const doc = await tramitaEnviarDocumento({
            clienteId: cliente.id,
            userId,
            titulo: envelopeNome,
            htmlContent: documentoHtml,
            // Só pede ao TramitaSign pra notificar automaticamente
            // (email/WhatsApp) se "Notificar assinantes" estiver marcado —
            // o link continua sendo gerado e salvo de qualquer forma, pra
            // poder ser copiado manualmente na tela do envelope.
            email: notifAssinantes ? a.email || null : null,
            telefone: null,
            requireSelfie: a.valSelfie,
            requireDocument: a.valDocumento,
          });
          link = doc?.link ?? null;
          documentoId = doc?.id ?? null;
          if (!link)
            erro =
              "Falha ao enviar o documento para assinatura no TramitaSign.";
          else erro = null;
        }

        await atualizarAssinanteTramitaSign(a.id, {
          documentoId,
          link,
          erro,
        });
        resultados.push({ nome: a.nome, email: a.email, link });
      }
    } catch (e) {
      console.error("[TramitaSign] processarEnvioEnvelope error:", e);
    }
  } else {
    for (const a of assinantesCriados) {
      if (a.tipo === "eu_mesmo") continue;
      resultados.push({ nome: a.nome, email: a.email, link: null });
    }
  }

  if (!notifCriador && !notifEscritorio) return;

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

  const a = await getAssinanteParaReenvio(assinanteId);
  if (!a || a.envelopeId !== envelopeId)
    return { error: "Assinante não encontrado." };
  if (a.status === "assinado")
    return { error: "Este assinante já assinou o documento." };
  if (!tramitaSignAtivo())
    return { error: "Integração com TramitaSign não está ativa." };

  let erro: string | null = null;
  let link: string | null = null;
  let documentoId: string | null = null;
  try {
    const userId = await tramitaObterUserId();
    if (!userId) {
      erro =
        "Não foi possível obter o usuário do TramitaSign (API key/URL configuradas mas a resposta não trouxe um id válido).";
    } else {
      const cliente = await tramitaCriarCliente({
        nome: a.nome,
        email: a.email || null,
        telefone: null,
        cpf: null,
      });
      if (!cliente?.id) {
        erro = "Falha ao criar o cliente no TramitaSign.";
      } else {
        const doc = await tramitaEnviarDocumento({
          clienteId: cliente.id,
          userId,
          titulo: a.envelopeNome,
          htmlContent: a.documentoHtmlCombinado,
          email: a.notifAssinantes ? a.email || null : null,
          telefone: null,
          requireSelfie: a.valSelfie,
          requireDocument: a.valDocumento,
        });
        link = doc?.link ?? null;
        documentoId = doc?.id ?? null;
        if (!link)
          erro = "Falha ao enviar o documento para assinatura no TramitaSign.";
      }
    }
  } catch (e) {
    console.error("[TramitaSign] reenviarAssinaturaAction error:", e);
    erro = e instanceof Error ? e.message : "Erro inesperado ao reenviar.";
  }

  await atualizarAssinanteTramitaSign(assinanteId, { documentoId, link, erro });
  revalidatePath(`/dashboard/assinaturas/${envelopeId}`);
  return erro ? { error: erro } : {};
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
