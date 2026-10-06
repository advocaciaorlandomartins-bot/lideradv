import { notFound } from "next/navigation";
import { getClientesComDocumentosPendentes } from "@/lib/clients-db";
import DocumentosPendentesContent from "@/components/dashboard/clients/documentos-pendentes-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Documentos Pendentes — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function DocumentosPendentesPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver")) notFound();

  const clientes = await getClientesComDocumentosPendentes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Documentos Pendentes
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Clientes com documentos faltando pra dar entrada (administrativa ou
          judicial) — o que falta em cada um.
        </p>
      </div>
      <DocumentosPendentesContent clientes={clientes} />
    </div>
  );
}
