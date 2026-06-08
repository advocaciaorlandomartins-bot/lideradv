"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Colaborador } from "@/lib/colaboradores-db";
import {
  CARGO_LABELS,
  cargoColor,
  cargoLabel,
} from "@/lib/colaboradores-types";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserPlusIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@/components/icons";

function StatusBadge({ status }: { status: "ativo" | "inativo" }) {
  return status === "ativo" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-emerald-50 text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-slate-100 text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inativo
    </span>
  );
}

type StatusFilter = "todos" | "ativo" | "inativo";
type CargoFilter = "todos" | string;

interface Props {
  colaboradores: Colaborador[];
}

export default function ColaboradoresContent({ colaboradores }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [cargoFilter, setCargoFilter] = useState<CargoFilter>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statusCounts = useMemo(
    () => ({
      todos: colaboradores.length,
      ativo: colaboradores.filter((c) => c.status === "ativo").length,
      inativo: colaboradores.filter((c) => c.status === "inativo").length,
    }),
    [colaboradores]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return colaboradores.filter((c) => {
      const matchSearch =
        !q ||
        c.nome.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.oab ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchCargo = cargoFilter === "todos" || c.cargo === cargoFilter;
      return matchSearch && matchStatus && matchCargo;
    });
  }, [colaboradores, search, statusFilter, cargoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
    setPage(1);
  }
  function handleCargoFilter(f: CargoFilter) {
    setCargoFilter(f);
    setPage(1);
  }
  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "inativo", label: "Inativos" },
  ];

  const cargoOptions = Object.entries(CARGO_LABELS) as [string, string][];

  function pageWindow(): (number | "…")[] {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const left = Math.max(2, page - 2);
    const right = Math.min(totalPages - 1, page + 2);
    const pages: (number | "…")[] = [1];
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {statusTabs.map((t) => {
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
              <span
                className={`font-body text-sm font-semibold ${active ? "text-primary" : "text-muted"}`}
              >
                {t.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-body text-xs font-bold ${
                  active
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {statusCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="border-b border-border bg-slate-50 px-5 py-4 space-y-3">
          {/* Title row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <UserPlusIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-bold text-fg">
                  {statusFilter === "todos"
                    ? "Todos os Colaboradores"
                    : statusFilter === "ativo"
                      ? "Colaboradores Ativos"
                      : "Colaboradores Inativos"}
                </h2>
                <p className="font-body text-xs text-muted">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "colaborador" : "colaboradores"}
                  {cargoFilter !== "todos" && ` · ${cargoLabel(cargoFilter)}`}
                  {search ? ` para "${search}"` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  placeholder="Buscar nome, e-mail, OAB…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 sm:w-48 lg:w-56"
                />
              </div>
              <Link
                href="/dashboard/colaboradores/novo"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 whitespace-nowrap"
              >
                <PlusIcon className="h-4 w-4" />
                Novo colaborador
              </Link>
            </div>
          </div>

          {/* Cargo filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCargoFilter("todos")}
              className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                cargoFilter === "todos"
                  ? "bg-primary text-white"
                  : "border border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
              }`}
            >
              Todos os cargos
            </button>
            {cargoOptions.map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleCargoFilter(key)}
                className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  cargoFilter === key
                    ? "bg-primary text-white"
                    : "border border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <UserPlusIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum colaborador encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              {search
                ? "Tente ajustar os termos da busca"
                : "Ajuste os filtros acima"}
            </p>
            {(cargoFilter !== "todos" || statusFilter !== "todos") &&
              !search && (
                <button
                  onClick={() => {
                    handleStatusFilter("todos");
                    handleCargoFilter("todos");
                  }}
                  className="mt-1 cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            {cargoFilter === "todos" && statusFilter === "todos" && !search && (
              <Link
                href="/dashboard/colaboradores/novo"
                className="mt-2 flex items-center gap-2 rounded-lg bg-cta px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Cadastrar primeiro colaborador
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Colaborador
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Contato
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      OAB
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Admissão
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() =>
                        router.push(`/dashboard/colaboradores/${c.id}`)
                      }
                      className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-body text-sm font-semibold text-primary">
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-body text-sm font-semibold text-fg">
                            {c.nome}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-body text-xs font-semibold ${cargoColor(c.cargo)}`}
                        >
                          {cargoLabel(c.cargo)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-body text-sm text-fg">
                          {c.email ? (
                            <p className="max-w-[180px] truncate">{c.email}</p>
                          ) : null}
                          {c.telefone ? (
                            <p className="font-body text-xs text-muted">
                              {c.telefone}
                            </p>
                          ) : null}
                          {!c.email && !c.telefone && (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-body text-sm text-fg">
                        {c.oab ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.data_admissao ? (
                          <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                            {c.data_admissao}
                          </span>
                        ) : (
                          <span className="font-body text-sm text-muted">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td
                        className="px-5 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/colaboradores/${c.id}`}
                            className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                          >
                            Editar
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
              {paginated.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/colaboradores/${c.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-primary/5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-body text-sm font-semibold text-primary">
                      {c.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-body text-sm font-semibold text-fg">
                          {c.nome}
                        </p>
                        <span
                          className={`flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${cargoColor(c.cargo)}`}
                        >
                          {cargoLabel(c.cargo)}
                        </span>
                      </div>
                      {c.email && (
                        <p className="truncate font-body text-xs text-muted">
                          {c.email}
                        </p>
                      )}
                      <div className="mt-1">
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <div className="flex items-center gap-1">
                  <span className="mr-1 font-body text-xs text-muted">
                    Exibir:
                  </span>
                  {[10, 20, 50].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPageSize(s);
                        setPage(1);
                      }}
                      className={`h-7 min-w-[2rem] rounded px-1.5 font-body text-xs transition-colors cursor-pointer ${pageSize === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="mr-1 font-body text-xs text-muted">
                    {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, filtered.length)} de{" "}
                    {filtered.length}
                  </p>
                  {totalPages > 1 && (
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
                      {pageWindow().map((n, i) =>
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
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
