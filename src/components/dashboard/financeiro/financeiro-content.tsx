"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Lancamento, LancamentoKpis } from "@/lib/lancamentos-db";
import {
  markAsPagoAction,
  deleteLancamentoAction,
  deleteGrupoAction,
  reagendarLancamentoAction,
} from "@/lib/lancamento-actions";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  TrendUpIcon,
  TrendDownIcon,
  CalendarIcon,
  SpinnerIcon,
  UsersIcon,
} from "@/components/icons";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDMY(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function ddmmyyyyToISO(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function matchesSearch(l: Lancamento, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  return (
    l.descricao.toLowerCase().includes(lq) ||
    (l.client_name ?? "").toLowerCase().includes(lq) ||
    (l.categoria ?? "").toLowerCase().includes(lq)
  );
}

type DatePreset = "todos" | "hoje" | "mes" | "mes_anterior" | "ano" | "custom";
type MainTab = "pendentes" | "concluidas";
type LancamentoWithSaldo = Lancamento & { saldoAcumulado: number };

function getPresetRange(preset: DatePreset): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth(),
    d = now.getDate();
  if (preset === "hoje")
    return { from: new Date(y, m, d), to: new Date(y, m, d) };
  if (preset === "mes")
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  if (preset === "mes_anterior")
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  if (preset === "ano")
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  return { from: null, to: null };
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ano", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-heading text-2xl font-semibold text-fg">
        {fmt(value)}
      </p>
      {sub && <p className="mt-0.5 font-body text-xs text-muted">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Lancamento["status"] }) {
  const styles = {
    pendente: "bg-amber-50 text-amber-700",
    pago: "bg-emerald-50 text-emerald-700",
    cancelado: "bg-slate-100 text-slate-500",
  };
  const labels = { pendente: "Pendente", pago: "Pago", cancelado: "Cancelado" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function TipoIndicator({
  tipo,
  isPessoal,
}: {
  tipo: Lancamento["tipo"];
  isPessoal: boolean;
}) {
  if (isPessoal) {
    return (
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 font-body text-sm font-bold text-purple-700">
        R$
      </span>
    );
  }
  return (
    <span
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${
        tipo === "entrada"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-600"
      }`}
    >
      {tipo === "entrada" ? "+" : "−"}
    </span>
  );
}

function SectionHeading({
  title,
  count,
  accent = "slate",
}: {
  title: string;
  count: number;
  accent?: "red" | "blue" | "slate";
}) {
  const titleColor = {
    red: "text-red-600",
    blue: "text-primary",
    slate: "text-fg",
  }[accent];
  const badgeStyle = {
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-primary",
    slate: "bg-slate-100 text-muted",
  }[accent];
  return (
    <div className="flex items-center gap-2.5">
      <h3 className={`font-heading text-sm font-semibold ${titleColor}`}>
        {title}
      </h3>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs font-semibold ${badgeStyle}`}
      >
        {count}
      </span>
    </div>
  );
}

// ── RowActions ────────────────────────────────────────────────────────────────

function RowActions({
  lancamento,
  canEdit,
}: {
  lancamento: Lancamento;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState(false);
  const [novaData, setNovaData] = useState(() =>
    ddmmyyyyToISO(lancamento.data_vencimento)
  );

  function handlePago() {
    setAction("pago");
    startTransition(async () => {
      await markAsPagoAction(lancamento.id);
      router.refresh();
      setAction(null);
    });
  }

  function handleReagendar() {
    if (!novaData) return;
    setAction("reagendar");
    startTransition(async () => {
      await reagendarLancamentoAction(lancamento.id, novaData);
      router.refresh();
      setAction(null);
      setReagendando(false);
    });
  }

  function handleDelete() {
    if (lancamento.grupo_parcelas) {
      const choice = confirm(
        `Este lançamento faz parte de um grupo.\n\n• OK = excluir TODOS\n• Cancelar = excluir só este`
      );
      if (choice) {
        setAction("del");
        startTransition(async () => {
          await deleteGrupoAction(lancamento.grupo_parcelas!);
          router.refresh();
          setAction(null);
        });
        return;
      }
    } else {
      const msg = lancamento.remuneracao_id
        ? "Este lançamento é uma remuneração. Excluir também remove o registro. Confirmar?"
        : "Excluir este lançamento?";
      if (!confirm(msg)) return;
    }
    setAction("del");
    startTransition(async () => {
      await deleteLancamentoAction(lancamento.id);
      router.refresh();
      setAction(null);
    });
  }

  const loading = isPending && action !== null;

  return (
    <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
      {lancamento.status === "pendente" && (
        <>
          <button
            onClick={handlePago}
            disabled={loading}
            className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
          >
            {loading && action === "pago" ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : null}
            {lancamento.tipo === "entrada" ? "Recebi" : "Paguei"}
          </button>
          {!reagendando ? (
            <button
              onClick={() => setReagendando(true)}
              className="flex items-center gap-1 rounded-md border border-border bg-slate-50 px-2.5 py-1 font-body text-xs font-semibold text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
            >
              <CalendarIcon className="h-3 w-3" />
              Reagendar
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="h-7 rounded border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
              />
              <button
                onClick={handleReagendar}
                disabled={loading || !novaData}
                className="rounded-md bg-primary px-2 py-1 font-body text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {loading && action === "reagendar" ? "…" : "OK"}
              </button>
              <button
                onClick={() => setReagendando(false)}
                className="rounded-md bg-slate-100 px-2 py-1 font-body text-xs text-muted hover:bg-slate-200 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
      {canEdit && lancamento.status !== "cancelado" && (
        <Link
          href={`/dashboard/financeiro/${lancamento.id}/editar`}
          className="flex items-center gap-1 rounded-md border border-border bg-slate-50 px-2.5 py-1 font-body text-xs font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-primary"
        >
          Abrir
        </Link>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="font-body text-xs font-semibold text-red-500 transition-colors hover:text-red-700 disabled:opacity-40 cursor-pointer"
      >
        {loading && action === "del" ? "…" : "Excluir"}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  lancamentos: Lancamento[];
  kpis: LancamentoKpis;
  canEdit: boolean;
}

const PAGE_SIZE = 10;

export default function FinanceiroContent({ lancamentos, canEdit }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>("pendentes");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [saldoInicialStr, setSaldoInicialStr] = useState("0");
  const [pageConcluidas, setPageConcluidas] = useState(1);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const currentMonthSummary = useMemo(() => {
    const now = new Date();
    const yy = now.getFullYear(),
      mm = now.getMonth();
    const label = now.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    let recebido = 0,
      pago = 0;
    for (const l of lancamentos) {
      if (l.status !== "pago") continue;
      const refStr = l.data_pagamento ?? l.data_vencimento;
      const d = parseDMY(refStr);
      if (d.getFullYear() === yy && d.getMonth() === mm) {
        if (l.tipo === "entrada") recebido += l.valor;
        else if (l.tipo === "saida") pago += l.valor;
      }
    }
    return { recebido, pago, saldo: recebido - pago, label };
  }, [lancamentos]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const yy = d.getFullYear(),
        mm = d.getMonth();
      const month = d
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(". ", "/")
        .replace(".", "");
      let receitas = 0,
        despesas = 0;
      for (const l of lancamentos) {
        const ld = parseDMY(l.data_vencimento);
        if (ld.getFullYear() === yy && ld.getMonth() === mm) {
          if (l.tipo === "entrada") receitas += l.valor;
          else if (l.tipo === "saida") despesas += l.valor;
        }
      }
      return { month, receitas, despesas };
    });
  }, [lancamentos]);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59") : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const dateFiltered = useMemo(() => {
    return lancamentos.filter((l) => {
      if (!dateRange.from && !dateRange.to) return true;
      // Paid items: filter by payment date; pending/cancelled: filter by due date
      const refStr =
        l.status === "pago" && l.data_pagamento
          ? l.data_pagamento
          : l.data_vencimento;
      const ref = parseDMY(refStr);
      if (dateRange.from && ref < dateRange.from) return false;
      if (dateRange.to && ref > dateRange.to) return false;
      return true;
    });
  }, [lancamentos, dateRange]);

  const filteredKpis = useMemo(() => {
    let aReceber = 0,
      recebido = 0,
      aPagar = 0,
      pago = 0,
      folhaPendente = 0,
      folhaPaga = 0;
    for (const l of dateFiltered) {
      if (l.tipo === "entrada") {
        if (l.status === "pendente") aReceber += l.valor;
        else if (l.status === "pago") recebido += l.valor;
      } else if (l.tipo === "saida") {
        if (l.status === "pendente") aPagar += l.valor;
        else if (l.status === "pago") pago += l.valor;
        if (l.remuneracao_id !== null) {
          if (l.status === "pendente") folhaPendente += l.valor;
          else if (l.status === "pago") folhaPaga += l.valor;
        }
      }
    }
    return { aReceber, recebido, aPagar, pago, folhaPendente, folhaPaga };
  }, [dateFiltered]);

  const saldo = filteredKpis.recebido - filteredKpis.pago;
  const folhaTotal = filteredKpis.folhaPendente + filteredKpis.folhaPaga;

  const pendentes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dateFiltered.filter(
      (l) => l.status === "pendente" && matchesSearch(l, q)
    );
  }, [dateFiltered, search]);

  const pendentesVencidos = useMemo(() => {
    return pendentes
      .filter((l) => parseDMY(l.data_vencimento) <= today)
      .sort(
        (a, b) =>
          parseDMY(a.data_vencimento).getTime() -
          parseDMY(b.data_vencimento).getTime()
      );
  }, [pendentes, today]);

  const pendentesNaoVencidos = useMemo(() => {
    return pendentes
      .filter((l) => parseDMY(l.data_vencimento) > today)
      .sort(
        (a, b) =>
          parseDMY(a.data_vencimento).getTime() -
          parseDMY(b.data_vencimento).getTime()
      );
  }, [pendentes, today]);

  const futuraWithSaldo = useMemo((): LancamentoWithSaldo[] => {
    const base = parseFloat(saldoInicialStr) || 0;
    return pendentesNaoVencidos.reduce(
      (state: { items: LancamentoWithSaldo[]; running: number }, l) => {
        const next =
          state.running + (l.tipo === "entrada" ? l.valor : -l.valor);
        return {
          items: state.items.concat({ ...l, saldoAcumulado: next }),
          running: next,
        };
      },
      { items: [], running: base }
    ).items;
  }, [pendentesNaoVencidos, saldoInicialStr]);

  const concluidas = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dateFiltered
      .filter((l) => l.status !== "pendente" && matchesSearch(l, q))
      .sort(
        (a, b) =>
          parseDMY(b.data_vencimento).getTime() -
          parseDMY(a.data_vencimento).getTime()
      );
  }, [dateFiltered, search]);

  const totalPagesConcluidas = Math.ceil(concluidas.length / PAGE_SIZE);
  const paginatedConcluidas = concluidas.slice(
    (pageConcluidas - 1) * PAGE_SIZE,
    pageConcluidas * PAGE_SIZE
  );

  function handleDatePreset(p: DatePreset) {
    setDatePreset(p);
    setPageConcluidas(1);
  }

  return (
    <div className="space-y-5">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="A Receber"
          value={filteredKpis.aReceber}
          color="bg-blue-50 text-blue-600"
          icon={TrendUpIcon}
        />
        <KpiCard
          label="Recebido"
          value={filteredKpis.recebido}
          color="bg-emerald-50 text-emerald-600"
          icon={BanknotesIcon}
        />
        <KpiCard
          label="A Pagar"
          value={filteredKpis.aPagar}
          color="bg-amber-50 text-amber-600"
          icon={TrendDownIcon}
        />
        <KpiCard
          label="Pago"
          value={filteredKpis.pago}
          color="bg-slate-100 text-slate-500"
          icon={BanknotesIcon}
        />
        <div
          className={`col-span-2 rounded-xl border bg-white p-5 shadow-sm lg:col-span-1 ${saldo >= 0 ? "border-emerald-200" : "border-red-200"}`}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Saldo
          </p>
          <p
            className={`mt-3 font-heading text-2xl font-semibold ${saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}
          >
            {fmt(saldo)}
          </p>
        </div>
      </div>

      {/* KPI row 2: folha */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Folha — A Pagar"
          value={filteredKpis.folhaPendente}
          sub="Remunerações pendentes"
          color="bg-purple-50 text-purple-600"
          icon={UsersIcon}
        />
        <KpiCard
          label="Folha — Pago"
          value={filteredKpis.folhaPaga}
          sub="Remunerações quitadas"
          color="bg-purple-100 text-purple-700"
          icon={UsersIcon}
        />
        <div className="rounded-xl border border-purple-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Folha Total
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <UsersIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-heading text-2xl font-semibold text-purple-700">
            {fmt(folhaTotal)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {filteredKpis.aPagar > 0
              ? (
                  (filteredKpis.folhaPendente / filteredKpis.aPagar) *
                  100
                ).toFixed(1)
              : "0"}
            % das despesas
          </p>
        </div>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wide text-muted capitalize">
            Recebido em {currentMonthSummary.label}
          </p>
          <p className="font-heading text-2xl font-semibold text-emerald-700">
            {fmt(currentMonthSummary.recebido)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
          <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wide text-muted capitalize">
            Pago em {currentMonthSummary.label}
          </p>
          <p className="font-heading text-2xl font-semibold text-red-600">
            {fmt(currentMonthSummary.pago)}
          </p>
        </div>
        <div
          className={`rounded-xl border bg-white p-5 shadow-sm ${currentMonthSummary.saldo >= 0 ? "border-primary/30" : "border-red-200"}`}
        >
          <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wide text-muted capitalize">
            Saldo {currentMonthSummary.label}
          </p>
          <p
            className={`font-heading text-2xl font-semibold ${currentMonthSummary.saldo >= 0 ? "text-primary" : "text-red-600"}`}
          >
            {fmt(currentMonthSummary.saldo)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <p className="mb-4 font-heading text-sm font-semibold text-fg">
          Receitas e despesas por mês
        </p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              barCategoryGap="30%"
              barGap={3}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontFamily: "inherit", fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v === 0
                    ? "0"
                    : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : String(v)
                }
                tick={{ fontFamily: "inherit", fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number"
                    ? value.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : String(value)
                }
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  paddingTop: 8,
                }}
              />
              <Bar
                dataKey="receitas"
                name="Receitas"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="despesas"
                name="Despesas"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por descrição, cliente…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageConcluidas(1);
            }}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <Link
          href="/dashboard/financeiro/novo"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
        >
          <PlusIcon className="h-4 w-4" />
          Novo lançamento
        </Link>
      </div>

      {/* Date presets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1 w-fit">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handleDatePreset(p.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors cursor-pointer ${
                datePreset === p.key
                  ? "bg-primary text-white font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {p.key !== "todos" && p.key !== "custom" && (
                <CalendarIcon className="h-3 w-3" />
              )}
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPageConcluidas(1);
              }}
              className="h-9 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
            <span className="font-body text-sm text-muted">até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPageConcluidas(1);
              }}
              className="h-9 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}
        {datePreset !== "todos" && datePreset !== "custom" && (
          <p className="font-body text-xs text-muted">
            {(() => {
              const r = getPresetRange(datePreset);
              if (!r.from || !r.to) return "";
              return `${r.from.toLocaleDateString("pt-BR")} — ${r.to.toLocaleDateString("pt-BR")}`;
            })()}
          </p>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
        <button
          onClick={() => setMainTab("pendentes")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors cursor-pointer ${
            mainTab === "pendentes"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          A receber / A pagar
          {pendentes.length > 0 && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs font-semibold ${
                mainTab === "pendentes"
                  ? "bg-white/20 text-white"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {pendentes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab("concluidas")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors cursor-pointer ${
            mainTab === "concluidas"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          Recebidas e pagas
          {concluidas.length > 0 && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs font-semibold ${
                mainTab === "concluidas"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-muted"
              }`}
            >
              {concluidas.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Pendentes Tab ── */}
      {mainTab === "pendentes" && (
        <div className="space-y-6">
          {/* Vencidos section */}
          <div className="space-y-3">
            <SectionHeading
              title="Vencidos e hoje"
              count={pendentesVencidos.length}
              accent="red"
            />
            {pendentesVencidos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <span className="font-body text-lg font-bold text-emerald-600">
                  ✓
                </span>
                <p className="font-body text-sm font-semibold text-emerald-700">
                  Nenhum vencimento pendente — tudo em dia!
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-red-100 bg-white shadow-sm">
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-red-50/40">
                        <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Vencimento
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Descrição
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Cliente
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Parcela
                        </th>
                        <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Valor
                        </th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendentesVencidos.map((l) => {
                        const isPessoal = l.remuneracao_id !== null;
                        const isToday =
                          parseDMY(l.data_vencimento).getTime() ===
                          today.getTime();
                        return (
                          <tr
                            key={l.id}
                            className="group transition-colors hover:bg-slate-50"
                          >
                            <td className="px-5 py-3.5">
                              <span
                                className={`flex items-center gap-1.5 font-body text-sm font-semibold ${isToday ? "text-amber-600" : "text-red-600"}`}
                              >
                                <CalendarIcon
                                  className={`h-3.5 w-3.5 ${isToday ? "text-amber-400" : "text-red-400"}`}
                                />
                                {l.data_vencimento}
                                {isToday && (
                                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-body text-[10px] font-bold text-amber-700">
                                    Hoje
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <TipoIndicator
                                  tipo={l.tipo}
                                  isPessoal={isPessoal}
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-body text-sm font-semibold text-fg max-w-[200px]">
                                    {l.descricao}
                                  </p>
                                  {isPessoal ? (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 font-body text-[10px] font-bold bg-purple-50 text-purple-700">
                                      Pessoal
                                    </span>
                                  ) : l.categoria ? (
                                    <p className="font-body text-xs text-muted">
                                      {l.categoria}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-body text-sm text-fg">
                              {l.client_name ? (
                                <Link
                                  href={`/dashboard/clientes/${l.client_id}`}
                                  className="hover:text-primary transition-colors truncate max-w-[140px] block"
                                >
                                  {l.client_name}
                                </Link>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-body text-sm text-muted">
                              {l.parcela_atual != null
                                ? l.parcela_atual === 0
                                  ? "Entrada"
                                  : `${l.parcela_atual}/${l.total_parcelas}`
                                : "—"}
                            </td>
                            <td
                              className={`px-4 py-3.5 text-right font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                            >
                              {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                            </td>
                            <td className="px-5 py-3.5">
                              <RowActions lancamento={l} canEdit={canEdit} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-border md:hidden">
                  {pendentesVencidos.map((l) => {
                    const isPessoal = l.remuneracao_id !== null;
                    return (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 px-4 py-4"
                      >
                        <TipoIndicator tipo={l.tipo} isPessoal={isPessoal} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body text-sm font-semibold text-fg">
                            {l.descricao}
                          </p>
                          <p className="font-body text-xs text-red-500 font-semibold">
                            {l.data_vencimento}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Futuras section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <SectionHeading
                title="Próximos vencimentos"
                count={pendentesNaoVencidos.length}
                accent="blue"
              />
              <div className="ml-auto flex items-center gap-2">
                <label className="font-body text-xs font-semibold text-muted">
                  Saldo inicial (R$):
                </label>
                <input
                  type="number"
                  value={saldoInicialStr}
                  onChange={(e) => setSaldoInicialStr(e.target.value)}
                  placeholder="0"
                  className="h-8 w-28 rounded-lg border border-border bg-white px-3 text-right font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            {pendentesNaoVencidos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-4">
                <p className="font-body text-sm text-muted">
                  Nenhum vencimento futuro no período selecionado.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/50">
                        <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Vencimento
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Descrição
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Cliente
                        </th>
                        <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Parcela
                        </th>
                        <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Valor
                        </th>
                        <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          Saldo previsto
                        </th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {futuraWithSaldo.map((l) => {
                        const isPessoal = l.remuneracao_id !== null;
                        return (
                          <tr
                            key={l.id}
                            className="group transition-colors hover:bg-slate-50"
                          >
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                                <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                                {l.data_vencimento}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <TipoIndicator
                                  tipo={l.tipo}
                                  isPessoal={isPessoal}
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-body text-sm font-semibold text-fg max-w-[200px]">
                                    {l.descricao}
                                  </p>
                                  {isPessoal ? (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 font-body text-[10px] font-bold bg-purple-50 text-purple-700">
                                      Pessoal
                                    </span>
                                  ) : l.categoria ? (
                                    <p className="font-body text-xs text-muted">
                                      {l.categoria}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-body text-sm text-fg">
                              {l.client_name ? (
                                <Link
                                  href={`/dashboard/clientes/${l.client_id}`}
                                  className="hover:text-primary transition-colors truncate max-w-[140px] block"
                                >
                                  {l.client_name}
                                </Link>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-body text-sm text-muted">
                              {l.parcela_atual != null
                                ? l.parcela_atual === 0
                                  ? "Entrada"
                                  : `${l.parcela_atual}/${l.total_parcelas}`
                                : "—"}
                            </td>
                            <td
                              className={`px-4 py-3.5 text-right font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                            >
                              {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                            </td>
                            <td
                              className={`px-4 py-3.5 text-right font-body text-sm font-semibold tabular-nums ${l.saldoAcumulado >= 0 ? "text-emerald-700" : "text-red-600"}`}
                            >
                              {fmt(l.saldoAcumulado)}
                            </td>
                            <td className="px-5 py-3.5">
                              <RowActions lancamento={l} canEdit={canEdit} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-border md:hidden">
                  {futuraWithSaldo.map((l) => {
                    const isPessoal = l.remuneracao_id !== null;
                    return (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 px-4 py-4"
                      >
                        <TipoIndicator tipo={l.tipo} isPessoal={isPessoal} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body text-sm font-semibold text-fg">
                            {l.descricao}
                          </p>
                          <p className="font-body text-xs text-muted">
                            {l.data_vencimento}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span
                            className={`font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                          >
                            {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                          </span>
                          <span
                            className={`font-body text-xs font-semibold tabular-nums ${l.saldoAcumulado >= 0 ? "text-emerald-600" : "text-red-500"}`}
                          >
                            Saldo: {fmt(l.saldoAcumulado)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Concluidas Tab ── */}
      {mainTab === "concluidas" && (
        <div className="space-y-3">
          <SectionHeading
            title="Recebidas e pagas"
            count={concluidas.length}
            accent="slate"
          />
          {concluidas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white py-16 text-center shadow-sm">
              <BanknotesIcon className="h-10 w-10 text-slate-300" />
              <p className="font-body text-sm font-semibold text-muted">
                Nenhum registro concluído no período
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50">
                      <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Vencimento
                      </th>
                      <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Parcela
                      </th>
                      <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Data pag.
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedConcluidas.map((l) => {
                      const isPessoal = l.remuneracao_id !== null;
                      return (
                        <tr
                          key={l.id}
                          className="group transition-colors hover:bg-slate-50"
                        >
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                              <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                              {l.data_vencimento}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <TipoIndicator
                                tipo={l.tipo}
                                isPessoal={isPessoal}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-body text-sm font-semibold text-fg max-w-[200px]">
                                  {l.descricao}
                                </p>
                                {isPessoal ? (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 font-body text-[10px] font-bold bg-purple-50 text-purple-700">
                                    Pessoal
                                  </span>
                                ) : l.categoria ? (
                                  <p className="font-body text-xs text-muted">
                                    {l.categoria}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-body text-sm text-fg">
                            {l.client_name ? (
                              <Link
                                href={`/dashboard/clientes/${l.client_id}`}
                                className="hover:text-primary transition-colors truncate max-w-[140px] block"
                              >
                                {l.client_name}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-body text-sm text-muted">
                            {l.parcela_atual != null
                              ? l.parcela_atual === 0
                                ? "Entrada"
                                : `${l.parcela_atual}/${l.total_parcelas}`
                              : "—"}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                          >
                            {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={l.status} />
                          </td>
                          <td className="px-4 py-3.5 font-body text-sm text-muted">
                            {l.data_pagamento ?? "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <RowActions lancamento={l} canEdit={canEdit} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-border md:hidden">
                {paginatedConcluidas.map((l) => {
                  const isPessoal = l.remuneracao_id !== null;
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 px-4 py-4"
                    >
                      <TipoIndicator tipo={l.tipo} isPessoal={isPessoal} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm font-semibold text-fg">
                          {l.descricao}
                        </p>
                        <p className="font-body text-xs text-muted">
                          {l.data_vencimento}
                          {l.data_pagamento && ` · Pago em ${l.data_pagamento}`}
                          {isPessoal && " · Pessoal"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`font-body text-sm font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                        </span>
                        <StatusBadge status={l.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {totalPagesConcluidas > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <p className="font-body text-xs text-muted">
                    {(pageConcluidas - 1) * PAGE_SIZE + 1}–
                    {Math.min(pageConcluidas * PAGE_SIZE, concluidas.length)} de{" "}
                    {concluidas.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setPageConcluidas((p) => Math.max(1, p - 1))
                      }
                      disabled={pageConcluidas === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      ‹
                    </button>
                    {Array.from(
                      { length: totalPagesConcluidas },
                      (_, i) => i + 1
                    ).map((n) => (
                      <button
                        key={n}
                        onClick={() => setPageConcluidas(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors cursor-pointer ${
                          pageConcluidas === n
                            ? "bg-primary text-white font-semibold"
                            : "border border-border text-muted hover:border-primary hover:text-primary"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setPageConcluidas((p) =>
                          Math.min(totalPagesConcluidas, p + 1)
                        )
                      }
                      disabled={pageConcluidas === totalPagesConcluidas}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
