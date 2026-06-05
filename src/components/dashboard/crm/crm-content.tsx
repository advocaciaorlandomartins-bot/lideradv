"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
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
  SpinnerIcon,
  ArchiveBoxIcon,
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

// ── Pipeline linear do CRM (fechado e perdido são terminais) ──────────────────
const PIPELINE_CRM: Estagio[] = [
  "novo_contato",
  "consulta_agendada",
  "em_analise",
  "proposta_enviada",
  "fechado",
];

// ── Stepper do CRM ────────────────────────────────────────────────────────────

function CrmStepper({ estagio }: { estagio: Estagio }) {
  const isPerdido = estagio === "perdido";
  const currentIdx = PIPELINE_CRM.indexOf(estagio);

  return (
    <div className="flex items-center gap-0">
      {PIPELINE_CRM.map((e, i) => {
        const meta = ESTAGIO_META[e];
        const isCurrent = e === estagio && !isPerdido;
        const isDone = !isPerdido && i < currentIdx;
        const isFuture = isPerdido ? true : i > currentIdx;

        return (
          <div key={e} className="flex items-center">
            <div
              title={meta.label}
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all
                ${isCurrent ? `${meta.dot} border-transparent text-white shadow-sm` : ""}
                ${isDone ? "border-transparent bg-slate-300 text-white" : ""}
                ${isFuture && !isCurrent ? "border-slate-200 bg-white text-slate-300" : ""}
              `}
            >
              {isDone ? (
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            {i < PIPELINE_CRM.length - 1 && (
              <div
                className={`h-0.5 w-4 ${i < currentIdx && !isPerdido ? "bg-slate-300" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
      <span
        className={`ml-2 font-body text-[10px] font-semibold ${isPerdido ? "text-slate-500" : ESTAGIO_META[estagio].color}`}
      >
        {isPerdido ? "Perdido" : ESTAGIO_META[estagio].label}
      </span>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const meta = ESTAGIO_META[lead.estagio];

  const currentIdx = PIPELINE_CRM.indexOf(lead.estagio);
  const prevEstagio = currentIdx > 0 ? PIPELINE_CRM[currentIdx - 1] : null;
  const nextEstagio =
    currentIdx >= 0 && currentIdx < PIPELINE_CRM.length - 1
      ? PIPELINE_CRM[currentIdx + 1]
      : null;

  function mover(alvo: Estagio, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await moveLeadEstagioAction(lead.id, alvo);
    });
  }

  return (
    <div
      onClick={() => router.push(`/dashboard/crm/leads/${lead.id}`)}
      className="cursor-pointer rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Stepper */}
      <div className="mb-2.5">
        <CrmStepper estagio={lead.estagio} />
      </div>

      {/* Dados */}
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
        <div className="mb-1 flex items-center gap-1">
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

      {/* Contadores */}
      {(lead.atividades_count > 0 || lead.tarefas_pendentes > 0) && (
        <div className="mt-1.5 flex items-center gap-2">
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
      )}

      {/* Botões avançar / voltar */}
      <div
        className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ← Voltar */}
        {prevEstagio && (
          <button
            onClick={(e) => mover(prevEstagio, e)}
            disabled={isPending}
            className="flex items-center gap-1 rounded px-1.5 py-1 font-body text-[11px] text-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            {isPending ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : (
              <svg
                className="h-3 w-3 rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            Voltar
          </button>
        )}

        <span className="flex-1" />

        {/* → Avançar */}
        {nextEstagio && lead.estagio !== "perdido" && (
          <button
            onClick={(e) => mover(nextEstagio, e)}
            disabled={isPending}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-body text-[11px] font-semibold transition-colors disabled:opacity-40
              ${ESTAGIO_META[nextEstagio].color} ${ESTAGIO_META[nextEstagio].bg} border-current/20 hover:opacity-80`}
          >
            {ESTAGIO_META[nextEstagio].label}
            {isPending ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : (
              <ChevronRightIcon className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Marcar como Perdido — disponível em qualquer etapa não terminal */}
        {lead.estagio !== "fechado" && lead.estagio !== "perdido" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startTransition(async () => {
                await moveLeadEstagioAction(lead.id, "perdido");
              });
            }}
            disabled={isPending}
            className="rounded px-1.5 py-1 font-body text-[10px] text-slate-400 transition-colors hover:text-red-500 disabled:opacity-40"
            title="Marcar como Perdido"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ estagio, leads }: { estagio: Estagio; leads: Lead[] }) {
  const meta = ESTAGIO_META[estagio];
  return (
    <div className="flex min-w-[240px] max-w-[280px] flex-1 flex-col rounded-xl border border-border bg-slate-50">
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

// Estágios ativos vs encerrados
const ESTAGIOS_ATIVOS: Estagio[] = [
  "novo_contato",
  "consulta_agendada",
  "em_analise",
  "proposta_enviada",
];
const ESTAGIOS_ENCERRADOS: Estagio[] = ["fechado", "perdido"];

// ── Funil Tab ──────────────────────────────────────────────────────────────────

function FunilTab({ leads }: { leads: Lead[] }) {
  const [showEncerrados, setShowEncerrados] = useState(false);

  const byEstagio = useMemo(() => {
    const map: Record<Estagio, Lead[]> = {} as Record<Estagio, Lead[]>;
    for (const e of ESTAGIOS) map[e] = [];
    for (const lead of leads) map[lead.estagio].push(lead);
    return map;
  }, [leads]);

  const estagiosVisiveis = showEncerrados
    ? [...ESTAGIOS_ATIVOS, ...ESTAGIOS_ENCERRADOS]
    : ESTAGIOS_ATIVOS;

  const totalEncerrados =
    byEstagio["fechado"].length + byEstagio["perdido"].length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowEncerrados((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm transition-colors ${
            showEncerrados
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted hover:border-primary hover:text-primary"
          }`}
        >
          <ArchiveBoxIcon className="h-4 w-4" />
          {showEncerrados
            ? "Ocultar Encerrados"
            : `Mostrar Encerrados${totalEncerrados > 0 ? ` (${totalEncerrados})` : ""}`}
        </button>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {estagiosVisiveis.map((estagio) => (
            <KanbanColumn
              key={estagio}
              estagio={estagio}
              leads={byEstagio[estagio]}
            />
          ))}
        </div>
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

function LeadsTab({
  leads,
  filter,
  onFilterChange,
}: {
  leads: Lead[];
  filter: EstagioFilter;
  onFilterChange: (f: EstagioFilter) => void;
}) {
  const router = useRouter();
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
    onFilterChange(f);
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

function StatsCards({
  leads,
  activeCard,
  onCard,
}: {
  leads: Lead[];
  activeCard: string | null;
  onCard: (card: string) => void;
}) {
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
    {
      key: "total",
      label: "Total de Leads",
      value: total,
      color: "text-fg",
      activeColor: "border-primary bg-primary/5",
    },
    {
      key: "ativos",
      label: "Em Andamento",
      value: ativos,
      color: "text-blue-600",
      activeColor: "border-blue-400 bg-blue-50",
    },
    {
      key: "convertidos",
      label: "Convertidos",
      value: fechados,
      color: "text-emerald-600",
      activeColor: "border-emerald-400 bg-emerald-50",
    },
    {
      key: "tarefas",
      label: "Tarefas Pendentes",
      value: tarefasPendentes,
      color: "text-orange-600",
      activeColor: "border-orange-400 bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const isActive = activeCard === s.key;
        return (
          <button
            key={s.key}
            onClick={() => onCard(s.key)}
            className={`cursor-pointer rounded-xl border-2 p-4 shadow-sm text-left transition-all hover:shadow-md ${
              isActive
                ? s.activeColor
                : "border-border bg-white hover:border-primary/40"
            }`}
          >
            <p className="font-body text-xs font-semibold text-muted">
              {s.label}
            </p>
            <p className={`mt-1 font-heading text-2xl font-bold ${s.color}`}>
              {s.value}
            </p>
            {isActive && (
              <p className="mt-1 font-body text-[10px] text-muted">
                clique para limpar
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CrmContent({ leads }: { leads: Lead[] }) {
  const [tab, setTab] = useState<TabKey>("funil");
  const [leadsFilter, setLeadsFilter] = useState<EstagioFilter>("todos");
  const [activeCard, setActiveCard] = useState<string | null>(null);

  function handleCard(card: string) {
    // toggle
    if (activeCard === card) {
      setActiveCard(null);
      setLeadsFilter("todos");
      return;
    }
    setActiveCard(card);

    if (card === "total") {
      setTab("leads");
      setLeadsFilter("todos");
    } else if (card === "ativos") {
      setTab("leads");
      setLeadsFilter("todos");
    } else if (card === "convertidos") {
      setTab("leads");
      setLeadsFilter("fechado");
    } else if (card === "tarefas") {
      // Tarefas ficam visíveis no funil (cada card mostra badge de tasks)
      setTab("funil");
    }
  }

  function handleLeadsFilter(f: EstagioFilter) {
    setLeadsFilter(f);
    // ao mudar manualmente o filtro, desmarca o card ativo
    if (f === "todos") setActiveCard(null);
    else if (f === "fechado") setActiveCard("convertidos");
    else setActiveCard(null);
  }

  return (
    <div className="space-y-5">
      <StatsCards leads={leads} activeCard={activeCard} onCard={handleCard} />

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
      {tab === "leads" && (
        <LeadsTab
          leads={leads}
          filter={leadsFilter}
          onFilterChange={handleLeadsFilter}
        />
      )}
    </div>
  );
}
