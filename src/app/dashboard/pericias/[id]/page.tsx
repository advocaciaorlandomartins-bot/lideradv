import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getPericiaFull } from "@/lib/pericias-db";
import { TIPO_LABELS, TIPO_COLORS } from "@/lib/pericias-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import DeletePericiaButton from "@/components/dashboard/pericias/delete-pericia-button";
import DocumentsSection from "@/components/dashboard/documents/documents-section";
import {
  ChevronRightIcon,
  ClipboardListIcon,
  UsersIcon,
  CalendarIcon,
  ClockIcon,
  FolderOpenIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-8">
      <span className="w-44 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-body text-sm text-fg">{value}</span>
    </div>
  );
}

export default async function PericiaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || !hasPermission(user, "controles", "ver")) notFound();

  const { id } = await params;
  const [pericia, documentos] = await Promise.all([
    getPericiaFull(id),
    getDocumentosByEntityId("pericia", id),
  ]);
  if (!pericia) notFound();

  const statusStyles = {
    agendado: {
      dot: "bg-blue-500",
      wrap: "bg-blue-50 text-blue-700",
      label: "Agendado",
    },
    realizado: {
      dot: "bg-emerald-500",
      wrap: "bg-emerald-50 text-emerald-700",
      label: "Realizado",
    },
    cancelado: {
      dot: "bg-red-400",
      wrap: "bg-red-50 text-red-700",
      label: "Cancelado",
    },
    remarcado: {
      dot: "bg-amber-500",
      wrap: "bg-amber-50 text-amber-700",
      label: "Remarcado",
    },
  };
  const st = statusStyles[pericia.status];

  const resultadoStyles = {
    favoravel: { wrap: "bg-emerald-50 text-emerald-700", label: "Favorável" },
    desfavoravel: { wrap: "bg-red-50 text-red-700", label: "Desfavorável" },
    pendente: { wrap: "bg-slate-100 text-slate-600", label: "Pendente" },
    inconclusivo: { wrap: "bg-amber-50 text-amber-700", label: "Inconclusivo" },
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/pericias"
          className="hover:text-primary transition-colors duration-150"
        >
          Perícias
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
          {TIPO_LABELS[pericia.tipo]}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardListIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl font-semibold text-fg">
                  {TIPO_LABELS[pericia.tipo]}
                </h1>
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${TIPO_COLORS[pericia.tipo]}`}
                >
                  {TIPO_LABELS[pericia.tipo]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${st.wrap}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                {pericia.resultado && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${resultadoStyles[pericia.resultado].wrap}`}
                  >
                    {resultadoStyles[pericia.resultado].label}
                  </span>
                )}
              </div>
              <p className="mt-1 font-body text-sm text-muted">
                {pericia.client_name}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <DeletePericiaButton id={pericia.id} />
            <Link
              href={`/dashboard/pericias/${pericia.id}/editar`}
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
            Detalhes da perícia
          </h2>
          <div className="space-y-4">
            <InfoRow label="Cliente" value={pericia.client_name} />
            <InfoRow label="Data" value={pericia.data_pericia} />
            {pericia.hora_pericia && (
              <InfoRow label="Hora" value={pericia.hora_pericia} />
            )}
            {pericia.local_pericia && (
              <InfoRow label="Local" value={pericia.local_pericia} />
            )}
            {pericia.perito && (
              <InfoRow label="Perito" value={pericia.perito} />
            )}
            {pericia.especialidade && (
              <InfoRow label="Especialidade" value={pericia.especialidade} />
            )}
            {pericia.processo_tipo && (
              <InfoRow
                label="Processo vinculado"
                value={pericia.processo_tipo}
              />
            )}
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
            {[
              {
                icon: CalendarIcon,
                label: "Data",
                value: pericia.data_pericia,
              },
              {
                icon: ClockIcon,
                label: "Hora",
                value: pericia.hora_pericia ?? "—",
              },
              {
                icon: ClipboardListIcon,
                label: "Resultado",
                value: pericia.resultado
                  ? {
                      favoravel: "Favorável",
                      desfavoravel: "Desfavorável",
                      pendente: "Pendente",
                      inconclusivo: "Inconclusivo",
                    }[pericia.resultado]
                  : "—",
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

        {/* Sidebar */}
        <div className="space-y-4 lg:col-span-1">
          {/* Cliente */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-3">
              Cliente
            </p>
            <Link
              href={`/dashboard/clientes/${pericia.client_id}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 hover:border-primary hover:bg-slate-50"
            >
              <UsersIcon className="h-4 w-4 flex-shrink-0 text-muted" />
              <span className="font-body text-sm font-semibold text-primary">
                {pericia.client_name}
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 ml-auto text-muted" />
            </Link>
          </div>

          {/* Processo vinculado */}
          {pericia.processo_id && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-3">
                Processo
              </p>
              <Link
                href={`/dashboard/processos/${pericia.processo_id}`}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 hover:border-primary hover:bg-slate-50"
              >
                <FolderOpenIcon className="h-4 w-4 flex-shrink-0 text-muted" />
                <span className="font-body text-sm font-semibold text-primary truncate">
                  {pericia.processo_tipo ?? "Ver processo"}
                </span>
                <ChevronRightIcon className="h-3.5 w-3.5 ml-auto flex-shrink-0 text-muted" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Prorrogação de benefício */}
      {pericia.tipo === "prorrogacao_beneficio" && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-fg mb-5">
            Dados do benefício
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pericia.beneficio_numero && (
              <InfoRow label="Número" value={pericia.beneficio_numero} />
            )}
            {pericia.beneficio_tipo && (
              <InfoRow label="Tipo" value={pericia.beneficio_tipo} />
            )}
            {pericia.data_fim_beneficio && (
              <InfoRow
                label="Data fim atual"
                value={pericia.data_fim_beneficio}
              />
            )}
            {pericia.nova_data_fim && (
              <InfoRow label="Nova data fim" value={pericia.nova_data_fim} />
            )}
          </div>
        </div>
      )}

      {/* Observações */}
      {pericia.observacoes && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-fg mb-3">
            Observações
          </h2>
          <p className="font-body text-sm text-fg whitespace-pre-wrap">
            {pericia.observacoes}
          </p>
        </div>
      )}

      {/* Documentos */}
      <DocumentsSection
        entityType="pericia"
        entityId={pericia.id}
        documents={documentos}
      />
    </div>
  );
}
