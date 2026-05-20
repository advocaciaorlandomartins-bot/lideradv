"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Colaborador } from "@/lib/colaboradores-db";
import { CARGO_LABELS, CARGO_COLORS } from "@/lib/colaboradores-types";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserPlusIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@/components/icons";

const PAGE_SIZE = 10;

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [cargoFilter, setCargoFilter] = useState<CargoFilter>("todos");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = useMemo(
    () => ({
      todos: colaboradores.length,
      ativo: colaboradores.filter((c) => c.status === "ativo").length,
      inativo: colaboradores.filter((c) => c.status === "inativo").length,
    }),
    [colaboradores]
  );

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por nome, e-mail ou OAB…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <Link
          href="/dashboard/colaboradores/novo"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
        >
          <PlusIcon className="h-4 w-4" />
          Novo colaborador
        </Link>
      </div>

      {/* Cargo filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCargoFilter("todos")}
          className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
            cargoFilter === "todos"
              ? "bg-primary text-white"
              : "border border-border bg-white text-muted hover:text-fg"
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
            <UserPlusIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum colaborador encontrado
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
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((c) => (
                    <tr
                      key={c.id}
                      className="group transition-colors duration-100 hover:bg-slate-50"
                    >
                      {/* Nome */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-body text-sm font-semibold text-primary">
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-body text-sm font-semibold text-fg">
                            {c.nome}
                          </p>
                        </div>
                      </td>
                      {/* Cargo */}
                      <td className="px-4 py-4">
                        <span
                          className={`rounded px-1.5 py-0.5 font-body text-xs font-semibold ${CARGO_COLORS[c.cargo]}`}
                        >
                          {CARGO_LABELS[c.cargo]}
                        </span>
                      </td>
                      {/* Contato */}
                      <td className="px-4 py-4">
                        <div className="font-body text-sm text-fg">
                          {c.email ? (
                            <p className="truncate max-w-[180px]">{c.email}</p>
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
                      {/* OAB */}
                      <td className="px-4 py-4">
                        <span className="font-body text-sm text-fg">
                          {c.oab ?? <span className="text-muted">—</span>}
                        </span>
                      </td>
                      {/* Admissão */}
                      <td className="px-4 py-4">
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
                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/colaboradores/${c.id}`}
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
              {paginated.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/colaboradores/${c.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-slate-50"
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
                          className={`flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${CARGO_COLORS[c.cargo]}`}
                        >
                          {CARGO_LABELS[c.cargo]}
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
