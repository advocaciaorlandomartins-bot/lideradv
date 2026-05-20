import { notFound } from "next/navigation";
import Link from "next/link";
import { getProcessoFull } from "@/lib/processos-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import DeleteProcessoButton from "@/components/dashboard/processos/delete-processo-button";
import DocumentsSection from "@/components/dashboard/documents/documents-section";
import {
  ChevronRightIcon,
  FolderOpenIcon,
  UsersIcon,
  CalendarIcon,
  BanknotesIcon,
  ClipboardListIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const AREA_COLORS: Record<string, string> = {
  Cível: "bg-blue-50 text-blue-600",
  Criminal: "bg-red-50 text-red-600",
  Trabalhista: "bg-orange-50 text-orange-600",
  Família: "bg-pink-50 text-pink-600",
  Previdenciário: "bg-purple-50 text-purple-600",
  Tributário: "bg-indigo-50 text-indigo-600",
  Administrativo: "bg-cyan-50 text-cyan-600",
  Consumidor: "bg-teal-50 text-teal-600",
  Imobiliário: "bg-emerald-50 text-emerald-600",
  Empresarial: "bg-violet-50 text-violet-600",
  Outro: "bg-slate-100 text-slate-500",
};

function areaColor(area: string) {
  return AREA_COLORS[area] ?? "bg-slate-100 text-slate-500";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-8">
      <span className="w-40 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-body text-sm text-fg">{value}</span>
    </div>
  );
}

export default async function ProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [processo, documentos] = await Promise.all([
    getProcessoFull(id),
    getDocumentosByEntityId("processo", id),
  ]);
  if (!processo) notFound();

  const statusStyles = {
    ativo: {
      dot: "bg-emerald-500",
      wrap: "bg-emerald-50 text-emerald-700",
      label: "Ativo",
    },
    arquivado: {
      dot: "bg-amber-500",
      wrap: "bg-amber-50 text-amber-700",
      label: "Arquivado",
    },
    encerrado: {
      dot: "bg-slate-400",
      wrap: "bg-slate-100 text-slate-500",
      label: "Encerrado",
    },
  };
  const st = statusStyles[processo.status];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/processos"
          className="hover:text-primary transition-colors duration-150"
        >
          Processos
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
          {processo.tipo_acao}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpenIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl font-semibold text-fg">
                  {processo.tipo_acao}
                </h1>
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${areaColor(processo.area)}`}
                >
                  {processo.area}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${st.wrap}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
              {processo.numero && (
                <p className="mt-0.5 font-mono text-sm text-muted">
                  {processo.numero}
                </p>
              )}
              {processo.fase && (
                <p className="mt-0.5 font-body text-sm text-muted">
                  Fase: {processo.fase}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <DeleteProcessoButton id={processo.id} />
            <Link
              href={`/dashboard/processos/${processo.id}/editar`}
              className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-primary hover:text-primary"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Detalhes */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-heading text-base font-semibold text-fg mb-5">
            Detalhes do processo
          </h2>
          <div className="space-y-4">
            {processo.vara && (
              <InfoRow label="Vara / Juízo" value={processo.vara} />
            )}
            {processo.comarca && (
              <InfoRow label="Comarca" value={processo.comarca} />
            )}
            {processo.data_distribuicao && (
              <InfoRow
                label="Distribuição"
                value={processo.data_distribuicao}
              />
            )}
            {processo.valor_causa != null && (
              <InfoRow
                label="Valor da causa"
                value={formatCurrency(processo.valor_causa)}
              />
            )}
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
            {[
              {
                icon: FolderOpenIcon,
                label: "Área",
                value: processo.area,
              },
              {
                icon: ClipboardListIcon,
                label: "Fase",
                value: processo.fase ?? "—",
              },
              {
                icon: CalendarIcon,
                label: "Distribuição",
                value: processo.data_distribuicao ?? "—",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 py-3 px-2 text-center"
              >
                <Icon className="h-4 w-4 text-muted" />
                <span className="font-body text-xs font-semibold text-fg leading-tight">
                  {value}
                </span>
                <span className="font-body text-[11px] text-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Partes */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="font-heading text-base font-semibold text-fg mb-5">
            Partes
          </h2>
          <div className="space-y-5">
            {/* Cliente */}
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                Nosso cliente
              </p>
              <Link
                href={`/dashboard/clientes/${processo.client_id}`}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 hover:border-primary hover:bg-slate-50"
              >
                <UsersIcon className="h-4 w-4 flex-shrink-0 text-muted" />
                <span className="font-body text-sm font-semibold text-primary">
                  {processo.client_name}
                </span>
                <ChevronRightIcon className="h-3.5 w-3.5 ml-auto text-muted" />
              </Link>
            </div>

            {/* Parte contrária */}
            {processo.parte_contraria && (
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                  Parte contrária
                </p>
                <div className="rounded-lg border border-border px-3 py-2.5">
                  <p className="font-body text-sm font-semibold text-fg">
                    {processo.parte_contraria}
                  </p>
                  {processo.parte_contraria_doc && (
                    <p className="font-body text-xs text-muted mt-0.5">
                      {processo.parte_contraria_doc}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Valor */}
            {processo.valor_causa != null && (
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                  Valor da causa
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                  <BanknotesIcon className="h-4 w-4 text-muted" />
                  <span className="font-body text-sm font-semibold text-fg">
                    {formatCurrency(processo.valor_causa)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observações */}
      {processo.notas && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-fg mb-3">
            Observações
          </h2>
          <p className="font-body text-sm text-fg whitespace-pre-wrap">
            {processo.notas}
          </p>
        </div>
      )}

      {/* Documentos */}
      <DocumentsSection
        entityType="processo"
        entityId={processo.id}
        documents={documentos}
      />
    </div>
  );
}
