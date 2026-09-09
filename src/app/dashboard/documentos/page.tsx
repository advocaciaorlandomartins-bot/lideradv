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

  // Documentos de cliente não são restritos (a própria listagem de Clientes
  // também não restringe). Documentos de processo seguem a mesma regra de
  // "processos_ver_todos" já usada em /dashboard/processos e /andamentos —
  // senão esta tela agregada acabaria mostrando pra qualquer colaborador
  // arquivos de processo de gente que não é dele, coisa que a listagem
  // normal de Processos já esconde.
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const documentos = await getAllDocumentos(colaboradorId);

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
