"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Client } from "@/lib/clients-db";
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  UsersIcon,
  FolderOpenIcon,
  ChevronRightIcon,
} from "@/components/icons";

// ── Helpers ────────────────────────────────────────────────

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

const PAGE_SIZE = 8;

// ── Subcomponents ──────────────────────────────────────────

function StatusBadge({ status }: { status: Client["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
        status === "ativo"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "ativo" ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {status === "ativo" ? "Ativo" : "Inativo"}
    </span>
  );
}

function TypeBadge({ type }: { type: Client["type"] }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold tracking-wide ${
        type === "PF"
          ? "bg-blue-50 text-blue-600"
          : "bg-violet-50 text-violet-600"
      }`}
    >
      {type}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────

interface ClientsContentProps {
  clients: Client[];
}

type Filter = "todos" | "ativo" | "inativo";

export default function ClientsContent({ clients }: ClientsContentProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.doc.includes(q) ||
        c.city.toLowerCase().includes(q);
      const matchFilter = filter === "todos" || c.status === filter;
      return matchSearch && matchFilter;
    });
  }, [clients, search, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      todos: clients.length,
      ativo: clients.filter((c) => c.status === "ativo").length,
      inativo: clients.filter((c) => c.status === "inativo").length,
    }),
    [clients]
  );

  function handleFilter(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "ativo", label: "Ativos", count: counts.ativo },
    { key: "inativo", label: "Inativos", count: counts.inativo },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por nome, e-mail ou CPF/CNPJ…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <Link
          href="/dashboard/clientes/novo"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
        >
          <UserPlusIcon className="h-4 w-4" />
          Novo cliente
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
              filter === t.key
                ? "bg-primary text-white font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${
                filter === t.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-muted"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <UsersIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum cliente encontrado
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
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cidade/UF
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Processos
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Último contato
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
                      {/* Name + email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(c.name)}`}
                          >
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-body text-sm font-semibold text-fg">
                              {c.name}
                            </p>
                            <p className="truncate font-body text-xs text-muted">
                              {c.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-4">
                        <TypeBadge type={c.type} />
                      </td>
                      {/* City */}
                      <td className="px-4 py-4 font-body text-sm text-fg">
                        {c.city}/{c.state}
                      </td>
                      {/* Processes */}
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                          <FolderOpenIcon className="h-4 w-4 text-muted" />
                          {c.processes}
                        </span>
                      </td>
                      {/* Last contact */}
                      <td className="px-4 py-4 font-body text-sm text-muted">
                        {c.lastContact}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/clientes/${c.id}`}
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
                    href={`/dashboard/clientes/${c.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(c.name)}`}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-body text-sm font-semibold text-fg">
                          {c.name}
                        </p>
                        <TypeBadge type={c.type} />
                      </div>
                      <p className="truncate font-body text-xs text-muted">
                        {c.email}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <StatusBadge status={c.status} />
                        <span className="font-body text-xs text-muted">
                          {c.processes} processo{c.processes !== 1 ? "s" : ""}
                        </span>
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
