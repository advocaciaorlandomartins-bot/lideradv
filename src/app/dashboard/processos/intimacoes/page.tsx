"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  InboxArrowDownIcon,
  CalendarIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";

// ── Mock data (substituir por dados reais quando integração judicial disponível)

const MOCK_INTIMACOES = [
  {
    id: "1",
    processo_numero: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    orgao: "JEF - 1ª Turma Recursal SP",
    data_publicacao: "30/05/2024",
    data_prazo: "14/06/2024",
    dias_restantes: 14,
    tipo: "Intimação para manifestação",
    status: "pendente" as const,
  },
  {
    id: "2",
    processo_numero: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    orgao: "1ª Vara Cível de São Paulo",
    data_publicacao: "28/05/2024",
    data_prazo: "12/06/2024",
    dias_restantes: 12,
    tipo: "Intimação para audiência",
    status: "lida" as const,
  },
  {
    id: "3",
    processo_numero: "1111111-00.2024.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    orgao: "TRT 15ª Região",
    data_publicacao: "26/05/2024",
    data_prazo: "05/06/2024",
    dias_restantes: 5,
    tipo: "Decisão para recurso",
    status: "urgente" as const,
  },
];

type Status = "todos" | "pendente" | "urgente" | "lida";

// ── KPI card clicável ────────────────────────────────────────

function KpiBtn({
  label,
  count,
  color,
  bg,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
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
      <p
        className={`font-body text-xs font-semibold uppercase tracking-wide ${
          active ? "text-primary" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          active ? "text-primary" : color
        }`}
      >
        {count}
      </p>
    </button>
  );
}

// ── Status badge ─────────────────────────────────────────────

function StatusChip({ status, dias }: { status: string; dias: number }) {
  if (status === "urgente" || dias <= 5)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Urgente · {dias}d restantes
      </span>
    );
  if (status === "lida")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-slate-500">
        <CheckIcon className="h-3 w-3" />
        Lida
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-body text-xs font-semibold text-amber-700">
      <ClockIcon className="h-3 w-3" />
      Pendente · {dias}d restantes
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function IntimacoesPage() {
  const [filtro, setFiltro] = useState<Status>("todos");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      todos: MOCK_INTIMACOES.length,
      pendente: MOCK_INTIMACOES.filter((i) => i.status === "pendente").length,
      urgente: MOCK_INTIMACOES.filter((i) => i.status === "urgente").length,
      lida: MOCK_INTIMACOES.filter((i) => i.status === "lida").length,
    }),
    []
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MOCK_INTIMACOES.filter((i) => {
      if (filtro !== "todos" && i.status !== filtro) return false;
      if (q) {
        return (
          i.tipo_acao.toLowerCase().includes(q) ||
          i.cliente.toLowerCase().includes(q) ||
          i.processo_numero.includes(q) ||
          i.tipo.toLowerCase().includes(q) ||
          i.orgao.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filtro, search]);

  const KPIS: { key: Status; label: string; color: string; bg: string }[] = [
    { key: "todos", label: "Total", color: "text-fg", bg: "bg-white" },
    {
      key: "pendente",
      label: "Pendentes",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      key: "urgente",
      label: "Urgentes",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    { key: "lida", label: "Lidas", color: "text-slate-500", bg: "bg-slate-50" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Intimações
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {counts.pendente + counts.urgente} intimações aguardando resposta
        </p>
      </div>

      <ProcessosSubNav />

      {/* KPI cards clicáveis */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((k) => (
          <KpiBtn
            key={k.key}
            label={k.label}
            count={counts[k.key]}
            color={k.color}
            bg={k.bg}
            active={filtro === k.key}
            onClick={() => setFiltro(filtro === k.key ? "todos" : k.key)}
          />
        ))}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <InboxArrowDownIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                {filtro === "todos"
                  ? "Todas as intimações"
                  : filtro === "lida"
                    ? "Intimações lidas"
                    : filtro === "urgente"
                      ? "Intimações urgentes"
                      : "Intimações pendentes"}
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "intimação" : "intimações"} · ordenadas
                por prazo
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
            <InboxArrowDownIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma intimação encontrada
            </p>
            {filtro !== "todos" && (
              <button
                onClick={() => setFiltro("todos")}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todas
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((intim) => (
              <div
                key={intim.id}
                className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                  intim.status === "urgente"
                    ? "border-l-4 border-red-400"
                    : intim.status === "pendente"
                      ? "border-l-4 border-amber-400"
                      : ""
                }`}
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                    intim.status === "urgente"
                      ? "bg-red-50"
                      : intim.status === "lida"
                        ? "bg-slate-100"
                        : "bg-amber-50"
                  }`}
                >
                  <InboxArrowDownIcon
                    className={`h-5 w-5 ${
                      intim.status === "urgente"
                        ? "text-red-500"
                        : intim.status === "lida"
                          ? "text-slate-400"
                          : "text-amber-600"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-sm font-semibold text-fg">
                      {intim.tipo}
                    </p>
                    <StatusChip
                      status={intim.status}
                      dias={intim.dias_restantes}
                    />
                  </div>
                  <p className="font-body text-sm text-fg">{intim.tipo_acao}</p>
                  <p className="font-body text-xs text-muted">
                    {intim.cliente}
                  </p>
                  <p className="font-mono text-xs text-slate-400">
                    {intim.processo_numero}
                  </p>
                  <p className="font-body text-xs text-muted">{intim.orgao}</p>
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Publicado: {intim.data_publicacao}
                  </div>
                  <div
                    className={`flex items-center gap-1.5 font-body text-xs font-semibold ${
                      intim.dias_restantes <= 5 ? "text-red-600" : "text-fg"
                    }`}
                  >
                    <ClockIcon className="h-3.5 w-3.5" />
                    Prazo: {intim.data_prazo}
                  </div>
                  <Link
                    href={`/dashboard/processos?busca=${encodeURIComponent(intim.processo_numero)}`}
                    className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    Ver processo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-4 text-center">
          <FolderOpenIcon className="h-4 w-4 text-slate-300" />
          <p className="font-body text-xs text-muted">
            Integração com sistema judicial em desenvolvimento. Dados
            ilustrativos.
          </p>
        </div>
      </div>
    </div>
  );
}
