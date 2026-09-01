import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getPendenciasAbertas } from "@/lib/processo-full-db";
import PendenciasAbertasClient from "@/components/dashboard/processos/pendencias-abertas-client";

export const metadata = { title: "Pendências — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function PendenciasAbertasPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : await getColaboradorIdForUser(session.id);

  const pendencias = await getPendenciasAbertas(verTodos, colaboradorId);

  return <PendenciasAbertasClient pendencias={pendencias} />;
}
