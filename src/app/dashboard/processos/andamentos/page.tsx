"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  ClipboardListIcon,
  CalendarIcon,
  FolderOpenIcon,
  ActivityIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";

const MOCK_ANDAMENTOS = [
  {
    id: "1",
    data: "03/06/2024",
    hora: "10:22",
    processo_numero: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    descricao:
      "Decisão: Recurso do INSS não provido. Mantida a concessão do benefício.",
    tipo_andamento: "Decisão",
    orgao: "JEF - 1ª Turma Recursal SP",
    responsavel: "Dr. Orlando Martins",
    lido: false,
    hoje: true,
  },
  {
    id: "2",
    data: "02/06/2024",
    hora: "15:45",
    processo_numero: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    descricao:
      "Juntada de documentos requeridos. Aguardando nova designação de audiência.",
    tipo_andamento: "Juntada",
    orgao: "1ª Vara Cível de São Paulo",
    responsavel: "Dr. Orlando Martins",
    lido: true,
    hoje: false,
  },
  {
    id: "3",
    data: "01/06/2024",
    hora: "09:11",
    processo_numero: "1111111-00.2024.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    descricao:
      "Audiência realizada. Partes intimadas para apresentar alegações finais em 15 dias.",
    tipo_andamento: "Audiência",
    orgao: "TRT 15ª Região",
    responsavel: "Dr. Orlando Martins",
    lido: true,
    hoje: false,
  },
  {
    id: "4",
    data: "31/05/2024",
    hora: "14:30",
    processo_numero: "5555555-11.2023.4.03.6183",
    tipo_acao: "B87 - BPC à pessoa com deficiência",
    cliente: "Carlos Eduardo Lima",
    descricao:
      "Expedição de ofício ao INSS para apresentação de relatório médico pericial.",
    tipo_andamento: "Ofício",
    orgao: "JEF - 7ª Vara Federal SP",
    responsavel: "Dra. Assistente",
    lido: true,
    hoje: false,
  },
];

const TIPO_COLORS: Record<string, string> = {
  Decisão: "bg-purple-50 text-purple-700",
  Juntada: "bg-blue-50 text-blue-700",
  Audiência: "bg-orange-50 text-orange-700",
  Ofício: "bg-teal-50 text-teal-700",
  Despacho: "bg-indigo-50 text-indigo-700",
  Sentença: "bg-emerald-50 text-emerald-700",
};

type FiltroAndamento = "todos" | "hoje" | "nao_lidos" | "esta_semana";

