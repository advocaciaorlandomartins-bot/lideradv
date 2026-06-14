"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client } from "@/lib/clients-db";
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  UsersIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  SlidersIcon,
  ArrowUpDownIcon,
  XMarkIcon,
  ListBulletIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  BookmarkIcon,
  DocumentArrowUpIcon,
  CalendarIcon,
} from "@/components/icons";
import ClientesFiltroModal, {
  type FiltroCliente,
  FILTRO_CLIENTE_INICIAL,
  countFiltrosCliente,
} from "./clientes-filtro-modal";
import AiDocumentImport from "./ai-document-import";

// ── Helpers ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const QUICK_FILTERS_KEY = "advmartins:clientes:quick-filters";

// ── Sub-components ─────────────────────────────────────────────

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

type StatusFilter = "todos" | "ativo" | "inativo";
type SortKey = "name" | "city" | "processes" | "since";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "cards";

// ── KPI card ───────────────────────────────────────────────────

function KpiCard({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
      }`}
    >
      <span
        className={`font-body text-xs font-semibold uppercase tracking-wide ${
          active ? "text-primary" : "text-muted"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-heading text-2xl font-bold ${
          active ? "text-primary" : color
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ── Dropdown ───────────────────────────────────────────────────

function DropdownMenu({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg">
      {children}
    </div>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-muted" />}
      <div>
        <p className="font-body text-sm font-semibold text-fg">{label}</p>
        {description && (
          <p className="font-body text-xs text-muted">{description}</p>
        )}
      </div>
    </button>
  );
}

// ── Sort button ────────────────────────────────────────────────

function SortBtn({
  label,
  sortKey: sk,
  current,
  dir,
  onChange,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onChange: (k: SortKey, d: SortDir) => void;
}) {
  const active = current === sk;
  return (
    <button
      onClick={() => onChange(sk, active && dir === "asc" ? "desc" : "asc")}
      className={`flex cursor-pointer items-center gap-1 font-body text-xs font-semibold uppercase tracking-wide transition-colors ${
        active ? "text-primary" : "text-muted hover:text-fg"
      }`}
    >
      {label}
      <ArrowUpDownIcon
        className={`h-3 w-3 ${active ? "text-primary" : "text-slate-300"}`}
      />
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────

interface ClientsContentProps {
  clients: Client[];
}

export default function ClientsContent({ clients }: ClientsContentProps) {
  const router = useRouter();
  const novoRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltroCliente | null>(
    null
  );
  const [filtroLocal, setFiltroLocal] = useState<FiltroCliente>(
    FILTRO_CLIENTE_INICIAL
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showFiltro, setShowFiltro] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const [quickFilters, setQuickFilters] = useState<
    Array<{ nome: string; filtros: FiltroCliente }>
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(QUICK_FILTERS_KEY);
      return raw
        ? (JSON.parse(raw) as Array<{ nome: string; filtros: FiltroCliente }>)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    function handler(e: PointerEvent) {
      if (novoRef.current && !novoRef.current.contains(e.target as Node))
        setShowNovo(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExport(false);
      if (quickRef.current && !quickRef.current.contains(e.target as Node))
        setShowQuick(false);
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  function persistQuickFilters(qf: typeof quickFilters) {
    setQuickFilters(qf);
    try {
      localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(qf));
    } catch {}
  }

  // KPI counts
  const kpiCounts = useMemo(
    () => ({
      total: clients.length,
      pf: clients.filter((c) => c.type === "PF").length,
      pj: clients.filter((c) => c.type === "PJ").length,
      inativos: clients.filter((c) => c.status === "inativo").length,
      comProcessos: clients.filter((c) => c.processes > 0).length,
    }),
    [clients]
  );

  // Status counts for tabs
  const statusCounts = useMemo(
    () => ({
      todos: clients.length,
      ativo: clients.filter((c) => c.status === "ativo").length,
      inativo: clients.filter((c) => c.status === "inativo").length,
    }),
    [clients]
  );

  // Filtered + sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const af = filtrosAtivos;

    let result = clients.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;

      if (q) {
        const match =
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.doc.includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.trade_name ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }

      if (af) {
        if (af.tipo && c.type !== af.tipo) return false;
        if (af.status && c.status !== af.status) return false;
        if (af.estado && c.state !== af.estado) return false;
        if (af.comProcessos === "sim" && c.processes === 0) return false;
        if (af.comProcessos === "nao" && c.processes > 0) return false;
        if (af.cpfCnpj && !c.doc.includes(af.cpfCnpj.replace(/\D/g, "")))
          return false;
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      let av: string | number = "",
        bv: string | number = "";
      if (sortKey === "name") {
        av = a.name;
        bv = b.name;
      } else if (sortKey === "city") {
        av = a.city;
        bv = b.city;
      } else if (sortKey === "processes") {
        av = a.processes;
        bv = b.processes;
      } else {
        av = a.since;
        bv = b.since;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [clients, search, statusFilter, filtrosAtivos, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFiltrosCount = filtrosAtivos
    ? countFiltrosCliente(filtrosAtivos)
    : 0;

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }
  function handleStatus(s: StatusFilter) {
    setStatusFilter(s);
    setPage(1);
  }
  function handleSort(k: SortKey, d: SortDir) {
    setSortKey(k);
    setSortDir(d);
    setPage(1);
  }
  function handleBuscarFiltro(f: FiltroCliente) {
    setFiltrosAtivos(f);
    setFiltroLocal(f);
    setPage(1);
  }
  function handleLimparFiltro() {
    setFiltrosAtivos(null);
    setFiltroLocal(FILTRO_CLIENTE_INICIAL);
    setPage(1);
  }

  function handleExportCSV() {
    const headers = [
      "ID",
      "Nome",
      "Tipo",
      "CPF/CNPJ",
      "E-mail",
      "Telefone",
      "Cidade",
      "UF",
      "Processos",
      "Status",
      "Cliente desde",
    ];
    const rows = filtered.map((c) => [
      c.id,
      c.name,
      c.type,
      c.doc,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.processes,
      c.status === "ativo" ? "Ativo" : "Inativo",
      c.since,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

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

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "inativo", label: "Inativos" },
  ];

  const KPI_ITEMS = [
    {
      key: "todos" as const,
      label: "Total",
      count: kpiCounts.total,
      color: "text-fg",
    },
    {
      key: "pf" as const,
      label: "Pessoas Físicas",
      count: kpiCounts.pf,
      color: "text-blue-600",
    },
    {
      key: "pj" as const,
      label: "Pessoas Jurídicas",
      count: kpiCounts.pj,
      color: "text-violet-600",
    },
    {
      key: "inativos" as const,
      label: "Inativos",
      count: kpiCounts.inativos,
      color: "text-slate-500",
    },
    {
      key: "comProcessos" as const,
      label: "Com processos",
      count: kpiCounts.comProcessos,
      color: "text-emerald-600",
    },
  ];

  // KPI card click maps to status/type filter
  type KpiKey = "todos" | "pf" | "pj" | "inativos" | "comProcessos";
  const [activeKpi, setActiveKpi] = useState<KpiKey>("todos");

  function handleKpi(k: KpiKey) {
    setActiveKpi(k);
    setPage(1);
    if (k === "todos") {
      setStatusFilter("todos");
      setFiltrosAtivos(null);
      setFiltroLocal(FILTRO_CLIENTE_INICIAL);
    } else if (k === "inativos") {
      setStatusFilter("inativo");
    } else if (k === "pf") {
      setStatusFilter("todos");
      const f = { ...FILTRO_CLIENTE_INICIAL, tipo: "PF" as const };
      setFiltrosAtivos(f);
      setFiltroLocal(f);
    } else if (k === "pj") {
      setStatusFilter("todos");
      const f = { ...FILTRO_CLIENTE_INICIAL, tipo: "PJ" as const };
      setFiltrosAtivos(f);
      setFiltroLocal(f);
    } else if (k === "comProcessos") {
      setStatusFilter("todos");
      const f = { ...FILTRO_CLIENTE_INICIAL, comProcessos: "sim" as const };
      setFiltrosAtivos(f);
      setFiltroLocal(f);
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_ITEMS.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            count={k.count}
            active={activeKpi === k.key}
            color={k.color}
            onClick={() => handleKpi(k.key)}
          />
        ))}
      </div>

      {/* Main panel */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Nome, e-mail, CPF/CNPJ, cidade…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Novo cliente dropdown */}
            <div ref={novoRef} className="relative">
              <button
                onClick={() => setShowNovo((p) => !p)}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
              >
                <UserPlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Novo cliente</span>
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu open={showNovo}>
                <DropdownItem
                  icon={UsersIcon}
                  label="Cadastro completo"
                  description="Formulário detalhado"
                  onClick={() => {
                    setShowNovo(false);
                    router.push("/dashboard/clientes/novo");
                  }}
                />
                <DropdownItem
                  icon={DocumentArrowUpIcon}
                  label="Importar por documento"
                  description="IA extrai dados automaticamente"
                  onClick={() => {
                    setShowNovo(false);
                    setShowAiImport(true);
                  }}
                />
              </DropdownMenu>
            </div>

            {/* Filtros */}
            <button
              onClick={() => setShowFiltro(true)}
              className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 font-body text-sm font-semibold transition-colors ${
                activeFiltrosCount > 0
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
              }`}
            >
              <SlidersIcon className="h-4 w-4" />
              Filtros
              {activeFiltrosCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-body text-[10px] font-bold text-white">
                  {activeFiltrosCount}
                </span>
              )}
            </button>

            {/* Quick filters */}
            {quickFilters.length > 0 && (
              <div ref={quickRef} className="relative">
                <button
                  onClick={() => setShowQuick((p) => !p)}
                  className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border bg-white px-3 font-body text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-fg"
                >
                  <BookmarkIcon className="h-4 w-4" />
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                <DropdownMenu open={showQuick}>
                  <div className="px-3 py-1.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-muted">
                      Filtros salvos
                    </p>
                  </div>
                  {quickFilters.map((qf) => (
                    <div key={qf.nome} className="flex items-center gap-1 px-2">
                      <button
                        onClick={() => {
                          setFiltroLocal(qf.filtros);
                          setFiltrosAtivos(qf.filtros);
                          setShowQuick(false);
                        }}
                        className="flex-1 cursor-pointer px-2 py-2 text-left font-body text-sm text-fg hover:text-primary"
                      >
                        {qf.nome}
                      </button>
                      <button
                        onClick={() =>
                          persistQuickFilters(
                            quickFilters.filter((q) => q.nome !== qf.nome)
                          )
                        }
                        className="cursor-pointer p-1 text-muted hover:text-red-500"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </DropdownMenu>
              </div>
            )}

            {/* Aniversários */}
            <Link
              href="/dashboard/clientes/aniversarios"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3 font-body text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-fg"
              title="Aniversários"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Aniversários</span>
            </Link>

            {/* Export */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExport((p) => !p)}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border bg-white px-3 font-body text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-fg"
                title="Exportar"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              <DropdownMenu open={showExport}>
                <DropdownItem
                  icon={ArrowDownTrayIcon}
                  label="Exportar CSV"
                  description={`${filtered.length} clientes`}
                  onClick={handleExportCSV}
                />
              </DropdownMenu>
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-border bg-white">
              <button
                onClick={() => setViewMode("table")}
                title="Vista tabela"
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-lg transition-colors ${
                  viewMode === "table"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-fg"
                }`}
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                title="Vista cards"
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-lg border-l border-border transition-colors ${
                  viewMode === "cards"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-fg"
                }`}
              >
                <UsersIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status tabs + chip */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-border px-5 py-2">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => {
              const active = statusFilter === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    handleStatus(t.key);
                    setActiveKpi(
                      t.key === "todos"
                        ? "todos"
                        : t.key === "inativo"
                          ? "inativos"
                          : "todos"
                    );
                  }}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-muted hover:bg-slate-50 hover:text-fg"
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}
                  >
                    {statusCounts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
          {activeFiltrosCount > 0 && (
            <button
              onClick={handleLimparFiltro}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary hover:bg-red-50 hover:text-red-600"
            >
              <XMarkIcon className="h-3 w-3" />
              Limpar filtros ({activeFiltrosCount})
            </button>
          )}
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <UsersIcon className="h-4 w-4 text-primary" />
          </div>
          <p className="font-body text-sm font-semibold text-fg">
            {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
            {search && (
              <span className="font-normal text-muted">
                {" "}
                para &quot;{search}&quot;
              </span>
            )}
          </p>
        </div>

        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <UsersIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum cliente encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              {search
                ? "Tente ajustar os termos da busca"
                : "Ajuste os filtros"}
            </p>
            {activeFiltrosCount > 0 && (
              <button
                onClick={handleLimparFiltro}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left">
                      <SortBtn
                        label="Cliente"
                        sortKey="name"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Contato
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortBtn
                        label="Cidade/UF"
                        sortKey="city"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortBtn
                        label="Processos"
                        sortKey="processes"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortBtn
                        label="Desde"
                        sortKey="since"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
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
                      onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                      className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                    >
                      <td className="px-5 py-3.5">
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
                            {c.trade_name && (
                              <p className="truncate font-body text-xs text-muted">
                                {c.trade_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <TypeBadge type={c.type} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="truncate font-body text-xs text-muted max-w-[160px]">
                            {c.email}
                          </p>
                          <p className="font-body text-xs text-muted">
                            {c.phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-body text-sm text-fg">
                        {c.city}/{c.state}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`flex items-center gap-1.5 font-body text-sm ${c.processes > 0 ? "text-primary" : "text-muted"}`}
                        >
                          <FolderOpenIcon className="h-4 w-4" />
                          {c.processes}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-body text-sm text-muted">
                        {c.since}
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
                            href={`/dashboard/clientes/${c.id}`}
                            className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                          >
                            Abrir
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (always) */}
            <ul className="divide-y divide-border md:hidden">
              {paginated.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/clientes/${c.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
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
          </>
        ) : (
          /* Card grid view */
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginated.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                className="group cursor-pointer rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-body text-base font-bold ${avatarColor(c.name)}`}
                  >
                    {initials(c.name)}
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-body text-sm font-semibold text-fg">
                      {c.name}
                    </p>
                    <TypeBadge type={c.type} />
                  </div>
                  {c.trade_name && (
                    <p className="mt-0.5 truncate font-body text-xs text-muted">
                      {c.trade_name}
                    </p>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <MailIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate font-body">{c.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <PhoneIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-body">{c.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-body">
                      {c.city}/{c.state}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span
                    className={`flex items-center gap-1 font-body text-xs font-semibold ${c.processes > 0 ? "text-primary" : "text-muted"}`}
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    {c.processes} processo{c.processes !== 1 ? "s" : ""}
                  </span>
                  <span className="font-body text-xs text-muted">
                    {c.since}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <div className="flex items-center gap-1">
              <span className="mr-1 font-body text-xs text-muted">Exibir:</span>
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
                  {["«", "‹"].map((lbl, i) => (
                    <button
                      key={lbl}
                      onClick={() =>
                        setPage(i === 0 ? 1 : (p) => Math.max(1, p - 1))
                      }
                      disabled={page === 1}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {lbl}
                    </button>
                  ))}
                  {pageWindow().map((n, i) =>
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
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg font-body text-sm transition-colors ${
                          page === n
                            ? "bg-primary font-semibold text-white"
                            : "border border-border text-muted hover:border-primary hover:text-primary"
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  {["›", "»"].map((lbl, i) => (
                    <button
                      key={lbl}
                      onClick={() =>
                        setPage(
                          i === 0
                            ? (p) => Math.min(totalPages, p + 1)
                            : totalPages
                        )
                      }
                      disabled={page === totalPages}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Import Modal */}
      {showAiImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <AiDocumentImport
                compact
                onClose={() => setShowAiImport(false)}
                onSuccess={() => {
                  setShowAiImport(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ClientesFiltroModal
        open={showFiltro}
        onClose={() => setShowFiltro(false)}
        filtros={filtroLocal}
        onBuscar={handleBuscarFiltro}
        onLimpar={handleLimparFiltro}
        savedFilters={quickFilters}
        onSaveFilter={(nome, f) => {
          const next = [
            ...quickFilters.filter((q) => q.nome !== nome),
            { nome, filtros: f },
          ].slice(0, 10);
          persistQuickFilters(next);
        }}
        onDeleteSaved={(nome) =>
          persistQuickFilters(quickFilters.filter((q) => q.nome !== nome))
        }
      />
    </div>
  );
}
