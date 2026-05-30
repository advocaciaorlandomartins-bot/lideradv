"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Pericia } from "@/lib/pericias-db";
import { TIPO_LABELS, TIPO_COLORS } from "@/lib/pericias-types";
import { markPericiaRealizadaAction } from "@/lib/pericia-actions";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ClipboardListIcon,
  ChevronRightIcon,
  UsersIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
} from "@/components/icons";

const PAGE_SIZE = 8;

type PericiaStatus = "agendado" | "realizado" | "cancelado" | "remarcado";

const STATUS_META: Record<
  PericiaStatus,
  { dot: string; wrap: string; label: string }
> = {
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

function StatusBadge({ status }: { status: PericiaStatus }) {
  const s = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function ResultadoBadge({ resultado }: { resultado: Pericia["resultado"] }) {
  if (!resultado)
    return <span className="font-body text-sm text-muted">—</span>;
  const styles: Record<string, string> = {
    favoravel: "bg-emerald-50 text-emerald-700",
    desfavoravel: "bg-red-50 text-red-700",
    pendente: "bg-slate-100 text-slate-600",
    inconclusivo: "bg-amber-50 text-amber-700",
  };
  const labels: Record<string, string> = {
    favoravel: "Favorável",
    desfavoravel: "Desfavorável",
    pendente: "Pendente",
    inconclusivo: "Inconclusivo",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-body text-xs font-semibold ${styles[resultado]}`}
    >
      {labels[resultado]}
    </span>
  );
}

function MarkRealizadoButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => markPericiaRealizadaAction(id))}
      disabled={isPending}
      title="Marcar como realizada"
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 transition-colors duration-150 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
    >
      <CheckIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(2, current - 2);
  const right = Math.min(total - 1, current + 2);
  const pages: (number | "…")[] = [1];
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

type StatusFilter = "todos" | PericiaStatus;
type TipoFilter = "todos" | string;

interface Props {
  pericias: Pericia[];
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "agendado", label: "Agendados" },
  { key: "realizado", label: "Realizados" },
  { key: "remarcado", label: "Remarcados" },
  { key: "cancelado", label: "Cancelados" },
];

const ACTIVE_LABEL: Record<StatusFilter, string> = {
  todos: "Todas as Perícias",
  agendado: "Perícias Agendadas",
  realizado: "Perícias Realizadas",
  remarcado: "Perícias Remarcadas",
  cancelado: "Perícias Canceladas",
};

export default function PericiasContent({ pericias }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [page, setPage] = useState(1);

  const statusCounts = useMemo(
    () => ({
      todos: pericias.length,
      agendado: pericias.filter((p) => p.status === "agendado").length,
      realizado: pericias.filter((p) => p.status === "realizado").length,
      cancelado: pericias.filter((p) => p.status === "cancelado").length,
      remarcado: pericias.filter((p) => p.status === "remarcado").length,
    }),
    [pericias]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pericias.filter((p) => {
      const matchSearch =
        !q ||
        p.client_name.toLowerCase().includes(q) ||
        (p.perito ?? "").toLowerCase().includes(q) ||
        (p.local_pericia ?? "").toLowerCase().includes(q) ||
        (p.especialidade ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "todos" || p.status === statusFilter;
      const matchTipo = tipoFilter === "todos" || p.tipo === tipoFilter;
      return matchSearch && matchStatus && matchTipo;
    });
  }, [pericias, search, statusFilter, tipoFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tipoOptions = Object.entries(TIPO_LABELS) as [string, string][];

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
    setPage(1);
  }
  function handleTipoFilter(f: TipoFilter) {
    setTipoFilter(f);
    setPage(1);
  }
  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* ── Status tab cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {STATUS_TABS.map((t) => {
          const active = statusFilter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleStatusFilter(t.key)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all duration-150 cursor-pointer sm:justify-start ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              {t.key !== "todos" && (
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${active ? STATUS_META[t.key as PericiaStatus].dot : "bg-slate-300"}`}
                />
              )}
              <span
                className={`font-body text-sm font-semibold ${active ? "text-primary" : "text-muted"}`}
              >
                {t.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-body text-xs font-bold ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {statusCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Panel ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardListIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                {ACTIVE_LABEL[statusFilter]}
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length} perícia{filtered.length !== 1 ? "s" : ""}
                {search ? ` · busca: "${search}"` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  placeholder="Buscar cliente, perito…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-9 w-44 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <Link
                href="/dashboard/pericias/nova"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
              >
                <PlusIcon className="h-4 w-4" />
                Nova perícia
              </Link>
            </div>
            {/* Tipo filter pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleTipoFilter("todos")}
                className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  tipoFilter === "todos"
                    ? "bg-primary text-white"
                    : "border border-border bg-white text-muted hover:text-fg"
                }`}
              >
                Todos os tipos
              </button>
              {tipoOptions.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleTipoFilter(key)}
                  className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                    tipoFilter === key
                      ? "bg-primary text-white"
                      : "border border-border bg-white text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ClipboardListIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma perícia encontrada
            </p>
            <p className="font-body text-xs text-slate-400">
              {search || tipoFilter !== "todos"
                ? "Tente ajustar a busca ou os filtros"
                : "Ajuste o filtro de status acima"}
            </p>
            {!search && statusFilter !== "todos" && (
              <button
                onClick={() => handleStatusFilter("todos")}
                className="mt-1 cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todas
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Data / Hora
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Local / Perito
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Resultado
                    </th>
                    <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/pericias/${p.id}`)}
                      className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                    >
                      {/* Tipo */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <ClipboardListIcon className="h-4 w-4 text-primary" />
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${TIPO_COLORS[p.tipo]}`}
                          >
                            {TIPO_LABELS[p.tipo]}
                          </span>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3.5">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/clientes/${p.client_id}`);
                          }}
                          className="flex w-fit cursor-pointer items-center gap-1.5 font-body text-sm text-fg transition-colors duration-150 hover:text-primary"
                        >
                          <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                          <span className="max-w-[140px] truncate">
                            {p.client_name}
                          </span>
                        </span>
                      </td>

                      {/* Data / Hora */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-body text-sm text-fg">
                          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                          {p.data_pericia}
                        </div>
                        {p.hora_pericia && (
                          <div className="mt-0.5 flex items-center gap-1.5 font-body text-xs text-muted">
                            <ClockIcon className="h-3 w-3 flex-shrink-0" />
                            {p.hora_pericia}
                          </div>
                        )}
                      </td>

                      {/* Local / Perito */}
                      <td className="px-4 py-3.5">
                        <p className="max-w-[160px] truncate font-body text-sm text-fg">
                          {p.local_pericia ?? (
                            <span className="text-muted">—</span>
                          )}
                        </p>
                        {p.perito && (
                          <p className="max-w-[160px] truncate font-body text-xs text-muted">
                            {p.perito}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Resultado */}
                      <td className="px-4 py-3.5">
                        <ResultadoBadge resultado={p.resultado} />
                      </td>

                      {/* Ações */}
                      <td
                        className="px-5 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {p.status === "agendado" && (
                            <MarkRealizadoButton id={p.id} />
                          )}
                          <Link
                            href={`/dashboard/pericias/${p.id}`}
                            className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                          >
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="divide-y divide-border md:hidden">
              {paginated.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/pericias/${p.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-primary/5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardListIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-sm font-semibold text-fg">
                          {p.client_name}
                        </p>
                        <span
                          className={`flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${TIPO_COLORS[p.tipo]}`}
                        >
                          {TIPO_LABELS[p.tipo]}
                        </span>
                      </div>
                      <p className="font-body text-xs text-muted">
                        {p.data_pericia}
                        {p.hora_pericia ? ` · ${p.hora_pericia}` : ""}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="font-body text-xs text-muted">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} de{" "}
                  {filtered.length}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  {pageWindow(page, totalPages).map((n, i) =>
                    n === "…" ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="flex h-8 w-8 items-center justify-center font-body text-sm text-muted"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors cursor-pointer ${
                          page === n
                            ? "bg-primary text-white font-semibold"
                            : "border border-border text-muted hover:border-primary hover:text-primary"
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
