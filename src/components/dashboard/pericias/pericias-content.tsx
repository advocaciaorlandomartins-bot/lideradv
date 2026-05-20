"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
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

function StatusBadge({ status }: { status: Pericia["status"] }) {
  const styles = {
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
  const s = styles[status];
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
  const styles = {
    favoravel: "bg-emerald-50 text-emerald-700",
    desfavoravel: "bg-red-50 text-red-700",
    pendente: "bg-slate-100 text-slate-600",
    inconclusivo: "bg-amber-50 text-amber-700",
  };
  const labels = {
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

type StatusFilter =
  | "todos"
  | "agendado"
  | "realizado"
  | "cancelado"
  | "remarcado";
type TipoFilter = "todos" | string;

interface Props {
  pericias: Pericia[];
}

export default function PericiasContent({ pericias }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [page, setPage] = useState(1);

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

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "agendado", label: "Agendados" },
    { key: "realizado", label: "Realizados" },
    { key: "remarcado", label: "Remarcados" },
    { key: "cancelado", label: "Cancelados" },
  ];

  const tipoOptions = Object.entries(TIPO_LABELS) as [string, string][];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por cliente, perito ou local…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <Link
          href="/dashboard/pericias/nova"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
        >
          <PlusIcon className="h-4 w-4" />
          Nova perícia
        </Link>
      </div>

      {/* Tipo filter */}
      <div className="flex flex-wrap gap-2">
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

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleStatusFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
              statusFilter === t.key
                ? "bg-primary text-white font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${
                statusFilter === t.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-muted"
              }`}
            >
              {statusCounts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ClipboardListIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma perícia encontrada
            </p>
            <p className="font-body text-xs text-slate-400">
              Tente ajustar a busca ou os filtros
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
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
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      className="group transition-colors duration-100 hover:bg-slate-50"
                    >
                      {/* Tipo */}
                      <td className="px-5 py-4">
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
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/clientes/${p.client_id}`}
                          className="flex items-center gap-1.5 font-body text-sm text-fg hover:text-primary transition-colors duration-150"
                        >
                          <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                          <span className="truncate max-w-[140px]">
                            {p.client_name}
                          </span>
                        </Link>
                      </td>
                      {/* Data */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-body text-sm text-fg">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted flex-shrink-0" />
                          {p.data_pericia}
                        </div>
                        {p.hora_pericia && (
                          <div className="flex items-center gap-1.5 font-body text-xs text-muted mt-0.5">
                            <ClockIcon className="h-3 w-3 flex-shrink-0" />
                            {p.hora_pericia}
                          </div>
                        )}
                      </td>
                      {/* Local / Perito */}
                      <td className="px-4 py-4">
                        <p className="font-body text-sm text-fg truncate max-w-[160px]">
                          {p.local_pericia ?? (
                            <span className="text-muted">—</span>
                          )}
                        </p>
                        {p.perito && (
                          <p className="font-body text-xs text-muted truncate max-w-[160px]">
                            {p.perito}
                          </p>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={p.status} />
                          {p.status === "agendado" && (
                            <MarkRealizadoButton id={p.id} />
                          )}
                        </div>
                      </td>
                      {/* Resultado */}
                      <td className="px-4 py-4">
                        <ResultadoBadge resultado={p.resultado} />
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/pericias/${p.id}`}
                          className="flex items-center gap-1 font-body text-sm font-semibold text-primary opacity-0 transition-opacity duration-150 hover:text-primary-dark group-hover:opacity-100 focus:opacity-100"
                        >
                          Ver
                          <ChevronRightIcon className="h-4 w-4" />
                        </Link>
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
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardListIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors duration-150 cursor-pointer ${
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ›
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
