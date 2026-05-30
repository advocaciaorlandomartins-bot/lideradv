import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "@/lib/clients-db";
import { getProcessosByClientId } from "@/lib/processos-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import { getClientDebito } from "@/lib/lancamentos-db";
import DeleteClientButton from "@/components/dashboard/clients/delete-client-button";
import DocumentsSection from "@/components/dashboard/documents/documents-section";
import GerarDocumentoButton from "@/components/dashboard/clients/gerar-documento-button";
import ClientDebitsSection from "@/components/dashboard/clients/client-debits-section";
import {
  ChevronRightIcon,
  FolderOpenIcon,
  BanknotesIcon,
  CalendarIcon,
  ClockIcon,
} from "@/components/icons";

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-8">
      <span className="w-36 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-body text-sm text-fg">{value}</span>
    </div>
  );
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, processes, documentos, debito] = await Promise.all([
    getClientById(id),
    getProcessosByClientId(id),
    getDocumentosByEntityId("cliente", id),
    getClientDebito(id),
  ]);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/clientes"
          className="hover:text-primary transition-colors duration-150"
        >
          Clientes
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl font-semibold text-fg">
                  {client.name}
                </h1>
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold tracking-wide ${client.type === "PF" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}
                >
                  {client.type}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${client.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${client.status === "ativo" ? "bg-emerald-500" : "bg-slate-400"}`}
                  />
                  {client.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-0.5 font-body text-sm text-muted">
                Cliente desde {client.since}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <DeleteClientButton id={client.id} />
            <Link
              href={`/dashboard/clientes/${client.id}/editar`}
              className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-primary hover:text-primary"
            >
              Editar
            </Link>
            <GerarDocumentoButton
              clientId={client.id}
              clientName={client.name}
            />
            <Link
              href={`/dashboard/processos/novo?cliente=${client.id}`}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover"
            >
              <FolderOpenIcon className="h-4 w-4" />
              Novo processo
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Info */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="font-heading text-base font-semibold text-fg mb-5">
            Informações
          </h2>
          <div className="space-y-4">
            <InfoRow label="Documento" value={client.doc} />
            <InfoRow label="E-mail" value={client.email} />
            <InfoRow label="Telefone" value={client.phone} />
            <InfoRow
              label="Cidade/UF"
              value={`${client.city} — ${client.state}`}
            />
            <InfoRow label="Último contato" value={client.lastContact} />
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
            {[
              {
                icon: FolderOpenIcon,
                label: "Processos",
                value: String(processes.length),
              },
              {
                icon: BanknotesIcon,
                label: "Dívida",
                value:
                  debito.totalPendente > 0
                    ? debito.totalPendente.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "R$ 0",
                highlight: debito.totalPendente > 0,
              },
              { icon: CalendarIcon, label: "Audiências", value: "0" },
            ].map(({ icon: Icon, label, value, highlight }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 py-3"
              >
                <Icon
                  className={`h-4 w-4 ${highlight ? "text-red-500" : "text-muted"}`}
                />
                <span
                  className={`font-heading text-lg font-semibold ${highlight ? "text-red-600" : "text-fg"}`}
                >
                  {value}
                </span>
                <span className="font-body text-[11px] text-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Processes */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-base font-semibold text-fg">
              Processos ({processes.length})
            </h2>
            <Link
              href={`/dashboard/processos/novo?cliente=${client.id}`}
              className="font-body text-sm font-semibold text-primary hover:text-primary-dark transition-colors duration-150"
            >
              + Adicionar
            </Link>
          </div>

          {processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <FolderOpenIcon className="h-8 w-8 text-slate-300" />
              <p className="font-body text-sm text-muted">
                Nenhum processo cadastrado
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {processes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="block rounded-lg border border-border p-4 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {p.numero && (
                          <span className="font-mono text-xs text-muted">
                            {p.numero}
                          </span>
                        )}
                        <p className="mt-0.5 font-body text-sm font-semibold text-fg">
                          {p.tipo_acao}
                        </p>
                        {p.vara && (
                          <p className="font-body text-xs text-muted">
                            {p.vara}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                            p.status === "ativo"
                              ? "bg-emerald-50 text-emerald-700"
                              : p.status === "arquivado"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {p.status === "ativo"
                            ? "Ativo"
                            : p.status === "arquivado"
                              ? "Arquivado"
                              : "Encerrado"}
                        </span>
                        {p.data_distribuicao && (
                          <p className="mt-1 flex items-center gap-1 justify-end font-body text-xs text-muted">
                            <ClockIcon className="h-3 w-3" />
                            {p.data_distribuicao}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Débitos / Despesas vinculadas */}
      <ClientDebitsSection clientId={client.id} debito={debito} />

      {/* Documentos */}
      <DocumentsSection
        entityType="cliente"
        entityId={client.id}
        documents={documentos}
      />
    </div>
  );
}
