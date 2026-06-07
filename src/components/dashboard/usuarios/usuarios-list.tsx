"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheckIcon,
  PlusIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";
import DeleteUsuarioButton from "@/components/dashboard/usuarios/delete-usuario-button";
import type { Usuario } from "@/lib/usuarios-types";

// ── Helpers ────────────────────────────────────────────────

const CATEGORIA_COLORS: Record<string, string> = {
  "Sócio(a)": "bg-violet-50 text-violet-700 border-violet-200",
  "Advogado(a)": "bg-blue-50   text-blue-700   border-blue-200",
  "Estagiário(a)": "bg-amber-50  text-amber-700  border-amber-200",
  "Colaborador(a)": "bg-slate-100 text-slate-600  border-slate-200",
  "Administrador(a)": "bg-red-50    text-red-700    border-red-200",
};

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100   text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100  text-amber-700",
  "bg-rose-100   text-rose-700",
  "bg-cyan-100   text-cyan-700",
];

function avatarColor(login: string) {
  return AVATAR_COLORS[login.charCodeAt(0) % AVATAR_COLORS.length];
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Agora mesmo";
  if (m < 60) return `Há ${m} min`;
  if (h < 24) return `Há ${h}h`;
  if (d < 30) return `Há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

function absoluteTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Types ──────────────────────────────────────────────────

type Filter = "todos" | "ativo" | "inativo";

interface Props {
  usuarios: Usuario[];
}

// ── Component ──────────────────────────────────────────────

export default function UsuariosList({ usuarios }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      todos: usuarios.length,
      ativo: usuarios.filter((u) => u.ativo).length,
      inativo: usuarios.filter((u) => !u.ativo).length,
    }),
    [usuarios]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return usuarios.filter((u) => {
      const matchFilter =
        filter === "todos" ||
        (filter === "ativo" && u.ativo) ||
        (filter === "inativo" && !u.ativo);
      const matchSearch =
        !q ||
        u.login.toLowerCase().includes(q) ||
        u.nome.toLowerCase().includes(q) ||
        u.categoria.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [usuarios, filter, search]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "inativo", label: "Inativos" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Status filter tabs ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setFilter(t.key);
              }}
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
                className={`rounded-full px-2 py-0.5 font-body text-xs font-bold ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Panel ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheckIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                {filter === "todos"
                  ? "Todos os Usuários"
                  : filter === "ativo"
                    ? "Usuários Ativos"
                    : "Usuários Inativos"}
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length} usuário{filtered.length !== 1 ? "s" : ""}
                {" · "}
                {counts.ativo} ativo{counts.ativo !== 1 ? "s" : ""}
                {search ? ` · busca: "${search}"` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Buscar login, nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-44 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <Link
              href="/dashboard/usuarios/novo"
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 font-body text-sm font-semibold text-white transition-colors whitespace-nowrap bg-cta hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
            >
              <PlusIcon className="h-4 w-4" />
              Novo usuário
            </Link>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldCheckIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              {search
                ? "Nenhum usuário encontrado"
                : filter !== "todos"
                  ? `Nenhum usuário ${filter === "ativo" ? "ativo" : "inativo"}`
                  : "Nenhum usuário cadastrado"}
            </p>
            <p className="font-body text-xs text-slate-400">
              {search ? "Tente ajustar a busca" : "Ajuste os filtros acima"}
            </p>
            {!search && filter !== "todos" && (
              <button
                onClick={() => setFilter("todos")}
                className="mt-1 cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todos
              </button>
            )}
            {filter === "todos" && !search && (
              <Link
                href="/dashboard/usuarios/novo"
                className="mt-2 flex items-center gap-2 rounded-lg bg-cta px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Criar primeiro usuário
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/50">
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Usuário
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Validade
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Último acesso
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
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/dashboard/usuarios/${u.id}`)}
                    className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                  >
                    {/* Usuário */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(u.login)} ${!u.ativo ? "opacity-50" : ""}`}
                        >
                          {u.login.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`font-body text-sm font-semibold ${u.ativo ? "text-fg" : "text-muted"}`}
                          >
                            {u.login}
                          </p>
                          <p className="truncate font-body text-xs text-muted">
                            {u.nome}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Categoria */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-xs font-semibold ${CATEGORIA_COLORS[u.categoria] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                      >
                        {u.categoria}
                      </span>
                    </td>

                    {/* Validade */}
                    <td className="px-4 py-3.5 font-body text-sm text-muted">
                      {u.validade ? (
                        new Date(u.validade).toLocaleDateString("pt-BR")
                      ) : (
                        <span className="text-slate-300">Sem prazo</span>
                      )}
                    </td>

                    {/* Último acesso */}
                    <td className="px-4 py-3.5 font-body text-sm text-muted">
                      {u.ultimo_acesso ? (
                        <span title={absoluteTime(u.ultimo_acesso)}>
                          {relativeTime(u.ultimo_acesso)}
                        </span>
                      ) : (
                        <span className="text-slate-300">Nunca</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${u.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${u.ativo ? "bg-emerald-500" : "bg-slate-400"}`}
                        />
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    {/* Ações */}
                    <td
                      className="px-5 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/usuarios/${u.id}`}
                          className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                        >
                          Editar
                        </Link>
                        <DeleteUsuarioButton id={u.id} login={u.login} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
