"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeAcessarCliente } from "./acesso";
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
import {
  getAdvogadosParaDocumento,
  getColaboradorFull,
} from "./colaboradores-db";
import {
  buildModeloVars,
  buildModeloVarsColaborador,
  replaceVars,
} from "./modelo-vars";
import {
  blocksToHtml,
  textToHtml,
  substituteVariablesInBlocks,
} from "./modelo-blocks";
import { renderModeloParaPdf } from "./modelo-pdf-render";
import { enviarEmailEnvelopeEnviado } from "./email";
import { processarAtualizacaoEnvelope } from "./assinaturas-sync";
import sql from "./db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  tramitaSignAtivo,
  tramitaCriarCliente,
  tramitaObterUserId,
  tramitaUploadArquivo,
  tramitaCriarEnvelopeAssinatura,
  tramitaAtualizarSignatarios,
  tramitaEnviarEnvelopeAssinatura,
  tramitaObterEnvelopeAssinatura,
  type TramitaSignerInput,
  type TramitaSignerResultado,
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
  // Sem isto, qualquer usuário com "assinaturas:criar" (ex: Advogado(a) sem
  // clientes_ver_todos) conseguia passar o clienteId de OUTRO colaborador e
  // gerar/enviar um documento de procuração/contrato com CPF, endereço,
  // membros da família e dados do responsável legal dele — mesma checagem
  // que documentos/*, ia/* e gerar-modelo/* já fazem. Achado em auditoria
  // de 2026-10-10 — o módulo "assinaturas" não tem sub-permissão
  // "_ver_todos", então essa é a única barreira possível.
  if (!(await podeAcessarCliente(session, clienteId)))
    throw new Error("Sem permissão.");

  const assinantesJson = formData.get("assinantes") as string;
  const modelosJson = formData.get("modelos") as string;
  const respostasExtrasJson = formData.get("respostas_extras") as string;

  const assinantes = JSON.parse(assinantesJson || "[]") as AssinanteInput[];
  const modelosSelecionados = JSON.parse(modelosJson || "[]") as Array<{
    modeloId: string;
    ordem: number;
  }>;
  const respostasExtrasBrutas = JSON.parse(
    respostasExtrasJson || "{}"
  ) as Record<string, unknown>;

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

  // Busca todos os modelos primeiro (uma vez só) — precisa disso pra saber
  // o conjunto de tags de perguntas_extras válidas ANTES de montar `vars`,
  // já que os documentos são renderizados a partir do mesmo `vars`
  // compartilhado logo abaixo.
  const modelosCarregados = (
    await Promise.all(modelosSelecionados.map((m) => getModeloById(m.modeloId)))
  ).filter((m): m is NonNullable<typeof m> => m !== null);

  // Só aceita resposta pra tag que algum modelo selecionado realmente
  // declarou em perguntas_extras — mesma regra de gerar-modelo/route.ts,
  // impede que o formulário injete uma variável arbitrária no documento.
  const tagsPermitidas = new Set(
    modelosCarregados.flatMap((m) =>
      (m.perguntas_extras ?? []).map((p) => p.tag)
    )
  );
  const respostasValidas: Record<string, string> = {};
  for (const [tag, valor] of Object.entries(respostasExtrasBrutas)) {
    if (tagsPermitidas.has(tag) && typeof valor === "string" && valor.trim()) {
      vars[`{{${tag}}}`] = valor.trim();
      respostasValidas[tag] = valor.trim();
    }
  }
  // Guarda pra pré-preencher da próxima vez (mesma regra de gerar-modelo/
  // route.ts) — merge, não substitui, senão apagaria respostas salvas de
  // outro modelo já respondido antes pra esse mesmo cliente.
  if (Object.keys(respostasValidas).length > 0) {
    await sql`
      UPDATE clients
      SET respostas_extras = COALESCE(respostas_extras, '{}'::jsonb) || ${JSON.stringify(respostasValidas)}::jsonb
      WHERE id = ${clienteId}::uuid
    `.catch((e) =>
      console.error("[assinaturas] falha ao salvar respostas_extras:", e)
    );
  }

  // A ordem de seleção no wizard já é a ordem de envio — só respeitamos o
  // "ordem" enviado por cada item, sem reordenar aqui. O HTML aqui é só pra
  // pré-visualização na nossa própria tela (aba "Documentos" do envelope) —
  // o que vai pro TramitaSign é um PDF de verdade, gerado à parte em
  // enviarEnvelopeParaTramitaSign.
  const documentos: DocumentoInput[] = [];
  for (const m of modelosSelecionados) {
    const modelo = modelosCarregados.find((x) => x.id === m.modeloId);
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
    // Precisa de after() — não dá pra só disparar a promise sem esperar
    // (`.catch(...)` sem await): a Vercel pode encerrar a função assim que
    // a Server Action devolve `{ id }" logo abaixo, matando a promise
    // solta no meio (com sorte variável de rodar completa ou não). Era
    // exatamente isso que fazia o envio ao TramitaSign falhar em silêncio
    // às vezes — o envelope ficava salvo como "aguardando" no nosso banco
    // sem nunca ter sido enviado de verdade (tramitasign_envelope_id nulo,
    // nenhum erro gravado porque o código que gravaria o erro nem chegava
    // a rodar). after() garante que o callback roda até o fim mesmo depois
    // da resposta já ter sido enviada ao navegador.
    after(() =>
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
      )
    );
  }

  revalidatePath("/dashboard/assinaturas");
  return { id };
}

