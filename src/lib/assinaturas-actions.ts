"use server";

import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { criarEnvelope } from "./assinaturas-db";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/dashboard/assinaturas");
  return { id };
}
