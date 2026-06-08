import { notFound, redirect } from "next/navigation";
import { getControleById } from "@/lib/controles-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Controle — LiderAdv" };

export default async function ControlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "ver")) notFound();

  const { id } = await params;
  const controle = await getControleById(id);
  if (!controle) notFound();
  redirect(`/dashboard/controles/${id}/editar?tipo=${controle.tipo}`);
}
