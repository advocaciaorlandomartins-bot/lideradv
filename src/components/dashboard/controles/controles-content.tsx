"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  updateStatusControleAction,
  deleteControleAction,
} from "@/lib/controles-actions";
import {
  TIPOS_CONTROLE,
  STATUS_CONTROLE,
  getTipoConfig,
  urgencyClass,
  type Controle,
  type StatusControle,
} from "@/lib/controles-types";

const STATUS_OPTIONS: { key: StatusControle | "todos"; label: string }[] = [
  { key: "pendente", label: "Aguardando" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
  { key: "todos", label: "Todos" },
];

interface Props {
  controles: Controle[];
  total: number;
  tipo: string;
  status: string;
  ordem: string;
  pagina: number;
  rpp: number;
  inicio: string;
  fim: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function DcbCountdown({ dataEvento }: { dataEvento: string | null }) {
  if (!dataEvento) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dataEvento + "T00:00:00");
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days > 5) return null;

  const label =
    days < 0
      ? `Vencido há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? "s" : ""}`
      : days === 0
        ? "Vence hoje!"
        : days === 1
          ? "Vence amanhã"
          : `${days} dias restantes`;

  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 font-body text-[11px] font-semibold text-red-700">
      ⚠ {label}
    </span>
  );
}

function RowActions({ controle }: { controle: Controle }) {
  const [pending, startTransition] = useTransition();

  function handleStatus(next: StatusControle) {
    startTransition(async () => {
      await updateStatusControleAction(controle.id, next);
    });
  }

  function handleDelete() {
    if (!confirm("Excluir este controle? Esta ação não pode ser desfeita."))
      return;
    startTransition(async () => {
      await deleteControleAction(controle.id);
    });
  }

  const isCompleted = controle.status === "concluido";
  const isCancelled = controle.status === "cancelado";
  const isPending = controle.status === "pendente";

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {isPending && (
        <button
          onClick={() => handleStatus("concluido")}
          disabled={pending}
          title="Concluir"
          className="h-7 rounded-md bg-emerald-50 border border-emerald-200 px-2 font-body text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Concluir
        </button>
      )}
      {!isCancelled && (
        <button
          onClick={() => handleStatus("cancelado")}
          disabled={pending}
          title="Cancelar"
          className="h-7 rounded-md bg-slate-50 border border-slate-200 px-2 font-body text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancelar
        </button>
      )}
      {(isCompleted || isCancelled) && (
        <button
          onClick={() => handleStatus("pendente")}
          disabled={pending}
          title="Reabrir"
          className="h-7 rounded-md bg-amber-50 border border-amber-200 px-2 font-body text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Reabrir
        </button>
      )}
      <Link
        href={`/dashboard/controles/${controle.id}/editar?tipo=${controle.tipo}`}
        className="h-7 rounded-md border border-border px-2 font-body text-[11px] font-semibold text-fg hover:border-primary hover:text-primary transition-colors flex items-center"
      >
        Editar
      </Link>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="h-7 rounded-md border border-red-200 px-2 font-body text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        Excluir
      </button>
    </div>
  );
}

