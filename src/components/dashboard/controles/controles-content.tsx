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
  type Controle,
  type StatusControle,
} from "@/lib/controles-types";

// ── Cores por tipo ────────────────────────────────────────────────────────────

const TIPO_STYLE: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  audiencias: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-400",
    dot: "bg-violet-500",
  },
  prazos: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-400",
    dot: "bg-red-500",
  },
  pericias: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-400",
    dot: "bg-cyan-500",
  },
  dcb: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-400",
    dot: "bg-orange-500",
  },
  beneficios: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-400",
    dot: "bg-emerald-500",
  },
  implantados: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-400",
    dot: "bg-blue-500",
  },
  "implantados-data": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-400",
    dot: "bg-blue-500",
  },
  alvaras: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-400",
    dot: "bg-amber-500",
  },
};

function getTipoStyle(tipo: string) {
  return (
    TIPO_STYLE[tipo] ?? {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-400",
      dot: "bg-slate-400",
    }
  );
}

// ── Urgência ──────────────────────────────────────────────────────────────────

function getDaysRemaining(dataEvento: string | null): number | null {
  if (!dataEvento) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dataEvento + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function UrgencyBadge({
  dataEvento,
  status,
}: {
  dataEvento: string | null;
  status: StatusControle;
}) {
  if (status !== "pendente" || !dataEvento) return null;
  const days = getDaysRemaining(dataEvento);
  if (days === null) return null;

  let cls = "";
  let label = "";

  if (days < 0) {
    cls = "bg-red-100 text-red-700 border-red-300";
    label = `Vencido ${Math.abs(days)}d`;
  } else if (days === 0) {
    cls = "bg-red-100 text-red-700 border-red-300";
    label = "Hoje!";
  } else if (days === 1) {
    cls = "bg-orange-100 text-orange-700 border-orange-300";
    label = "Amanhã";
  } else if (days <= 3) {
    cls = "bg-amber-100 text-amber-700 border-amber-300";
    label = `${days}d`;
  } else if (days <= 7) {
    cls = "bg-blue-100 text-blue-700 border-blue-300";
    label = `${days}d`;
  } else if (days <= 30) {
    cls = "bg-slate-100 text-slate-600 border-slate-300";
    label = `${days}d`;
  } else {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[10px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function urgencyRowBorder(
  dataEvento: string | null,
  status: StatusControle
): string {
  if (status !== "pendente") return "border-l-2 border-l-transparent";
  const days = getDaysRemaining(dataEvento);
  if (days === null) return "border-l-2 border-l-transparent";
  if (days < 0) return "border-l-4 border-l-red-500";
  if (days <= 1) return "border-l-4 border-l-red-400";
  if (days <= 3) return "border-l-4 border-l-amber-400";
  if (days <= 7) return "border-l-4 border-l-blue-400";
  return "border-l-2 border-l-transparent";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_OPTIONS: { key: StatusControle | "todos"; label: string }[] = [
  { key: "pendente", label: "Aguardando" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
  { key: "todos", label: "Todos" },
];

// ── Ações por linha ───────────────────────────────────────────────────────────

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

  const isPending = controle.status === "pendente";
  const isCancelled = controle.status === "cancelado";
  const isCompleted = controle.status === "concluido";

  return (
    <div className="flex items-center justify-end gap-1.5">
      {isPending && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatus("concluido");
          }}
          disabled={pending}
          title="Concluir"
          className="h-7 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 font-body text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          ✓ Concluir
        </button>
      )}
      {(isCompleted || isCancelled) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatus("pendente");
          }}
          disabled={pending}
          title="Reabrir"
          className="h-7 rounded-md bg-amber-50 border border-amber-200 px-2.5 font-body text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          ↺ Reabrir
        </button>
      )}
      {!isCancelled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatus("cancelado");
          }}
          disabled={pending}
          title="Cancelar"
          className="h-7 rounded-md bg-slate-50 border border-slate-200 px-2.5 font-body text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          Cancelar
        </button>
      )}
      <Link
        href={`/dashboard/controles/${controle.id}/editar?tipo=${controle.tipo}`}
        onClick={(e) => e.stopPropagation()}
        className="h-7 rounded-md border border-border bg-white px-2.5 font-body text-[11px] font-semibold text-fg hover:border-primary hover:text-primary transition-colors flex items-center whitespace-nowrap"
      >
        Editar
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        disabled={pending}
        title="Excluir"
        className="h-7 rounded-md border border-red-200 px-2.5 font-body text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

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
  const tipoStyle = getTipoStyle(tipo);
  const totalPages = Math.ceil(total / rpp);

  // Contagens rápidas da página atual (aproximado)
  const countAguardando = controles.filter(
    (c) => c.status === "pendente"
  ).length;
  const countConcluido = controles.filter(
    (c) => c.status === "concluido"
  ).length;
  const countUrgente = controles.filter((c) => {
    const d = getDaysRemaining(c.data_evento);
    return c.status === "pendente" && d !== null && d <= 3;
  }).length;

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
      {/* ── Abas de tipo ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-1.5">
        {TIPOS_CONTROLE.map((t) => {
          const isActive = t.key === tipo;
          const st = getTipoStyle(t.key);
          return (
            <Link
              key={t.key}
              href={buildUrl({ tipo: t.key, pagina: 1 })}
              className={`
                flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all duration-150
                font-body text-xs font-semibold whitespace-nowrap
                ${
                  isActive
                    ? `${st.bg} ${st.text} ${st.border} shadow-sm`
                    : "border-border bg-white text-muted hover:border-gray-300 hover:text-fg hover:shadow-sm"
                }
              `}
            >
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${isActive ? st.dot : "bg-slate-300"}`}
              />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ── Painel principal ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Cabeçalho do painel */}
        <div className={`border-b border-border px-5 py-4 ${tipoStyle.bg}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Título + badges de contagem */}
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className={`font-heading text-base font-semibold ${tipoStyle.text}`}
              >
                {tipoConfig.label}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-amber-800">
                  {countAguardando} aguardando
                </span>
                {countUrgente > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-red-700">
                    ⚠ {countUrgente} urgente{countUrgente !== 1 ? "s" : ""}
                  </span>
                )}
                {countConcluido > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-emerald-800">
                    {countConcluido} concluído{countConcluido !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Controles da toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tags de filtro ativo */}
              {status !== "pendente" && (
                <Link
                  href={buildUrl({ status: "pendente", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-50"
                >
                  {STATUS_OPTIONS.find((s) => s.key === status)?.label} ×
                </Link>
              )}
              {inicio && (
                <Link
                  href={buildUrl({ inicio: "", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-50"
                >
                  Desde {formatDate(inicio)} ×
                </Link>
              )}
              {fim && (
                <Link
                  href={buildUrl({ fim: "", pagina: 1 })}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 font-body text-xs font-semibold text-fg hover:bg-slate-50"
                >
                  Até {formatDate(fim)} ×
                </Link>
              )}

              {/* Ordenação */}
              <select
                value={ordem}
                onChange={(e) =>
                  router.push(buildUrl({ ordem: e.target.value, pagina: 1 }))
                }
                className="h-8 cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
              >
                <option value="asc">Mais próximos</option>
                <option value="desc">Mais distantes</option>
              </select>

              {/* Filtros */}
              <button
                onClick={() => setShowFilter((v) => !v)}
                className={`h-8 rounded-lg border px-3 font-body text-xs font-semibold transition-colors cursor-pointer ${
                  showFilter
                    ? "border-primary bg-white text-primary"
                    : "border-border bg-white text-fg hover:border-primary hover:text-primary"
                }`}
              >
                {showFilter ? "✕ Fechar" : "⚙ Filtros"}
              </button>
            </div>
          </div>

          {/* Total */}
          <p className="mt-2 font-body text-xs text-muted">
            {total} registro{total !== 1 ? "s" : ""} encontrado
            {total !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Painel de filtros */}
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
                className="h-9 flex items-center rounded-lg border border-border bg-white px-3 font-body text-sm text-muted hover:text-fg transition-colors"
              >
                Limpar
              </Link>
            </div>
          </form>
        )}

        {/* Tabela / Empty state */}
        {controles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ${tipoStyle.bg}`}
            >
              <span className={`text-2xl ${tipoStyle.dot}`}>📋</span>
            </div>
            <p className="font-heading text-base font-semibold text-fg">
              Nenhum registro encontrado
            </p>
            <p className="font-body text-sm text-muted max-w-xs">
              Nenhum controle de <strong>{tipoConfig.label}</strong> com os
              filtros selecionados.
            </p>
            <div className="flex gap-2 mt-1">
              <Link
                href={`/dashboard/controles?tipo=${tipo}`}
                className="h-9 flex items-center rounded-lg border border-border px-4 font-body text-sm text-muted hover:text-fg transition-colors"
              >
                Limpar filtros
              </Link>
              <Link
                href={`/dashboard/controles/novo?tipo=${tipo}`}
                className="h-9 flex items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                + {tipoConfig.label_novo}
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50/80">
                  <th className="w-1 px-0 py-0" />{" "}
                  {/* borda esquerda urgência */}
                  <th className="px-4 py-3 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap">
                    {tipoConfig.col_data}
                  </th>
                  <th className="px-4 py-3 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {tipoConfig.col_evento}
                  </th>
                  <th className="px-4 py-3 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Cliente / Processo
                  </th>
                  <th className="px-4 py-3 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Responsável
                  </th>
                  <th className="px-4 py-3 text-center font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {controles.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() =>
                      router.push(
                        `/dashboard/controles/${c.id}/editar?tipo=${c.tipo}`
                      )
                    }
                    className={`group cursor-pointer hover:bg-primary/5 transition-colors ${urgencyRowBorder(c.data_evento, c.status)}`}
                  >
                    {/* Borda urgência (visual) — a coluna vazia recebe a cor via border-left na tr */}
                    <td className="w-0 p-0" />

                    {/* Data + urgência */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-body text-sm font-semibold text-fg">
                        {formatDate(c.data_evento)}
                      </p>
                      <div className="mt-0.5">
                        <UrgencyBadge
                          dataEvento={c.data_evento}
                          status={c.status}
                        />
                      </div>
                    </td>

                    {/* Descrição */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-body text-sm text-fg line-clamp-2 group-hover:text-primary transition-colors">
                        {c.descricao}
                      </p>
                      {c.tipo_demanda && (
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-body text-[10px] font-medium text-slate-600">
                          {c.tipo_demanda}
                        </span>
                      )}
                    </td>

                    {/* Cliente / Processo */}
                    <td className="px-4 py-3">
                      {c.cliente_nome ? (
                        <p className="font-body text-sm font-medium text-fg">
                          {c.cliente_nome}
                        </p>
                      ) : (
                        <p className="font-body text-sm text-muted">—</p>
                      )}
                      {c.processo_numero && (
                        <p className="font-body text-xs text-muted mt-0.5">
                          {c.processo_numero}
                        </p>
                      )}
                    </td>

                    {/* Responsável */}
                    <td className="px-4 py-3">
                      {c.responsavel_login ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-medium text-slate-700">
                          <span className="h-4 w-4 flex-shrink-0 rounded-full bg-primary/20 text-center font-heading text-[9px] font-bold text-primary leading-4">
                            {c.responsavel_login.charAt(0).toUpperCase()}
                          </span>
                          {c.responsavel_login}
                        </span>
                      ) : (
                        <span className="font-body text-xs text-muted">—</span>
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

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <RowActions controle={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <div className="flex items-center gap-1">
              <span className="mr-1 font-body text-xs text-muted">Exibir:</span>
              {[10, 20, 50].map((s) => (
                <Link
                  key={s}
                  href={buildUrl({ rpp: s, pagina: 1 })}
                  className={`h-7 min-w-[2rem] rounded px-1.5 font-body text-xs transition-colors text-center ${rpp === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
                >
                  {s}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="mr-1 font-body text-xs text-muted">
                {(pagina - 1) * rpp + 1}–{Math.min(pagina * rpp, total)} de{" "}
                {total}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Link
                    href={buildUrl({ pagina: 1 })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border font-body text-sm transition-colors ${pagina === 1 ? "pointer-events-none border-border text-slate-300" : "border-border text-muted hover:border-primary hover:text-primary"}`}
                  >
                    «
                  </Link>
                  <Link
                    href={buildUrl({ pagina: Math.max(1, pagina - 1) })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border font-body text-sm transition-colors ${pagina === 1 ? "pointer-events-none border-border text-slate-300" : "border-border text-muted hover:border-primary hover:text-primary"}`}
                  >
                    ‹
                  </Link>
                  {(() => {
                    const pages: (number | "…")[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      const left = Math.max(2, pagina - 2);
                      const right = Math.min(totalPages - 1, pagina + 2);
                      pages.push(1);
                      if (left > 2) pages.push("…");
                      for (let i = left; i <= right; i++) pages.push(i);
                      if (right < totalPages - 1) pages.push("…");
                      pages.push(totalPages);
                    }
                    return pages.map((p, i) =>
                      p === "…" ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="flex h-8 w-8 items-center justify-center font-body text-sm text-muted"
                        >
                          …
                        </span>
                      ) : (
                        <Link
                          key={p}
                          href={buildUrl({ pagina: p })}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors ${p === pagina ? "bg-primary text-white font-semibold" : "border border-border text-muted hover:border-primary hover:text-primary"}`}
                        >
                          {p}
                        </Link>
                      )
                    );
                  })()}
                  <Link
                    href={buildUrl({
                      pagina: Math.min(totalPages, pagina + 1),
                    })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border font-body text-sm transition-colors ${pagina === totalPages ? "pointer-events-none border-border text-slate-300" : "border-border text-muted hover:border-primary hover:text-primary"}`}
                  >
                    ›
                  </Link>
                  <Link
                    href={buildUrl({ pagina: totalPages })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border font-body text-sm transition-colors ${pagina === totalPages ? "pointer-events-none border-border text-slate-300" : "border-border text-muted hover:border-primary hover:text-primary"}`}
                  >
                    »
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
