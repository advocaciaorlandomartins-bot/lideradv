import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getAllDocumentos } from "@/lib/documents-db";
import DocumentosContent from "@/components/dashboard/documentos/documentos-content";

export const metadata = { title: "Arquivos — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const session = await getSession();
  if (
    !session ||
    (!hasPermission(session, "clientes", "ver") &&
      !hasPermission(session, "processos", "ver"))
  )
    notFound();

  // Documentos de processo seguem "processos_ver_todos" (já usado em
  // /dashboard/processos e /andamentos); documentos de cliente seguem
  // "clientes_ver_todos" (mesma regra de podeAcessarCliente) — achado em
  // auditoria de 2026-10-09: o ramo de cliente nunca tinha sido restringido
  // nesta tela agregada, diferente da listagem normal de Clientes (já
  // corrigida antes). Sem isso, qualquer um com acesso a Arquivos via
  // "processos:ver" via "clientes:ver" via esta página.
  const restringirProcessos = !hasPermission(
    session,
    "processos_ver_todos",
    "ver"
  );
  const restringirClientes = !hasPermission(
    session,
    "clientes_ver_todos",
    "ver"
  );
  const colaboradorId =
    restringirProcessos || restringirClientes
      ? ((await getColaboradorIdForUser(session.id)) ??
        "00000000-0000-0000-0000-000000000000")
      : null;

  const documentos = await getAllDocumentos(
    colaboradorId,
    restringirProcessos,
    restringirClientes
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">Arquivos</h1>
        <p className="mt-1 font-body text-sm text-muted">
          Todos os documentos de clientes e processos num lugar só — sem
          precisar abrir ficha por ficha pra achar um arquivo.
        </p>
      </div>
      <DocumentosContent documentos={documentos} />
    </div>
  );
}
