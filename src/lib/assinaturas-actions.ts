"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  criarEnvelope,
  atualizarAssinanteTramitaSign,
  type DocumentoInput,
  type AssinanteInput,
  type AssinanteCriado,
} from "./assinaturas-db";
import { getClientFull } from "./clients-db";
import { getModeloById } from "./modelos-db";
import { getEscritorioConfig } from "./escritorio-db";
import { buildModeloVars } from "./modelo-vars";
import {
  blocksToHtml,
  textToHtml,
  substituteVariablesInBlocks,
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
  const vars = buildModeloVars(client, escritorioConfig, date);

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
      let conteudo = modelo.conteudo;
      for (const [key, value] of Object.entries(vars)) {
        conteudo = conteudo.split(key).join(value);
      }
      html = textToHtml(conteudo);
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
          `<h2>${d.nome}</h2>\n${d.htmlContent}\n<div style="margin:24px 0"><hr></div>`
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

        const cliente = userId
          ? await tramitaCriarCliente({
              nome: a.nome,
              email: a.email || null,
              telefone: null,
              cpf: null,
            })
          : null;

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
        }

        await atualizarAssinanteTramitaSign(a.id, {
          documentoId,
          link,
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