function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Casa cada signer devolvido pelo TramitaSign com o assinante nosso e já
 * grava signerId/link/erro. Tenta e-mail, depois nome normalizado; se ainda
 * sobrar exatamente um de cada lado sem casar, casa por posição (só nesse
 * caso — mais de um sobrando de cada lado é ambíguo, melhor reportar erro
 * do que arriscar gravar o link de assinatura na pessoa errada).
 *
 * Sem isso, um assinante sem e-mail cadastrado (comum em lead do PrevBot,
 * que às vezes só tem telefone) nunca casava com nada — o `continue` mudo
 * da versão anterior deixava signerId/link/erro todos null pra sempre, sem
 * nenhum erro registrado (achado real em produção: envelopes "Juliana
 * Teste", tramitasign_envelope_id 15/16, email="").
 */
async function casarEGravarSigners(
  signersResposta: TramitaSignerResultado[],
  assinantesEnviados: string[],
  assinanteIdPorEmail: Map<string, string>,
  assinanteIdPorNome: Map<string, string>
): Promise<{ assinantesSemMatch: string[]; semLink: string[] }> {
  const pares: Array<{ assinanteId: string; signer: TramitaSignerResultado }> =
    [];
  const signersSemMatch: TramitaSignerResultado[] = [];

  for (const s of signersResposta) {
    const assinanteId =
      (s.email ? assinanteIdPorEmail.get(s.email.toLowerCase()) : undefined) ??
      (s.fullName
        ? assinanteIdPorNome.get(normalizarNome(s.fullName))
        : undefined);
    if (assinanteId) {
      pares.push({ assinanteId, signer: s });
    } else {
      signersSemMatch.push(s);
    }
  }

  const assinantesCasados = new Set(pares.map((p) => p.assinanteId));
  let assinantesRestantes = assinantesEnviados.filter(
    (id) => !assinantesCasados.has(id)
  );

  if (assinantesRestantes.length === 1 && signersSemMatch.length === 1) {
    pares.push({
      assinanteId: assinantesRestantes[0],
      signer: signersSemMatch[0],
    });
    assinantesRestantes = [];
  }

  for (const { assinanteId, signer } of pares) {
    await atualizarAssinanteTramitaSign(assinanteId, {
      signerId: signer.id,
      link: signer.signatureLink,
      erro: signer.signatureLink
        ? null
        : "Envelope enviado, mas o TramitaSign ainda não gerou o link de assinatura deste assinante.",
    });
  }

  return {
    assinantesSemMatch: assinantesRestantes,
    semLink: pares
      .filter((p) => !p.signer.signatureLink)
      .map((p) => p.assinanteId),
  };
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

  // Envelope é SEMPRE de um cliente OU de um colaborador (ex: Contrato de
  // Parceria), nunca os dois — monta vars a partir de qualquer um que
  // esteja presente, já que o restante do envio (upload, signers, envio)
  // não depende de qual dos dois é.
  let nomeParte: string;
  let vars: Record<string, string>;
  const escritorioConfig = await getEscritorioConfig();
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  if (env.clienteId) {
    const client = await getClientFull(env.clienteId);
    if (!client) {
      const erro = "Cliente do envelope não encontrado.";
      await gravarErroEmTodos(erro);
      return { error: erro };
    }
    const advogados = await getAdvogadosParaDocumento().catch(() => []);
    nomeParte = client.name;
    vars = buildModeloVars(client, escritorioConfig, date, advogados);
  } else if (env.colaboradorId) {
    const colaborador = await getColaboradorFull(env.colaboradorId);
    if (!colaborador) {
      const erro = "Colaborador do envelope não encontrado.";
      await gravarErroEmTodos(erro);
      return { error: erro };
    }
    nomeParte = colaborador.nome;
    vars = buildModeloVarsColaborador(colaborador, escritorioConfig, date);
  } else {
    const erro = "Envelope sem cliente ou colaborador vinculado.";
    await gravarErroEmTodos(erro);
    return { error: erro };
  }

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
        nomeParte,
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
  //    a lista de signers do envelope. Na v2, diferente da v1, o dono do
  //    envelope (user_id passado na criação acima) só vira assinante se
  //    for incluído explicitamente aqui — como nunca incluímos, o
  //    problema do "signatário fantasma" (o escritório preso esperando
  //    assinar sem ninguém ter pedido) não existe mais, sem precisar de
  //    nenhum passo extra de limpeza.
  const signers: TramitaSignerInput[] = [];
  const assinanteIdPorEmail = new Map<string, string>();
  // Casamento por nome/posição é fallback pro caso (comum em lead do
  // PrevBot, que às vezes só tem telefone) de assinante sem e-mail
  // cadastrado — sem isso, o signer devolvido pela API nunca casava com
  // ninguém aqui e o link ficava pra sempre null, sem erro nenhum
  // registrado (achado real em produção: envelopes 15/16, "Juliana
  // Teste", email="", tramitasign_signer_id/link/erro todos null).
  const assinanteIdPorNome = new Map<string, string>();
  const assinantesEnviados: string[] = [];
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
      handwrittenSignatureRequired: a.valAssinaturaDesenhada,
    });
    if (a.email) assinanteIdPorEmail.set(a.email.toLowerCase(), a.id);
    assinanteIdPorNome.set(normalizarNome(a.nome), a.id);
    assinantesEnviados.push(a.id);
  }
  if (assinantesEnviados.length === 0) {
    return { error: "Nenhum assinante pôde ser cadastrado no TramitaSign." };
  }

  const okSigners = await tramitaAtualizarSignatarios(criado.id, signers);
  if (!okSigners) {
    const erro = "Falha ao definir os assinantes no TramitaSign.";
    for (const assinanteId of assinantesEnviados) {
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
    for (const assinanteId of assinantesEnviados) {
      await atualizarAssinanteTramitaSign(assinanteId, {
        signerId: null,
        link: null,
        erro,
      });
    }
    return { error: erro };
  }

  // 6. Casa cada signer devolvido com o assinante nosso e grava o link de
  //    assinatura. Tenta e-mail primeiro, depois nome normalizado; se um
  //    signer não casa com ninguém (ou sobra exatamente um de cada lado),
  //    NUNCA descarta em silêncio — melhor sobrar um erro visível do que
  //    voltar {} de sucesso sem ter gravado nada (era exatamente isso que
  //    acontecia antes com assinante sem e-mail: `continue` mudo).
  let algumSemLink = false;
  const naoCasados = await casarEGravarSigners(
    enviado.signers,
    assinantesEnviados,
    assinanteIdPorEmail,
    assinanteIdPorNome
  );
  if (naoCasados.assinantesSemMatch.length > 0) algumSemLink = true;
  if (naoCasados.semLink.length > 0) algumSemLink = true;

  // 7. POST /envio responde 202 (aceito) enquanto o envelope ainda está em
  //    preparação — o signature_link só fica pronto quando chega em
  //    aguardando_assinaturas. Espera um pouco e reconsulta uma vez antes
  //    de desistir (o webhook também atualiza isso depois, mas não faz
  //    sentido deixar o usuário vendo "sem link" se resolve em segundos).
  let assinantesSemMatchFinal = naoCasados.assinantesSemMatch;
  if (algumSemLink) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const atualizado = await tramitaObterEnvelopeAssinatura(criado.id);
    if (atualizado) {
      const naoCasados2 = await casarEGravarSigners(
        atualizado.signers,
        assinantesEnviados,
        assinanteIdPorEmail,
        assinanteIdPorNome
      );
      assinantesSemMatchFinal = naoCasados2.assinantesSemMatch;
      algumSemLink =
        naoCasados2.assinantesSemMatch.length > 0 ||
        naoCasados2.semLink.length > 0;
    }
  }

  // Assinante que nunca casou com nenhum signer devolvido (mesmo depois do
  // retry) fica com erro gravado na hora — sem isso, a linha em
  // envelope_assinantes fica com signerId/link/erro todos null pra sempre,
  // indistinguível de "envio nem começou" (foi exatamente essa ambiguidade
  // que escondeu esse bug em produção antes).
  if (assinantesSemMatchFinal.length > 0) {
    console.error(
      "[TramitaSign] signer(s) da resposta não casaram com nenhum assinante local (envelope %s): %o",
      criado.id,
      assinantesSemMatchFinal
    );
    for (const assinanteId of assinantesSemMatchFinal) {
      await atualizarAssinanteTramitaSign(assinanteId, {
        signerId: null,
        link: null,
        erro: 'Envelope enviado ao TramitaSign, mas não foi possível identificar o link de assinatura deste assinante na resposta (verifique e-mail/nome cadastrados). Use "Verificar status" ou reenvie.',
      });
    }
  }

  return algumSemLink
    ? {
        error:
          assinantesSemMatchFinal.length > 0
            ? "Envelope enviado, mas não foi possível confirmar o link de assinatura de um ou mais assinantes. Verifique o status do envelope."
            : "Envelope enviado — o TramitaSign ainda está preparando o link de assinatura. Reenvie em alguns segundos ou aguarde, ele chega automaticamente.",
      }
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

