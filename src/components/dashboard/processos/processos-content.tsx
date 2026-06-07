"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Processo } from "@/lib/processos-db";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  UsersIcon,
  CalendarIcon,
  ChevronDownIcon,
  CogIcon,
  SlidersIcon,
  ArrowDownTrayIcon,
  ActivityIcon,
  PauseCircleIcon,
  ExclamationCircleIcon,
  BookmarkIcon,
  ArrowUpDownIcon,
  XMarkIcon,
  DocumentTextIcon,
} from "@/components/icons";
import ProcessosFiltroModal, {
  type FiltroAvancado,
  FILTRO_INICIAL,
  countFiltrosAtivos,
} from "./processos-filtro-modal";
import ProcessosSettingsModal, {
  useProcessosSettings,
} from "./processos-settings-modal";
import CadastroSimplesModal from "./cadastro-simples-modal";

// ── Helpers ────────────────────────────────────────────────────

const ESTAGIO_PROD: Record<string, { label: string; cls: string }> = {
  analise: { label: "Análise", cls: "bg-blue-50 text-blue-700" },
  producao: { label: "Produção", cls: "bg-teal-50 text-teal-700" },
  administrativo: {
    label: "Administrativo",
    cls: "bg-orange-50 text-orange-700",
  },
  judicial: { label: "Judicial", cls: "bg-purple-50 text-purple-700" },
  arquivado: { label: "Arquivado", cls: "bg-slate-100 text-slate-500" },
};

const AREA_COLORS: Record<string, string> = {
  Cível: "bg-blue-50 text-blue-600",
  Criminal: "bg-red-50 text-red-600",
  Trabalhista: "bg-orange-50 text-orange-600",
  Família: "bg-pink-50 text-pink-600",
  Previdenciário: "bg-purple-50 text-purple-600",
  Tributário: "bg-indigo-50 text-indigo-600",
  Administrativo: "bg-cyan-50 text-cyan-600",
  Consumidor: "bg-teal-50 text-teal-600",
  Imobiliário: "bg-emerald-50 text-emerald-600",
  Empresarial: "bg-violet-50 text-violet-600",
  Outro: "bg-slate-100 text-slate-500",
};

const STATUS_STYLES: Record<
  string,
  { dot: string; wrap: string; label: string }
> = {
  ativo: {
    dot: "bg-emerald-500",
    wrap: "bg-emerald-50 text-emerald-700",
    label: "Ativo",
  },
  em_andamento: {
    dot: "bg-blue-500",
    wrap: "bg-blue-50 text-blue-700",
    label: "Em andamento",
  },
  arquivado: {
    dot: "bg-amber-500",
    wrap: "bg-amber-50 text-amber-700",
    label: "Arquivado",
  },
  encerrado: {
    dot: "bg-slate-400",
    wrap: "bg-slate-100 text-slate-500",
    label: "Encerrado",
  },
};

