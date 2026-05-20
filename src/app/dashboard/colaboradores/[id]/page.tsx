import { notFound } from "next/navigation";
import Link from "next/link";
import { getColaboradorFull } from "@/lib/colaboradores-db";
import { CARGO_LABELS, CARGO_COLORS } from "@/lib/colaboradores-types";
import DeleteColaboradorButton from "@/components/dashboard/colaboradores/delete-colaborador-button";
import {
  ChevronRightIcon,
  UserPlusIcon,
  CalendarIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

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

export default async function ColaboradorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const colaborador = await getColaboradorFull(id);
  if (!colaborador) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/colaboradores"
          className="hover:text-primary transition-colors duration-150"
        >
          Colaboradores
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
          {colaborador.nome}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-xl font-semibold text-primary">
              {colaborador.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl font-semibold text-fg">
                  {colaborador.nome}
                </h1>
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${CARGO_COLORS[colaborador.cargo]}`}
                >
                  {CARGO_LABELS[colaborador.cargo]}
                </span>
                {colaborador.status === "ativo" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-emerald-50 text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-slate-100 text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Inativo
                  </span>
                )}
              </div>
              {colaborador.email && (
                <p className="mt-1 font-body text-sm text-muted">
                  {colaborador.email}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <DeleteColaboradorButton id={colaborador.id} />
            <Link
              href={`/dashboard/colaboradores/${colaborador.id}/editar`}
              className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-primary hover:text-primary"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-fg mb-5">
          Informações
        </h2>
        <div className="space-y-4">
          <InfoRow label="Cargo" value={CARGO_LABELS[colaborador.cargo]} />
          {colaborador.email && (
            <InfoRow label="E-mail" value={colaborador.email} />
          )}
          {colaborador.telefone && (
            <InfoRow label="Telefone" value={colaborador.telefone} />
          )}
          {colaborador.oab && <InfoRow label="OAB" value={colaborador.oab} />}
          {colaborador.data_admissao && (
            <InfoRow label="Admissão" value={colaborador.data_admissao} />
          )}
          {colaborador.status === "inativo" && colaborador.data_demissao && (
            <InfoRow label="Demissão" value={colaborador.data_demissao} />
          )}
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
          {[
            {
              icon: UserPlusIcon,
              label: "Cargo",
              value: CARGO_LABELS[colaborador.cargo],
            },
            {
              icon: CalendarIcon,
              label: "Admissão",
              value: colaborador.data_admissao ?? "—",
            },
            {
              icon: CalendarIcon,
              label: colaborador.status === "inativo" ? "Demissão" : "Status",
              value:
                colaborador.status === "inativo"
                  ? (colaborador.data_demissao ?? "—")
                  : "Ativo",
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
              <span className="font-body text-[11px] text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Observações */}
      {colaborador.observacoes && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-fg mb-3">
            Observações
          </h2>
          <p className="font-body text-sm text-fg whitespace-pre-wrap">
            {colaborador.observacoes}
          </p>
        </div>
      )}
    </div>
  );
}
