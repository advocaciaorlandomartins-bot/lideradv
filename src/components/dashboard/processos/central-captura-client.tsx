"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  WifiIcon,
  FolderOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertIcon,
  ClockIcon,
  BellAlertIcon,
  ActivityIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";

export type ProcessoCaptura = {
  id: string;
  processo_numero: string;
  tipo_acao: string;
  cliente: string;
  orgao: string;
  ultima_captura: string;
  status_captura: "sucesso" | "erro" | "desabilitado";
  movimentacoes: number;
  ativo: boolean;
};

type FiltroCaptura = "todos" | "ativos" | "movimentados" | "erro" | "inativos";

function KpiBtn({
  label,
  count,
  color,
  bg,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : `border-border ${bg} hover:border-primary/40`
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : color}`} />
        <p
          className={`font-body text-xs font-semibold uppercase tracking-wide ${
            active ? "text-primary" : "text-muted"
          }`}
        >
          {label}
        </p>
      </div>
      <p
        className={`font-heading text-2xl font-bold ${
          active ? "text-primary" : color
        }`}
      >
        {count}
      </p>
    </button>
  );
}

function CapturaStatusBadge({ status }: { status: string }) {
  if (status === "sucesso")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-700">
        <CheckCircleIcon className="h-3 w-3" />
        Cadastrado
      </span>
    );
  if (status === "erro")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Erro
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-slate-500">
      <ClockIcon className="h-3 w-3" />
      Inativo
    </span>
  );
}

export default function CentralCapturaClient({
  processos,
}: {
  processos: ProcessoCaptura[];
}) {
  const [filtro, setFiltro] = useState<FiltroCaptura>("todos");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      ativos: processos.filter((c) => c.ativo).length,
      movimentados: processos.reduce((s, c) => s + c.movimentacoes, 0),
      erro: processos.filter((c) => c.status_captura === "erro").length,
      inativos: processos.filter((c) => !c.ativo).length,
    }),
    [processos]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return processos.filter((c) => {
      if (filtro === "ativos" && !c.ativo) return false;
      if (filtro === "inativos" && c.ativo) return false;
      if (filtro === "movimentados" && c.movimentacoes === 0) return false;
      if (filtro === "erro" && c.status_captura !== "erro") return false;
      if (q) {
        return (
          c.tipo_acao.toLowerCase().includes(q) ||
          c.cliente.toLowerCase().includes(q) ||
          c.processo_numero.includes(q) ||
          c.orgao.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filtro, search, processos]);

  const KPIS: {
    key: FiltroCaptura;
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: "ativos",
      label: "Ativos",
      color: "text-primary",
      bg: "bg-primary/5",
      icon: WifiIcon,
    },
    {
      key: "movimentados",
      label: "Andamentos",
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: ActivityIcon,
    },
    {
      key: "erro",
      label: "Com erro",
      color: "text-red-600",
      bg: "bg-red-50",
      icon: AlertIcon,
    },
    {
      key: "inativos",
      label: "Inativos",
      color: "text-slate-500",
      bg: "bg-slate-50",
      icon: ClockIcon,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Central de Captura
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Processos cadastrados no sistema · {processos.length}{" "}
          {processos.length === 1 ? "processo" : "processos"} no total
        </p>
      </div>

      <ProcessosSubNav />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <WifiIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="font-body text-xs text-amber-800">
          <span className="font-semibold">Monitoramento automático:</span> a
          captura push de movimentações nos tribunais requer integração com API
          externa (e-SAJ, PJe, DataJud). Configure em{" "}
          <Link
            href="/dashboard/integracoes"
            className="font-semibold underline"
          >
            Integrações
          </Link>
          .
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((k) => (
          <KpiBtn
            key={k.key}
            label={k.label}
            count={counts[k.key as keyof typeof counts] ?? 0}
            color={k.color}
            bg={k.bg}
            icon={k.icon}
            active={filtro === k.key}
            onClick={() => setFiltro(filtro === k.key ? "todos" : k.key)}
          />
        ))}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <BellAlertIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                Processos cadastrados
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "processo" : "processos"} · atualizado
                em tempo real
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-52">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Buscar processo, cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {processos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <WifiIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo cadastrado
            </p>
            <Link
              href="/dashboard/processos/novo"
              className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
            >
              Cadastrar processo
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <WifiIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo encontrado
            </p>
            {filtro !== "todos" && (
              <button
                onClick={() => setFiltro("todos")}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((cap) => (
              <div
                key={cap.id}
                className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                  !cap.ativo ? "opacity-60" : ""
                }`}
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                    cap.ativo ? "bg-primary/10" : "bg-slate-100"
                  }`}
                >
                  <WifiIcon
                    className={`h-5 w-5 ${cap.ativo ? "text-primary" : "text-slate-400"}`}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-sm font-semibold text-fg">
                      {cap.tipo_acao || "Processo"}
                    </p>
                    <CapturaStatusBadge status={cap.status_captura} />
                    {cap.movimentacoes > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-body text-xs font-semibold text-amber-700">
                        <ActivityIcon className="h-3 w-3" />
                        {cap.movimentacoes}{" "}
                        {cap.movimentacoes > 1 ? "andamentos" : "andamento"}
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted">{cap.cliente}</p>
                  {cap.processo_numero && (
                    <p className="font-mono text-xs text-slate-400">
                      {cap.processo_numero}
                    </p>
                  )}
                  {cap.orgao && (
                    <p className="font-body text-xs text-muted">{cap.orgao}</p>
                  )}
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Atualizado: {cap.ultima_captura}
                  </div>
                  <Link
                    href={
                      cap.processo_numero
                        ? `/dashboard/processos?busca=${encodeURIComponent(cap.processo_numero)}`
                        : `/dashboard/processos`
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    Ver processo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
