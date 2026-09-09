import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllDocumentos } from "@/lib/documents-db";
import DocumentosContent from "@/components/dashboard/documentos/documentos-content";

export const metadata = { title: "Arquivos — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const session = await getSession();
  // Sem escopo extra por responsável: quem já vê Clientes ou Processos já
  // conseguia abrir qualquer um desses arquivos individualmente pela ficha
  // correspondente — esta tela só agrega o que já era acessível, não abre
  // nada novo.
  if (
    !session ||
    (!hasPermission(session, "clientes", "ver") &&
      !hasPermission(session, "processos", "ver"))
  )
    notFound();

  const documentos = await getAllDocumentos();

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