function areaColor(area: string) {
  return AREA_COLORS[area] ?? "bg-slate-100 text-slate-500";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysDiff(date: Date | null): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Sub-components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: Processo["status"] }) {
  const s = STATUS_STYLES[status] ?? {
    dot: "bg-slate-400",
    wrap: "bg-slate-100 text-slate-500",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

type IndicadorKey = "todos" | "incompletos" | "movimentados" | "parados";
type StatusKey = "todos" | "ativo" | "em_andamento" | "arquivado" | "encerrado";
type SortKey = "updated_at" | "valor_causa" | "client_name" | "tipo_acao";
type SortDir = "asc" | "desc";

// ── Indicator card ─────────────────────────────────────────────

function IndicadorCard({
  label,
  count,
  active,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : color}`} />
        <span
          className={`font-body text-xs font-semibold uppercase tracking-wide ${active ? "text-primary" : "text-muted"}`}
        >
          {label}
        </span>
      </div>
      <span
        className={`font-heading text-2xl font-bold ${active ? "text-primary" : "text-fg"}`}
      >
        {count}
      </span>
    </button>
  );
}

// ── Dropdown wrapper ────────────────────────────────────────────

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

function SortButton({
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

interface ProcessosContentProps {
  processos: Processo[];
  clients: { id: string; name: string }[];
}

const QUICK_FILTERS_KEY = "advmartins:processos:quick-filters";

export default function ProcessosContent({
  processos,
  clients,
}: ProcessosContentProps) {
  const router = useRouter();
  const novoRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  // Settings
  const { settings, save: saveSettings } = useProcessosSettings();

  // Quick filters (localStorage) — lazy initializer avoids setState-in-effect
  const [quickFilters, setQuickFilters] = useState<
    Array<{ nome: string; filtros: FiltroAvancado }>
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(QUICK_FILTERS_KEY);
      return raw
        ? (JSON.parse(raw) as Array<{ nome: string; filtros: FiltroAvancado }>)
        : [];
    } catch {
      return [];
    }
  });

  function persistQuickFilters(qf: typeof quickFilters) {
    setQuickFilters(qf);
    try {
      localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(qf));
    } catch {}
  }

  // Filter state
  const [indicador, setIndicador] = useState<IndicadorKey>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("todos");
  const [search, setSearch] = useState("");
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltroAvancado | null>(
    null
  );

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // UI modals/dropdowns
  const [showFiltro, setShowFiltro] = useState(false);
  const [filtroLocal, setFiltroLocal] =
    useState<FiltroAvancado>(FILTRO_INICIAL);
  const [showSettings, setShowSettings] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (novoRef.current && !novoRef.current.contains(e.target as Node))
        setShowNovo(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExport(false);
      if (quickRef.current && !quickRef.current.contains(e.target as Node))
        setShowQuick(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Indicator counts
  const indicadorCounts = useMemo(() => {
    const diasMov = settings.diasMovimentado;
    const diasPar = settings.diasParado;
    return {
      todos: processos.length,
      incompletos: processos.filter((p) => !p.numero || !p.vara).length,
      movimentados: processos.filter((p) => daysDiff(p.updated_at) <= diasMov)
        .length,
      parados: processos.filter(
        (p) =>
          p.status !== "arquivado" &&
          p.status !== "encerrado" &&
          daysDiff(p.updated_at) >= diasPar
      ).length,
    };
  }, [processos, settings]);

  // Status counts
  const statusCounts = useMemo(
    () => ({
      todos: processos.length,
      ativo: processos.filter((p) => p.status === "ativo").length,
      em_andamento: processos.filter((p) => p.status === "em_andamento").length,
      arquivado: processos.filter((p) => p.status === "arquivado").length,
      encerrado: processos.filter((p) => p.status === "encerrado").length,
    }),
    [processos]
  );

  // Filtered & sorted
  const filtered = useMemo(() => {
    const diasMov = settings.diasMovimentado;
    const diasPar = settings.diasParado;
    const q = search.toLowerCase().trim();
    const af = filtrosAtivos;

    let result = processos.filter((p) => {
      // Indicador
      if (indicador === "incompletos" && p.numero && p.vara) return false;
      if (indicador === "movimentados" && daysDiff(p.updated_at) > diasMov)
        return false;
      if (indicador === "parados") {
        if (p.status === "arquivado" || p.status === "encerrado") return false;
        if (daysDiff(p.updated_at) < diasPar) return false;
      }

      // Status
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;

      // Search
      if (q) {
        const match =
          p.tipo_acao.toLowerCase().includes(q) ||
          (p.numero ?? "").toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q) ||
          (p.parte_contraria ?? "").toLowerCase().includes(q) ||
          p.area.toLowerCase().includes(q) ||
          (p.vara ?? "").toLowerCase().includes(q) ||
          (p.comarca ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // Advanced filters
      if (af) {
        if (af.area && p.area !== af.area) return false;
        if (
          af.numeroProcesso &&
          !(p.numero ?? "")
            .toLowerCase()
            .includes(af.numeroProcesso.toLowerCase())
        )
          return false;
        if (
          af.assunto &&
          !p.tipo_acao.toLowerCase().includes(af.assunto.toLowerCase())
        )
          return false;
        if (af.cpfCnpj && !(p.parte_contraria_doc ?? "").includes(af.cpfCnpj))
          return false;
        if (af.valorAcaoMin) {
          const min = parseFloat(af.valorAcaoMin);
          if (!isNaN(min) && (p.valor_causa ?? 0) < min) return false;
        }
        if (af.valorAcaoMax) {
          const max = parseFloat(af.valorAcaoMax);
          if (!isNaN(max) && (p.valor_causa ?? 0) > max) return false;
        }
        if (af.dataInicio && p.data_distribuicao_iso) {
          if (p.data_distribuicao_iso < af.dataInicio) return false;
        }
        if (af.dataFim && p.data_distribuicao_iso) {
          if (p.data_distribuicao_iso > af.dataFim) return false;
        }
      }

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      let av: number | string = 0,
        bv: number | string = 0;
      if (sortKey === "client_name") {
        av = a.client_name;
        bv = b.client_name;
      } else if (sortKey === "tipo_acao") {
        av = a.tipo_acao;
        bv = b.tipo_acao;
      } else if (sortKey === "valor_causa") {
        av = a.valor_causa ?? 0;
        bv = b.valor_causa ?? 0;
      } else {
        av = a.updated_at?.getTime() ?? 0;
        bv = b.updated_at?.getTime() ?? 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    processos,
    indicador,
    statusFilter,
    search,
    filtrosAtivos,
    settings,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const valorTotal = filtered.reduce((s, p) => s + (p.valor_causa ?? 0), 0);
  const activeFiltrosCount = filtrosAtivos
    ? countFiltrosAtivos(filtrosAtivos)
    : 0;

  function handleSetIndicador(k: IndicadorKey) {
    setIndicador(k);
    setPage(1);
  }

  function handleSetStatus(k: StatusKey) {
    setStatusFilter(k);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleSort(k: SortKey, d: SortDir) {
    setSortKey(k);
    setSortDir(d);
    setPage(1);
  }

  function handleBuscarFiltro(f: FiltroAvancado) {
    setFiltrosAtivos(f);
    setFiltroLocal(f);
    setPage(1);
  }

  function handleLimparFiltro() {
    setFiltrosAtivos(null);
    setFiltroLocal(FILTRO_INICIAL);
    setPage(1);
  }

  function handleExportCSV() {
    const headers = [
      "ID",
      "Número CNJ",
      "Tipo de Ação",
      "Área",
      "Cliente",
      "Status",
      "Fase",
      "Vara",
      "Comarca",
      "Valor da Causa",
      "Parte Contrária",
      "Data Distribuição",
      "Produção",
    ];
    const rows = filtered.map((p) => [
      p.id,
      p.numero ?? "",
      p.tipo_acao,
      p.area,
      p.client_name,
      STATUS_STYLES[p.status]?.label ?? p.status,
      p.fase ?? "",
      p.vara ?? "",
      p.comarca ?? "",
      p.valor_causa ?? 0,
      p.parte_contraria ?? "",
      p.data_distribuicao ?? "",
      p.estagio_producao,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  function handleSaveQuickFilter(nome: string, f: FiltroAvancado) {
    const existing = quickFilters.filter((q) => q.nome !== nome);
    const next = [...existing, { nome, filtros: f }].slice(0, 10);
    persistQuickFilters(next);
  }

  function handleDeleteQuickFilter(nome: string) {
    persistQuickFilters(quickFilters.filter((q) => q.nome !== nome));
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

  const INDICADORES: {
    key: IndicadorKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    { key: "todos", label: "Todos", icon: FolderOpenIcon, color: "text-fg" },
    {
      key: "incompletos",
      label: "Incompletos",
      icon: ExclamationCircleIcon,
      color: "text-amber-500",
    },
    {
      key: "movimentados",
      label: "Movimentados",
      icon: ActivityIcon,
      color: "text-orange-500",
    },
    {
      key: "parados",
      label: "Parados",
      icon: PauseCircleIcon,
      color: "text-red-500",
    },
  ];

  const STATUS_TABS: { key: StatusKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "em_andamento", label: "Em andamento" },
    { key: "arquivado", label: "Arquivados" },
    { key: "encerrado", label: "Encerrados" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Indicator cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INDICADORES.map((ind) => (
          <IndicadorCard
            key={ind.key}
            label={ind.label}
            count={indicadorCounts[ind.key]}
            active={indicador === ind.key}
            icon={ind.icon}
            color={ind.color}
            onClick={() => handleSetIndicador(ind.key)}
          />
        ))}
      </div>

      {/* ── Main panel ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Pasta, nº processo, assunto ou envolvidos…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Novo processo */}
            <div ref={novoRef} className="relative">
              <button
                onClick={() => setShowNovo((p) => !p)}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
              >
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Novo processo</span>
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu open={showNovo}>
                <DropdownItem
                  icon={PlusIcon}
                  label="Cadastro simples"
                  description="Modal rápido de cadastro"
                  onClick={() => {
                    setShowNovo(false);
                    setShowCadastro(true);
                  }}
                />
                <DropdownItem
                  icon={DocumentTextIcon}
                  label="Cadastro avançado"
                  description="Formulário completo"
                  onClick={() => {
                    setShowNovo(false);
                    router.push("/dashboard/processos/novo");
                  }}
                />
                <div className="mx-2 my-1 border-t border-border" />
                <DropdownItem
                  icon={FolderOpenIcon}
                  label="Cadastro automático CNJ"
                  description="Busca e preenche via tribunal"
                  onClick={() => {
                    setShowNovo(false);
                    alert("Integração com CNJ disponível em breve.");
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
                        onClick={() => handleDeleteQuickFilter(qf.nome)}
                        className="cursor-pointer p-1 text-muted hover:text-red-500"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </DropdownMenu>
              </div>
            )}

            {/* Export */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExport((p) => !p)}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border bg-white px-3 font-body text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-fg"
                title="Exportar relatório"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              <DropdownMenu open={showExport}>
                <DropdownItem
                  icon={ArrowDownTrayIcon}
                  label="Exportar CSV"
                  description={`${filtered.length} processos`}
                  onClick={handleExportCSV}
                />
                <DropdownItem
                  icon={DocumentTextIcon}
                  label="Relatório simplificado"
                  description="Em desenvolvimento"
                  onClick={() => {
                    setShowExport(false);
                  }}
                  disabled
                />
              </DropdownMenu>
            </div>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted transition-colors hover:border-primary/40 hover:text-fg"
              title="Configurações de processos"
            >
              <CogIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status tabs + active filter chip */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-border px-5 py-2">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => {
              const active = statusFilter === t.key;
              const s = STATUS_STYLES[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => handleSetStatus(t.key)}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-muted hover:bg-slate-50 hover:text-fg"
                  }`}
                >
                  {s && (
                    <span
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                        active ? "bg-white/70" : s.dot
                      }`}
                    />
                  )}
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {statusCounts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active filter chip */}
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

        {/* Panel header summary */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpenIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-fg">
                {filtered.length}{" "}
                {filtered.length === 1 ? "processo" : "processos"}
                {valorTotal > 0 && (
                  <span className="ml-2 font-normal text-muted">
                    · {formatCurrency(valorTotal)} em causa
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderOpenIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              {search
                ? "Tente ajustar os termos da busca"
                : activeFiltrosCount > 0
                  ? "Ajuste ou limpe os filtros avançados"
                  : "Ajuste os filtros acima"}
            </p>
            {activeFiltrosCount > 0 && (
              <button
                onClick={handleLimparFiltro}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
            {indicador !== "todos" && (
              <button
                onClick={() => handleSetIndicador("todos")}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todos
              </button>
            )}
            {indicador === "todos" &&
              statusFilter === "todos" &&
              !search &&
              activeFiltrosCount === 0 && (
                <button
                  onClick={() => setShowCadastro(true)}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-cta px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
                >
                  <PlusIcon className="h-4 w-4" />
                  Cadastrar primeiro processo
                </button>
              )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left">
                      <SortButton
                        label="Processo"
                        sortKey="tipo_acao"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Cliente"
                        sortKey="client_name"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Vara / Comarca
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Distribuição
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Produção
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Valor"
                        sortKey="valor_causa"
                        current={sortKey}
                        dir={sortDir}
                        onChange={handleSort}
                      />
                    </th>
                    <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => {
                    const diasAtual = daysDiff(p.updated_at);
                    const parado =
                      diasAtual >= settings.diasParado &&
                      p.status !== "arquivado" &&
                      p.status !== "encerrado";
                    const movimentado = diasAtual <= settings.diasMovimentado;
                    return (
                      <tr
                        key={p.id}
                        onClick={() =>
                          router.push(`/dashboard/processos/${p.id}`)
                        }
                        className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                                parado
                                  ? "bg-red-50"
                                  : movimentado
                                    ? "bg-amber-50"
                                    : "bg-primary/10"
                              }`}
                            >
                              <FolderOpenIcon
                                className={`h-4 w-4 ${
                                  parado
                                    ? "text-red-400"
                                    : movimentado
                                      ? "text-amber-500"
                                      : "text-primary"
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              {p.numero ? (
                                <p className="font-mono text-xs text-muted">
                                  {p.numero}
                                </p>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-body text-[10px] font-semibold text-amber-600 bg-amber-50">
                                  <ExclamationCircleIcon className="h-2.5 w-2.5" />
                                  Sem CNJ
                                </span>
                              )}
                              <p className="truncate font-body text-sm font-semibold text-fg">
                                {p.tipo_acao}
                              </p>
                              <span
                                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${areaColor(p.area)}`}
                              >
                                {p.area}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/clientes/${p.client_id}`);
                            }}
                            className="flex cursor-pointer items-center gap-1.5 font-body text-sm text-fg hover:text-primary"
                          >
                            <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                            <span className="max-w-[140px] truncate">
                              {p.client_name}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-body text-sm">
                            {p.vara ? (
                              <span className="block max-w-[160px] truncate text-fg">
                                {p.vara}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                            {p.comarca && (
                              <span className="text-xs text-muted">
                                {p.comarca}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {p.data_distribuicao ? (
                            <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                              <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                              {p.data_distribuicao}
                            </span>
                          ) : (
                            <span className="font-body text-sm text-muted">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          {(() => {
                            const ep =
                              ESTAGIO_PROD[p.estagio_producao] ??
                              ESTAGIO_PROD["analise"];
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${ep.cls}`}
                              >
                                {ep.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-body text-sm text-muted">
                            {p.valor_causa
                              ? formatCurrency(p.valor_causa)
                              : "—"}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/processos/${p.id}`}
                              className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                            >
                              Abrir
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="divide-y divide-border md:hidden">
              {paginated.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FolderOpenIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-body text-sm font-semibold text-fg">
                          {p.tipo_acao}
                        </p>
                        <span
                          className={`flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${areaColor(p.area)}`}
                        >
                          {p.area}
                        </span>
                      </div>
                      <p className="truncate font-body text-xs text-muted">
                        {p.client_name}
                      </p>
                      {p.numero && (
                        <p className="font-mono text-xs text-slate-400">
                          {p.numero}
                        </p>
                      )}
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
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
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
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
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

      {/* ── Modals ────────────────────────────────────────────────── */}
      <ProcessosFiltroModal
        open={showFiltro}
        onClose={() => setShowFiltro(false)}
        filtros={filtroLocal}
        onBuscar={handleBuscarFiltro}
        onLimpar={handleLimparFiltro}
        savedFilters={quickFilters}
        onSaveFilter={handleSaveQuickFilter}
        onLoadFilter={(f) => {
          setFiltroLocal(f);
          setFiltrosAtivos(f);
        }}
        onDeleteSavedFilter={handleDeleteQuickFilter}
      />

      <ProcessosSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={saveSettings}
      />

      <CadastroSimplesModal
        open={showCadastro}
        onClose={() => setShowCadastro(false)}
        clients={clients}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
