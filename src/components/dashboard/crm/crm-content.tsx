"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FunnelIcon,
  ClipboardListIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  MailIcon,
  TagIcon,
  ChevronRightIcon,
} from "@/components/icons";
import {
  ESTAGIOS,
  ESTAGIO_META,
  type Lead,
  type Estagio,
} from "@/lib/crm-types";
import { moveLeadEstagioAction } from "@/lib/crm-actions";

type TabKey = "funil" | "leads";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "funil", label: "Funil de Vendas", icon: FunnelIcon },
  { key: "leads", label: "Lista de Leads", icon: ClipboardListIcon },
];

type EstagioFilter = Estagio | "todos";

const PAGE_SIZE = 15;

function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const left = Math.max(2, page - 2);
  const right = Math.min(totalPages - 1, page + 2);
  const acc: (number | "…")[] = [1];
  if (left > 2) acc.push("…");
  for (let i = left; i <= right; i++) acc.push(i);
  if (right < totalPages - 1) acc.push("…");
  acc.push(totalPages);
  return acc;
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const meta = ESTAGIO_META[lead.estagio];
  return (
    <div
      onClick={() => router.push(`/dashboard/crm/leads/${lead.id}`)}
      className="cursor-pointer rounded-lg border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-body text-sm font-semibold text-fg leading-tight line-clamp-2">
          {lead.nome}
        </p>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 font-body text-[10px] font-medium ${meta.color} ${meta.bg}`}
        >
          {lead.tipo}
        </span>
      </div>

      {lead.area_interesse && (
        <div className="mb-1.5 flex items-center gap-1">
          <TagIcon className="h-3 w-3 text-muted" />
          <span className="font-body text-xs text-muted">
            {lead.area_interesse}
          </span>
        </div>
      )}

      {lead.telefone && (
        <div className="flex items-center gap-1">
          <PhoneIcon className="h-3 w-3 text-muted" />
          <span className="font-body text-xs text-muted">{lead.telefone}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="font-body text-[11px] text-muted">
          {lead.created_at}
        </span>
        <div className="flex items-center gap-2">
          {lead.atividades_count > 0 && (
            <span className="font-body text-[11px] text-muted">
              {lead.atividades_count} ativ.
            </span>
          )}
          {lead.tarefas_pendentes > 0 && (
            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 font-body text-[10px] font-semibold text-orange-700">
              {lead.tarefas_pendentes} task
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ estagio, leads }: { estagio: Estagio; leads: Lead[] }) {
  const meta = ESTAGIO_META[estagio];
  return (
    <div className="flex min-w-[220px] max-w-[260px] flex-1 flex-col rounded-xl border border-border bg-slate-50">
      <div
        className={`flex items-center gap-2 rounded-t-xl border-b border-border px-3 py-2.5 ${meta.bg}`}
      >
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className={`font-body text-sm font-semibold ${meta.color}`}>
          {meta.label}
        </span>
        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white font-body text-xs font-bold text-fg shadow-sm">
          {leads.length}
        </span>
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto p-2"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        {leads.length === 0 && (
          <p className="py-6 text-center font-body text-xs text-muted">
            Nenhum lead
          </p>
        )}
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

// ── Funil Tab ──────────────────────────────────────────────────────────────────

function FunilTab({ leads }: { leads: Lead[] }) {
  const byEstagio = useMemo(() => {
    const map: Record<Estagio, Lead[]> = {} as Record<Estagio, Lead[]>;
    for (const e of ESTAGIOS) map[e] = [];
    for (const lead of leads) map[lead.estagio].push(lead);
    return map;
  }, [leads]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: "max-content" }}>
        {ESTAGIOS.map((estagio) => (
          <KanbanColumn
            key={estagio}
            estagio={estagio}
            leads={byEstagio[estagio]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Move Stage Button ─────────────────────────────────────────────────────────

function MoveEstagioButton({ lead }: { lead: Lead }) {
  const [isPending, startTransition] = useTransition();
  const currentIdx = ESTAGIOS.indexOf(lead.estagio);
  const nextEstagio = ESTAGIOS[currentIdx + 1] as Estagio | undefined;

  if (!nextEstagio || lead.estagio === "fechado" || lead.estagio === "perdido")
    return null;

  const nextMeta = ESTAGIO_META[nextEstagio];

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        startTransition(() => moveLeadEstagioAction(lead.id, nextEstagio));
      }}
      disabled={isPending}
      title={`Mover para: ${nextMeta.label}`}
      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-body text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
    >
      <ChevronRightIcon className="h-3.5 w-3.5" />
      {nextMeta.label}
    </button>
  );
}

// ── Leads List Tab ─────────────────────────────────────────────────────────────

function LeadsTab({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<EstagioFilter>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (filter !== "todos" && l.estagio !== filter) return false;
      if (
        q &&
        !l.nome.toLowerCase().includes(q) &&
        !(l.email ?? "").toLowerCase().includes(q) &&
        !(l.telefone ?? "").includes(q)
      )
        return false;
      return true;
    });
  }, [leads, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function handleFilterChange(f: EstagioFilter) {
    setFilter(f);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const counts: Record<EstagioFilter, number> = useMemo(() => {
    const q = search.toLowerCase();
    const base = leads.filter((l) => {
      if (
        q &&
        !l.nome.toLowerCase().includes(q) &&
        !(l.email ?? "").toLowerCase().includes(q) &&
        !(l.telefone ?? "").includes(q)
      )
        return false;
      return true;
    });
    const m: Record<string, number> = { todos: base.length };
    for (const e of ESTAGIOS) m[e] = base.filter((l) => l.estagio === e).length;
    return m as Record<EstagioFilter, number>;
  }, [leads, search]);

  const pages = pageWindow(safePage, totalPages);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-base font-semibold text-fg">
            {filter === "todos"
              ? "Todos os Leads"
              : ESTAGIO_META[filter as Estagio].label}
          </h2>
          <div className="relative ml-auto">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar leads..."
              className="h-8 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <Link
            href="/dashboard/crm/leads/novo"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Novo Lead
          </Link>
        </div>
        {/* Stage filter pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["todos", ...ESTAGIOS] as EstagioFilter[]).map((f) => {
            const active = filter === f;
            const meta = f !== "todos" ? ESTAGIO_META[f as Estagio] : null;
            return (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white border border-border text-muted hover:border-primary hover:text-primary"
                }`}
              >
                {meta && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : meta.dot}`}
                  />
                )}
                {f === "todos" ? "Todos" : meta!.label}
                <span
                  className={`rounded-full px-1 font-semibold ${active ? "bg-white/20" : "bg-slate-100"}`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Nome
              </th>
              <th className="hidden px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted md:table-cell">
                Contato
              </th>
              <th className="hidden px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted lg:table-cell">
                Área
              </th>
              <th className="hidden px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted sm:table-cell">
                Estágio
              </th>
              <th className="hidden px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted xl:table-cell">
                Responsável
              </th>
              <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center font-body text-sm text-muted"
                >
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {slice.map((lead) => {
              const meta = ESTAGIO_META[lead.estagio];
              return (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/dashboard/crm/leads/${lead.id}`)}
                  className="cursor-pointer transition-colors hover:bg-primary/5"
                >
                  <td className="px-5 py-3">
                    <p className="font-body text-sm font-medium text-fg">
                      {lead.nome}
                    </p>
                    {lead.empresa && (
                      <p className="font-body text-xs text-muted">
                        {lead.empresa}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5 sm:hidden">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-xs font-medium ${meta.color} ${meta.bg}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        />
                        {meta.label}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    {lead.telefone && (
                      <div className="flex items-center gap-1.5">
                        <PhoneIcon className="h-3.5 w-3.5 text-muted" />
                        <span className="font-body text-sm text-fg">
                          {lead.telefone}
                        </span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MailIcon className="h-3.5 w-3.5 text-muted" />
                        <span className="font-body text-xs text-muted truncate max-w-[160px]">
                          {lead.email}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="hidden px-5 py-3 lg:table-cell">
                    <span className="font-body text-sm text-fg">
                      {lead.area_interesse ?? "—"}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-medium ${meta.color} ${meta.bg}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                      />
                      {meta.label}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 xl:table-cell">
                    <span className="font-body text-sm text-fg">
                      {lead.responsavel_nome ?? "—"}
                    </span>
                  </td>
                  <td
                    className="px-5 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <MoveEstagioButton lead={lead} />
                      <Link
                        href={`/dashboard/crm/leads/${lead.id}`}
                        className="rounded-lg border border-border px-2.5 py-1 font-body text-xs text-muted transition-colors hover:border-primary hover:text-primary"
                      >
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="font-body text-sm text-muted">
            {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} de{" "}
            {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              ‹
            </button>
            {pages.map((n, i) =>
              n === "…" ? (
                <span
                  key={`e-${i}`}
                  className="flex h-8 w-8 items-center justify-center font-body text-sm text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors ${
                    n === safePage
                      ? "bg-primary font-semibold text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats Cards ────────────────────────────────────────────────────────────────

function StatsCards({ leads }: { leads: Lead[] }) {
  const total = leads.length;
  const ativos = leads.filter(
    (l) => l.estagio !== "fechado" && l.estagio !== "perdido"
  ).length;
  const fechados = leads.filter((l) => l.estagio === "fechado").length;
  const tarefasPendentes = leads.reduce(
    (acc, l) => acc + l.tarefas_pendentes,
    0
  );

  const stats = [
    { label: "Total de Leads", value: total, color: "text-fg" },
    { label: "Em Andamento", value: ativos, color: "text-blue-600" },
    { label: "Convertidos", value: fechados, color: "text-green-600" },
    {
      label: "Tarefas Pendentes",
      value: tarefasPendentes,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border bg-white p-4 shadow-sm"
        >
          <p className="font-body text-xs text-muted">{s.label}</p>
          <p className={`mt-1 font-heading text-2xl font-bold ${s.color}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CrmContent({ leads }: { leads: Lead[] }) {
  const [tab, setTab] = useState<TabKey>("funil");

  return (
    <div className="space-y-5">
      <StatsCards leads={leads} />

      {/* Tab cards */}
      <div className="flex gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 font-body text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
        <Link
          href="/dashboard/crm/leads/novo"
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Lead
        </Link>
      </div>

      {tab === "funil" && <FunilTab leads={leads} />}
      {tab === "leads" && <LeadsTab leads={leads} />}
    </div>
  );
}