export default function ControlesContent({
  controles,
  total,
  tipo,
  status,
  ordem,
  pagina,
  rpp,
  inicio,
  fim,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showFilter, setShowFilter] = useState(false);
  const tipoConfig = getTipoConfig(tipo);
  const totalPages = Math.ceil(total / rpp);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    return `/dashboard/controles?${params.toString()}`;
  }

  function applyFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    params.set("tipo", tipo);
    const st = fd.get("status") as string;
    if (st && st !== "pendente") params.set("status", st);
    const ini = fd.get("inicio") as string;
    if (ini) params.set("inicio", ini);
    const fi = fd.get("fim") as string;
    if (fi) params.set("fim", fi);
    params.set("pagina", "1");
    router.push(`/dashboard/controles?${params.toString()}`);
    setShowFilter(false);
  }

  return (
    <div className="space-y-4">
      {/* ── Type tabs ── */}
      <div className="flex overflow-x-auto gap-0.5 rounded-xl border border-border bg-slate-50 p-1">
        {TIPOS_CONTROLE.map((t) => {
          const isActive = t.key === tipo;
          return (
            <Link
              key={t.key}
              href={buildUrl({ tipo: t.key, pagina: 1 })}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 font-body text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-white text-primary shadow-sm border border-border"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border">
          {/* Left: counter + active tags */}
          <div className="flex flex-col gap-1.5">
            <p className="font-body text-sm text-muted">
              Resultados: <strong className="text-fg">{total}</strong>
              <span className="ml-2 text-xs">({rpp} por página)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {status !== "pendente" && (
                <Link
                  href={buildUrl({ status: "pendente", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-100"
                >
                  Situação:{" "}
                  {STATUS_OPTIONS.find((s) => s.key === status)?.label ??
                    status}{" "}
                  ×
                </Link>
              )}
              {inicio && (
                <Link
                  href={buildUrl({ inicio: "", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-100"
                >
                  Desde: {formatDate(inicio)} ×
                </Link>
              )}
              {fim && (
                <Link
                  href={buildUrl({ fim: "", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-100"
                >
                  Até: {formatDate(fim)} ×
                </Link>
              )}
            </div>
          </div>

          {/* Right: buttons */}
          <div className="flex items-center gap-2">
            {/* Sort */}
            <select
              value={ordem}
              onChange={(e) =>
                router.push(buildUrl({ ordem: e.target.value, pagina: 1 }))
              }
              className="h-8 cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
            >
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigos</option>
            </select>

            {/* Filter */}
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`h-8 rounded-lg border px-3 font-body text-xs font-semibold transition-colors cursor-pointer ${
                showFilter
                  ? "border-primary bg-blue-50 text-primary"
                  : "border-border bg-white text-fg hover:border-primary hover:text-primary"
              }`}
            >
              Filtros
            </button>

            {/* New */}
            <Link
              href={`/dashboard/controles/novo?tipo=${tipo}`}
              className="h-8 flex items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-xs font-semibold text-white hover:bg-cta-hover transition-colors"
            >
              + {tipoConfig.label_novo}
            </Link>
          </div>
        </div>

        {/* Filter panel */}
        {showFilter && (
          <form
            onSubmit={applyFilter}
            className="border-b border-border bg-slate-50 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div>
              <label className="block font-body text-xs font-semibold text-fg mb-1">
                Situação
              </label>
              <select
                name="status"
                defaultValue={status}
                className="w-full h-9 rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-body text-xs font-semibold text-fg mb-1">
                Data desde
              </label>
              <input
                type="date"
                name="inicio"
                defaultValue={inicio}
                className="w-full h-9 rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-body text-xs font-semibold text-fg mb-1">
                Data até
              </label>
              <input
                type="date"
                name="fim"
                defaultValue={fim}
                className="w-full h-9 rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="h-9 flex-1 rounded-lg bg-primary font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Aplicar
              </button>
              <Link
                href={`/dashboard/controles?tipo=${tipo}`}
                className="h-9 flex items-center rounded-lg border border-border px-3 font-body text-sm text-muted hover:text-fg transition-colors"
              >
                Limpar
              </Link>
            </div>
          </form>
        )}

        {/* Table */}
        {controles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-heading text-base font-semibold text-fg">
              Nenhum controle encontrado
            </p>
            <p className="font-body text-sm text-muted">
              Ajuste os filtros ou crie um novo registro.
            </p>
            <Link
              href={`/dashboard/controles/novo?tipo=${tipo}`}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-4 h-9 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              + {tipoConfig.label_novo}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="w-2 px-3 py-3" />
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">
                    {tipoConfig.col_data}
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    {tipoConfig.col_evento}
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Cliente / Processo
                  </th>
                  <th className="px-4 py-3 text-center font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {controles.map((c) => (
                  <tr
                    key={c.id}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    {/* Urgency dot */}
                    <td className="px-3 py-3">
                      <span
                        title={c.data_evento ?? "Sem data"}
                        className={`inline-block h-2.5 w-2.5 rounded-full ${urgencyClass(c.data_evento)}`}
                      />
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 font-body text-sm text-fg whitespace-nowrap">
                      {formatDate(c.data_evento)}
                      {c.tipo === "dcb" && c.status === "pendente" && (
                        <div>
                          <DcbCountdown dataEvento={c.data_evento} />
                        </div>
                      )}
                    </td>
                    {/* Descrição */}
                    <td className="px-4 py-3 font-body text-sm text-fg max-w-xs">
                      <span className="line-clamp-2">{c.descricao}</span>
                      {c.tipo_demanda && (
                        <span className="mt-0.5 block font-body text-[11px] text-muted">
                          {c.tipo_demanda}
                        </span>
                      )}
                    </td>
                    {/* Cliente / Processo */}
                    <td className="px-4 py-3">
                      <div className="font-body text-sm text-fg font-medium">
                        {c.cliente_nome ?? (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                      {c.processo_numero && (
                        <div className="font-body text-xs text-muted">
                          {c.processo_numero}
                        </div>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-[11px] font-semibold ${STATUS_CONTROLE[c.status].color}`}
                      >
                        {STATUS_CONTROLE[c.status].label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <RowActions controle={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-border px-5 py-3">
            {pagina > 1 && (
              <Link
                href={buildUrl({ pagina: pagina - 1 })}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border font-body text-sm text-muted hover:border-primary hover:text-primary transition-colors"
              >
                ‹
              </Link>
            )}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <Link
                  key={p}
                  href={buildUrl({ pagina: p })}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg font-body text-sm transition-colors ${
                    p === pagina
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {pagina < totalPages && (
              <Link
                href={buildUrl({ pagina: pagina + 1 })}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border font-body text-sm text-muted hover:border-primary hover:text-primary transition-colors"
              >
                ›
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
