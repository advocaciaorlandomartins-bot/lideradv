"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import type {
  LancamentoKpis,
  MonthlyChartPoint,
  Lancamento,
} from "@/lib/lancamentos-db";
import type { RemuneracaoKpis } from "@/lib/remuneracoes-db";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtMonthKey(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 2);
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(". ", "/")
    .replace(".", "");
}

function parseDMY(s: string): Date {
  const [d, m, y] = s.split("/");
  if (d && m && y) return new Date(Number(y), Number(m) - 1, Number(d));
  return new Date(s);
}

interface Props {
  lancamentoKpis: LancamentoKpis;
  remuneracaoKpis: RemuneracaoKpis;
  chartData: MonthlyChartPoint[];
  lancamentos: Lancamento[];
}

export default function ResumoContent({
  lancamentoKpis,
  remuneracaoKpis,
  chartData,
  lancamentos,
}: Props) {
  const {
    aReceber,
    recebido,
    aPagar,
    pago,
    folhaPendente,
    folhaPaga,
    atrasados,
  } = lancamentoKpis;
  const totalAPagar = aPagar + remuneracaoKpis.aPagar;
  const saldo = aReceber - totalAPagar;

  const [saldoAtualStr, setSaldoAtualStr] = useState("0,00");
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  type FluxoItem = Lancamento & { saldoAcumulado: number; atrasado: boolean };
  const fluxoCaixa = useMemo((): FluxoItem[] => {
    const saldoBase =
      parseFloat(saldoAtualStr.replace(/\./g, "").replace(",", ".")) || 0;
    const pendentes = lancamentos
      .filter((l) => l.status === "pendente")
      .sort(
        (a, b) =>
          parseDMY(a.data_vencimento).getTime() -
          parseDMY(b.data_vencimento).getTime()
      );
    return pendentes.reduce<FluxoItem[]>((acc, l) => {
      const prev =
        acc.length > 0 ? acc[acc.length - 1].saldoAcumulado : saldoBase;
      const saldoAcumulado = prev + (l.tipo === "entrada" ? l.valor : -l.valor);
      return [
        ...acc,
        {
          ...l,
          saldoAcumulado,
          atrasado: parseDMY(l.data_vencimento) <= today,
        },
      ];
    }, []);
  }, [lancamentos, saldoAtualStr, today]);

  const formattedChart = useMemo(
    () =>
      chartData.map((d) => ({
        month: fmtMonthKey(d.monthKey),
        Receitas: d.receitas,
        Despesas: d.despesas,
      })),
    [chartData]
  );

  return (
    <div className="space-y-6">
      {/* Overdue alert */}
      {atrasados > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
          <p className="font-body text-sm font-semibold text-amber-800">
            {atrasados}{" "}
            {atrasados === 1 ? "cobrança atrasada" : "cobranças atrasadas"} —
            vencidas e ainda pendentes
          </p>
          <Link
            href="/dashboard/financeiro?tab=receber"
            className="ml-auto font-body text-xs font-semibold text-amber-700 underline underline-offset-2 hover:no-underline whitespace-nowrap"
          >
            Ver em A Receber →
          </Link>
        </div>
      )}

      {/* Main KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="A Receber"
          value={aReceber}
          sub="de clientes"
          valueColor="text-red-600"
          href="/dashboard/financeiro?tab=receber"
          badge={
            atrasados > 0
              ? `${atrasados} atrasad${atrasados === 1 ? "a" : "as"}`
              : undefined
          }
        />
        <KpiCard
          label="Já Recebido"
          value={recebido}
          sub="total acumulado"
          valueColor="text-emerald-700"
        />
        <KpiCard
          label="A Pagar (equipe)"
          value={remuneracaoKpis.aPagar}
          sub="colaboradores"
          valueColor="text-amber-600"
          href="/dashboard/financeiro?tab=pagar"
        />
        <KpiCard
          label="Saldo Projetado"
          value={saldo}
          sub="a receber − a pagar"
          valueColor={saldo >= 0 ? "text-emerald-700" : "text-red-600"}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SmallKpi
          label="Despesas pendentes"
          value={aPagar}
          color="text-orange-600"
        />
        <SmallKpi label="Despesas pagas" value={pago} color="text-muted" />
        <SmallKpi
          label="Folha pendente"
          value={folhaPendente}
          color="text-amber-600"
        />
        <SmallKpi label="Folha paga" value={folhaPaga} color="text-muted" />
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NavCard
          href="/dashboard/financeiro?tab=receber"
          title="A Receber"
          desc="Cobrar clientes, dar baixa, adiantar parcelas"
          accent="border-red-200 hover:border-red-400"
        />
        <NavCard
          href="/dashboard/financeiro?tab=pagar"
          title="A Pagar"
          desc="Registrar e baixar despesas do escritório"
          accent="border-amber-200 hover:border-amber-400"
        />
        <NavCard
          href="/dashboard/financeiro?tab=remuneracoes"
          title="Remunerações"
          desc="Criar e gerenciar salários, comissões e bônus"
          accent="border-purple-200 hover:border-purple-400"
        />
        <NavCard
          href="/dashboard/financeiro?tab=historico"
          title="Histórico"
          desc="Buscar, editar e excluir lançamentos"
          accent="border-slate-200 hover:border-slate-400"
        />
      </div>

      {/* Fluxo de Caixa */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="font-heading text-sm font-semibold text-fg">
            Fluxo de Caixa
          </span>
          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 font-body text-[11px] font-semibold text-blue-600">
            {fluxoCaixa.length} pendentes
          </span>
        </div>
        <div className="border-b border-border px-4 py-3 flex items-center gap-3">
          <span className="font-body text-xs text-muted whitespace-nowrap">
            Saldo atual (R$):
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={saldoAtualStr}
            onChange={(e) => setSaldoAtualStr(e.target.value)}
            className="w-36 rounded-lg border border-border px-2 py-1 font-body text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {fluxoCaixa.length === 0 ? (
          <p className="py-8 text-center font-body text-sm text-muted">
            Nenhum lançamento pendente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-slate-50/60">
                  <th className="px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Vencimento
                  </th>
                  <th className="px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Descrição
                  </th>
                  <th className="px-4 py-2 text-right font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Valor
                  </th>
                  <th className="px-4 py-2 text-right font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Saldo Acumulado
                  </th>
                </tr>
              </thead>
              <tbody>
                {fluxoCaixa.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-border/60 last:border-0 ${l.atrasado ? "bg-red-50/40" : ""}`}
                  >
                    <td className="px-4 py-2 font-body text-xs whitespace-nowrap">
                      <span
                        className={
                          l.atrasado
                            ? "font-semibold text-red-600"
                            : "text-muted"
                        }
                      >
                        {l.data_vencimento}
                        {l.atrasado && (
                          <span className="ml-1 text-[10px]">⚠</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-body text-xs text-fg">
                      {l.descricao}
                      {l.client_name && (
                        <span className="ml-1 text-muted">
                          · {l.client_name}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-body text-xs font-semibold tabular-nums whitespace-nowrap ${l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
                    >
                      {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-body text-xs font-bold tabular-nums whitespace-nowrap ${l.saldoAcumulado >= 0 ? "text-emerald-700" : "text-red-600"}`}
                    >
                      {fmt(Math.abs(l.saldoAcumulado))}
                      {l.saldoAcumulado < 0 && (
                        <span className="text-muted font-normal"> neg</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <p className="mb-4 font-heading text-sm font-semibold text-fg">
          Receitas e despesas — últimos 12 meses
        </p>
        {formattedChart.length === 0 ? (
          <p className="py-10 text-center font-body text-sm text-muted">
            Nenhum lançamento nos últimos 12 meses.
          </p>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedChart}
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
                  tick={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    fill: "#94a3b8",
                  }}
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
                  tick={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    fill: "#94a3b8",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? fmt(value) : String(value)
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
                <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  valueColor,
  href,
  badge,
}: {
  label: string;
  value: number;
  sub?: string;
  valueColor: string;
  href?: string;
  badge?: string;
}) {
  const inner = (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 ${
        href ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""
      } border-border`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted leading-tight">
          {label}
        </p>
        {badge && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-body text-[10px] font-semibold text-amber-700 whitespace-nowrap flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p
        className={`mt-2 font-heading text-lg font-semibold ${valueColor} leading-tight`}
      >
        {fmt(value)}
      </p>
      {sub && <p className="mt-0.5 font-body text-xs text-muted">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function SmallKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <p className="font-body text-xs text-muted">{label}</p>
      <p className={`mt-0.5 font-body text-sm font-semibold ${color}`}>
        {fmt(value)}
      </p>
    </div>
  );
}

function NavCard({
  href,
  title,
  desc,
  accent,
}: {
  href: string;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer ${accent}`}
    >
      <p className="font-heading text-sm font-semibold text-fg">{title} →</p>
      <p className="mt-1 font-body text-xs text-muted leading-relaxed">
        {desc}
      </p>
    </Link>
  );
}
