import { notFound, redirect } from "next/navigation";
import { getControleById } from "@/lib/controles-db";

export const dynamic = "force-dynamic";

export default async function ControlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const controle = await getControleById(id);
  if (!controle) notFound();
  redirect(`/dashboard/controles/${id}/editar?tipo=${controle.tipo}`);
}