function KpiBtn({
  label,
  count,
  color,
  bg,
  icon: Icon,
  active,
  onClick,
  href,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `block cursor-pointer rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
    active
      ? "border-primary bg-primary/5 shadow-sm"
      : `border-border ${bg} hover:border-primary/40`
  }`;

  const inner = (
    <>
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : color}`} />
        <p
          className={`font-body text-xs font-semibold uppercase tracking-wide ${active ? "text-primary" : "text-muted"}`}
        >
          {label}
        </p>
      </div>
      <p
        className={`font-heading text-2xl font-bold ${active ? "text-primary" : color}`}
      >
        {count}
      </p>
    </>
  );

  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function groupByDate(items: typeof MOCK_ANDAMENTOS) {
  const groups: Record<string, typeof MOCK_ANDAMENTOS> = {};
  for (const a of items) {
    if (!groups[a.data]) groups[a.data] = [];
    groups[a.data].push(a);
  }
  return groups;
}

export default function AndamentosPage() {
  const [filtro, setFiltro] = useState<FiltroAndamento>("todos");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      hoje: MOCK_ANDAMENTOS.filter((a) => a.hoje).length,
      nao_lidos: MOCK_ANDAMENTOS.filter((a) => !a.lido).length,
      esta_semana: MOCK_ANDAMENTOS.length,
      processos: new Set(MOCK_ANDAMENTOS.map((a) => a.processo_numero)).size,
    }),
    []
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MOCK_ANDAMENTOS.filter((a) => {
      if (filtro === "hoje" && !a.hoje) return false;
      if (filtro === "nao_lidos" && a.lido) return false;
      if (q) {
        return (
          a.tipo_acao.toLowerCase().includes(q) ||
          a.cliente.toLowerCase().includes(q) ||
          a.processo_numero.includes(q) ||
          a.descricao.toLowerCase().includes(q) ||
          a.tipo_andamento.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filtro, search]);

  const groups = groupByDate(filtered);

  const KPIS = [
    {
      key: "hoje" as const,
      label: "Hoje",
      count: counts.hoje,
      color: "text-primary",
      bg: "bg-primary/5",
      icon: CalendarIcon,
      href: undefined,
    },
    {
      key: "nao_lidos" as const,
      label: "Não lidos",
      count: counts.nao_lidos,
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: ActivityIcon,
      href: undefined,
    },
    {
      key: "esta_semana" as const,
      label: "Esta semana",
      count: counts.esta_semana,
      color: "text-fg",
      bg: "bg-white",
      icon: ClipboardListIcon,
      href: undefined,
    },
    {
      key: "processos" as const,
      label: "Processos",
      count: counts.processos,
      color: "text-muted",
      bg: "bg-slate-50",
      icon: FolderOpenIcon,
      href: "/dashboard/processos" as string | undefined,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Andamentos Processuais
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {counts.nao_lidos > 0
            ? `${counts.nao_lidos} andamento${counts.nao_lidos > 1 ? "s" : ""} não lido${counts.nao_lidos > 1 ? "s" : ""}`
            : `${MOCK_ANDAMENTOS.length} andamentos registrados esta semana`}
        </p>
      </div>

      <ProcessosSubNav />

      {/* KPI cards clicáveis */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((k) => (
          <KpiBtn
            key={k.key}
            label={k.label}
            count={k.count}
            color={k.color}
            bg={k.bg}
            icon={k.icon}
            active={filtro === k.key}
            href={k.href}
            onClick={
              k.href
                ? undefined
                : () => {
                    const fk = k.key as FiltroAndamento;
                    setFiltro(filtro === fk ? "todos" : fk);
                  }
            }
          />
        ))}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardListIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                Linha do tempo
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "andamento" : "andamentos"} · ordenados
                por data
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-52">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Buscar processo, tipo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <ClipboardListIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum andamento encontrado
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
            {Object.entries(groups).map(([data, andamentos]) => (
              <div key={data}>
                {/* Date separator */}
                <div className="flex items-center gap-3 bg-slate-50/70 px-5 py-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                  <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                    {data}
                  </span>
                  <div className="flex-1 border-t border-border" />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[10px] font-bold text-slate-500">
                    {andamentos.length}
                  </span>
                </div>

                {andamentos.map((and) => (
                  <div
                    key={and.id}
                    className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                      !and.lido ? "border-l-4 border-primary" : ""
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                        and.lido ? "bg-slate-100" : "bg-primary/10"
                      }`}
                    >
                      {and.lido ? (
                        <CheckCircleIcon className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ActivityIcon className="h-5 w-5 text-primary" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                            TIPO_COLORS[and.tipo_andamento] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {and.tipo_andamento}
                        </span>
                        {!and.lido && (
                          <span className="inline-block rounded-full bg-primary px-2 py-0.5 font-body text-[10px] font-bold text-white">
                            Novo
                          </span>
                        )}
                        {and.hoje && (
                          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 font-body text-[10px] font-bold text-amber-700">
                            Hoje
                          </span>
                        )}
                      </div>
                      <p className="font-body text-sm font-semibold text-fg">
                        {and.tipo_acao}
                      </p>
                      <p className="font-body text-sm leading-relaxed text-muted">
                        {and.descricao}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className="flex items-center gap-1 font-body text-xs text-muted">
                          <UsersIcon className="h-3.5 w-3.5" />
                          {and.cliente}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {and.processo_numero}
                        </span>
                      </div>
                      <p className="font-body text-xs text-muted">
                        {and.orgao}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {and.hora}
                      </div>
                      <p className="font-body text-xs text-muted">
                        {and.responsavel}
                      </p>
                      <Link
                        href={`/dashboard/processos?busca=${encodeURIComponent(and.processo_numero)}`}
                        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        <FolderOpenIcon className="h-3.5 w-3.5" />
                        Ver processo
                      </Link>
                    </div>
                  </div>
                ))}
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
