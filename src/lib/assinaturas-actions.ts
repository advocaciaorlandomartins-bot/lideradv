"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { criarEnvelope } from "./assinaturas-db";
import { revalidatePath } from "next/cache";
import {
  tramitaSignAtivo,
  tramitaCriarCliente,
  tramitaCriarNota,
  tramitaObterUserId,
} from "./tramitasign";

export async function salvarEnvelopeAction(formData: FormData) {
  const session = await getSession();
  if (!session || !hasPermission(session, "assinaturas", "criar"))
    throw new Error("Sem permissão.");

  const nome = formData.get("nome") as string;
  const prazo = (formData.get("prazo") as string) || null;
  const enviar = formData.get("enviar") === "1";
  const notifAssinantes = formData.get("notif_assinantes") === "1";
  const notifCriador = formData.get("notif_criador") === "1";
  const notifEscritorio = formData.get("notif_escritorio") === "1";

  const assinantesJson = formData.get("assinantes") as string;
  const documentosJson = formData.get("documentos") as string;

  const assinantes = JSON.parse(assinantesJson || "[]");
  const documentos = JSON.parse(documentosJson || "[]");

  const id = await criarEnvelope({
    nome,
    prazo,
    status: enviar ? "aguardando" : "rascunho",
    notifAssinantes,
    notifCriador,
    notifEscritorio,
    criadoPor: session.login,
    assinantes,
    documentos,
  });

  // Sincroniza com TramitaSign quando envelope é enviado para assinatura
  if (enviar && tramitaSignAtivo() && assinantes.length > 0) {
    sincronizarTramitaSign(id, nome, assinantes).catch((e) =>
      console.error("[TramitaSign] sincronização falhou:", e)
    );
  }

  revalidatePath("/dashboard/assinaturas");
  return { id };
}

async function sincronizarTramitaSign(
  envelopeId: string,
  nomeEnvelope: string,
  assinantes: Array<{
    nome: string;
    email: string;
    papel: string;
    tipo: string;
  }>
) {
  try {
    const userId = await tramitaObterUserId();

    // Para cada assinante externo (não "eu_mesmo"), cria no TramitaSign
    for (const a of assinantes) {
      if (a.tipo === "eu_mesmo") continue;

      const cliente = await tramitaCriarCliente({
        nome: a.nome,
        email: a.email || null,
        telefone: null,
        cpf: null,
      });

      if (cliente?.id && userId) {
        const dataEnvio = new Date().toLocaleString("pt-BR");
        await tramitaCriarNota(
          cliente.id,
          userId,
          `Envelope de assinatura enviado via LiderAdv\n` +
            `Documento: ${nomeEnvelope}\n` +
            `Papel: ${a.papel}\n` +
            `Data: ${dataEnvio}\n` +
            `Ref: ${envelopeId}`
        );
      }
    }
  } catch (e) {
    console.error("[TramitaSign] sincronizarTramitaSign error:", e);
  }
}
