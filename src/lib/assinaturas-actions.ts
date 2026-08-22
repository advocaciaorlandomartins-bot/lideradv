"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  criarEnvelope,
  type DocumentoInput,
  type AssinanteInput,
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
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const vars = buildModeloVars(client, escritorioConfig, date);

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

  const id = await criarEnvelope({
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

  // Sincroniza com TramitaSign quando envelope é enviado para assinatura
  if (enviar && tramitaSignAtivo() && assinantes.length > 0) {
    const documentoHtmlCombinado = documentos
      .sort((a, b) => a.ordem - b.ordem)
      .map(
        (d) =>
          `<h2>${d.nome}</h2>\n${d.htmlContent}\n<div style="margin:24px 0"><hr></div>`
      )
      .join("\n");

    sincronizarTramitaSign(nome, assinantes, documentoHtmlCombinado).catch(
      (e) => console.error("[TramitaSign] sincronização falhou:", e)
    );
  }

  revalidatePath("/dashboard/assinaturas");
  return { id };
}

async function sincronizarTramitaSign(
  nomeEnvelope: string,
  assinantes: Array<{
    nome: string;
    email: string;
    papel: string;
    tipo: string;
  }>,
  documentoHtml: string
) {
  try {
    const userId = await tramitaObterUserId();
    if (!userId) return;

    // Envia o documento combinado pra cada assinante externo (não "eu_mesmo")
    for (const a of assinantes) {
      if (a.tipo === "eu_mesmo") continue;

      const cliente = await tramitaCriarCliente({
        nome: a.nome,
        email: a.email || null,
        telefone: null,
        cpf: null,
      });
      if (!cliente?.id) continue;

      await tramitaEnviarDocumento({
        clienteId: cliente.id,
        userId,
        titulo: nomeEnvelope,
        htmlContent: documentoHtml,
        email: a.email || null,
        telefone: null,
      });
    }
  } catch (e) {
    console.error("[TramitaSign] sincronizarTramitaSign error:", e);
  }
}