/**
 * Consulta o status do envelope direto na API do TramitaSign e grava o
 * que mudou por aqui — não depende do webhook deles ter chegado (útil
 * enquanto não está confirmado se o webhook está configurado do lado
 * deles apontando pra cá, ou pra conferir na hora sem esperar).
 */
export async function sincronizarEnvelopeAction(
  envelopeId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(envelopeId)) return { error: "ID inválido." };
  if (!(await podeEditarEnvelope(session, envelopeId)))
    return { error: "Sem permissão." };
  if (!tramitaSignAtivo())
    return { error: "Integração com TramitaSign não está ativa." };

  const [row] = await sql`
    SELECT tramitasign_envelope_id FROM envelopes WHERE id = ${envelopeId}::uuid
  `;
  const tramitaId = row?.tramitasign_envelope_id as number | null | undefined;
  if (!tramitaId) {
    return { error: "Este envelope ainda não foi enviado ao TramitaSign." };
  }

  const atual = await tramitaObterEnvelopeAssinatura(tramitaId);
  if (!atual) {
    return { error: "Não foi possível consultar o status no TramitaSign." };
  }

  await processarAtualizacaoEnvelope({
    envelopeId,
    remoteStatus: atual.status,
    signers: atual.signers,
    signedUrls: atual.signedUrls,
  });

  revalidatePath(`/dashboard/assinaturas/${envelopeId}`);
  return {};
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
