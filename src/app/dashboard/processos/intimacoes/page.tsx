import { notFound } from "next/navigation";
import { getAllPublicacoes } from "@/lib/publicacoes-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import IntimacoesContent from "@/components/dashboard/processos/intimacoes-content";

export const metadata = { title: "Intimações — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const publicacoes = await getAllPublicacoes();

  return <IntimacoesContent publicacoes={publicacoes} />;
}
