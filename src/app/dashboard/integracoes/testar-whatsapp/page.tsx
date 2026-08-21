import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import TestarWhatsAppClient from "./testar-whatsapp-client";

export default async function TestarWhatsAppPage() {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") notFound();

  return <TestarWhatsAppClient />;
}
