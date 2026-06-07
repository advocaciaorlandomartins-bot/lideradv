import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "@/lib/clients-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getProcessosByClientId } from "@/lib/processos-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import { getClientDebito } from "@/lib/lancamentos-db";
import { getModelosAtivos } from "@/lib/modelos-db";
import DeleteClientButton from "@/components/dashboard/clients/delete-client-button";
import ClienteDetailTabs from "@/components/dashboard/clients/cliente-detail-tabs";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver")) notFound();

  const { id } = await params;
  const [client, processes, documentos, debito, modelos] = await Promise.all([
    getClientById(id),
    getProcessosByClientId(id),
    getDocumentosByEntityId("cliente", id),
    getClientDebito(id),
    getModelosAtivos(),
  ]);
  if (!client) notFound();

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/clientes"
          className="hover:text-primary transition-colors duration-150"
        >
          Clientes
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="truncate max-w-xs font-semibold text-fg">
          {client.name}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full font-heading text-xl font-semibold ${avatarColor(client.name)}`}
            >
              {initials(client.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold text-fg">
                  {client.name}
                </h1>
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold tracking-wide ${
                    client.type === "PF"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {client.type}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                    client.status === "ativo"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      client.status === "ativo"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {client.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-0.5 font-body text-sm text-muted">
                {client.doc} · Cliente desde {client.since}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <DeleteClientButton id={client.id} />
            <Link
              href={`/dashboard/clientes/${client.id}/editar`}
              className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
            >
              Editar cadastro
            </Link>
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <ClienteDetailTabs
        client={client}
        processes={processes}
        debito={debito}
        documentos={documentos}
        modelos={modelos}
      />

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 className="font-heading text-sm font-semibold text-red-700 mb-3">
          Zona de risco
        </h3>
        <div className="flex flex-wrap gap-3">
          <DeleteClientButton id={client.id} />
        </div>
      </div>
    </div>
  );
}
