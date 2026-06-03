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

const MOCK_CAPTURAS = [
  {
    id: "1",
    processo_numero: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    orgao: "JEF - 1ª Turma Recursal SP",
    ultima_captura: "03/06/2024 08:30",
    status_captura: "sucesso" as const,
    movimentacoes: 3,
    ativo: true,
  },
  {
    id: "2",
    processo_numero: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    orgao: "1ª Vara Cível de São Paulo",
    ultima_captura: "02/06/2024 14:15",
    status_captura: "sucesso" as const,
    movimentacoes: 1,
    ativo: true,
  },
  {
    id: "3",
    processo_numero: "5555555-11.2023.4.03.6183",
    tipo_acao: "B87 - BPC à pessoa com deficiência",
    cliente: "Carlos Eduardo Lima",
    orgao: "JEF - 7ª Vara Federal SP",
    ultima_captura: "01/06/2024 09:00",
    status_captura: "erro" as const,
    movimentacoes: 0,
    ativo: true,
  },
  {
    id: "4",
    processo_numero: "3333333-44.2022.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    orgao: "TRT 15ª Região",
    ultima_captura: "30/05/2024 11:45",
    status_captura: "desabilitado" as const,
    movimentacoes: 0,
    ativo: false,
  },
];

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
        Capturado
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

export default function CentralCapturaPage() {
  const [filtro, setFiltro] = useState<FiltroCaptura>("todos");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      ativos: MOCK_CAPTURAS.filter((c) => c.ativo).length,
      movimentados: MOCK_CAPTURAS.reduce((s, c) => s + c.movimentacoes, 0),
      erro: MOCK_CAPTURAS.filter((c) => c.status_captura === "erro").length,
      inativos: MOCK_CAPTURAS.filter((c) => !c.ativo).length,
    }),
    []
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MOCK_CAPTURAS.filter((c) => {
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
  }, [filtro, search]);

  const KPIS: {
    key: FiltroCaptura;
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: "ativos",
      label: "Monitorados",
      color: "text-primary",
      bg: "bg-primary/5",
      icon: WifiIcon,
    },
    {
      key: "movimentados",
      label: "Movimentações hoje",
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
          Monitoramento automático (Push) de movimentações processuais
        </p>
      </div>

      <ProcessosSubNav />

      {/* KPI cards clicáveis */}
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
                Processos monitorados
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "processo" : "processos"} · atualização
                a cada 24h
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

        {filtered.length === 0 ? (
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
                    cap.status_captura === "sucesso"
                      ? "bg-emerald-50"
                      : cap.status_captura === "erro"
                        ? "bg-red-50"
                        : "bg-slate-100"
                  }`}
                >
                  <WifiIcon
                    className={`h-5 w-5 ${
                      cap.status_captura === "sucesso"
                        ? "text-emerald-600"
                        : cap.status_captura === "erro"
                          ? "text-red-500"
                          : "text-slate-400"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-sm font-semibold text-fg">
                      {cap.tipo_acao}
                    </p>
                    <CapturaStatusBadge status={cap.status_captura} />
                    {cap.movimentacoes > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-body text-xs font-semibold text-amber-700">
                        <ActivityIcon className="h-3 w-3" />
                        {cap.movimentacoes} nova
                        {cap.movimentacoes > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted">{cap.cliente}</p>
                  <p className="font-mono text-xs text-slate-400">
                    {cap.processo_numero}
                  </p>
                  <p className="font-body text-xs text-muted">{cap.orgao}</p>
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Última: {cap.ultima_captura}
                  </div>
                  <Link
                    href={`/dashboard/processos?busca=${encodeURIComponent(cap.processo_numero)}`}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    Ver processo
                  </Link>
                  <button
                    className={`cursor-pointer rounded-lg border px-3 py-1 font-body text-xs font-semibold transition-colors ${
                      cap.ativo
                        ? "border-red-200 text-red-500 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {cap.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-4 text-center">
          <FolderOpenIcon className="h-4 w-4 text-slate-300" />
          <p className="font-body text-xs text-muted">
            Integração com tribunais em desenvolvimento. Dados ilustrativos.
          </p>
        </div>
      </div>
    </div>
  );
}
