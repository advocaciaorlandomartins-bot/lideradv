import { notFound } from "next/navigation";
import { getAllPublicacoes } from "@/lib/publicacoes-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import IntimacoesContent from "@/components/dashboard/processos/intimacoes-content";

export const metadata = { title: "Intimações — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function IntimacoesPage() {
  const session = await getSession();
  // "processos:ver" sozinho não bastava — essa tela é outra visão dos
  // mesmos dados de /dashboard/publicacoes (getAllPublicacoes), que é
  // protegida por "publicacoes:ver". Sem essa checagem, um papel com
  // acesso a Processos mas sem Publicações (ex.: Colaborador(a)) via aqui
  // o conteúdo completo de publicações/intimações do escritório mesmo
  // sem a permissão dedicada.
  if (
    !session ||
    !hasPermission(session, "processos", "ver") ||
    !hasPermission(session, "publicacoes", "ver")
  )
    notFound();

  const publicacoes = await getAllPublicacoes();

  return <IntimacoesContent publicacoes={publicacoes} />;
}
