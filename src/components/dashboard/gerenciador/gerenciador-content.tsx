"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { GerenciadorData } from "@/lib/gerenciador-db";

type Tab = "operacional" | "tatico" | "estrategico" | "analitico";

interface Props {
  data: GerenciadorData;
}

const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function KpiCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        alert ? "border-red-200" : "border-gray-200"
      }`}
    >
      <p className="font-body text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          alert ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 font-body text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function OperacionalTab({ data }: { data: GerenciadorData }) {
  const { kpis, counts, proximosControles, vencidos } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Controles (7 dias)"
          value={String(counts.controlesProximos)}
          sub="próximos eventos"
          alert={counts.controlesProximos > 0}
        />
        <KpiCard
          label="Vencidos"
          value={String(counts.vencidosCount)}
          sub="lançamentos em atraso"
          alert={counts.vencidosCount > 0}
        />
        <KpiCard
          label="Total Vencido"
          value={fmt(kpis.vencidosValor)}
          sub="valor em atraso"
          alert={kpis.vencidosValor > 0}
        />
        <KpiCard
          label="A Receber"
          value={fmt(kpis.aReceber)}
          sub="pendente de recebimento"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-800">
              Próximos Controles{" "}
              <span className="font-normal text-gray-400">(14 dias)</span>
            </h3>
          </div>
          {proximosControles.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm text-gray-400">
              Nenhum controle próximo
            </p>
          ) : (
            <table className="w-full table-fixed font-body text-xs">
              <colgroup>
                <col className="w-[90px]" />
                <col />
                <col className="w-[80px]" />
                <col className="w-[44px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                    Data
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                    Descrição
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                    Tipo
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">
                    Dias
                  </th>
                </tr>
              </thead>
              <tbody>
                {proximosControles.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(c.data_evento + "T00:00:00").toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                    <td className="truncate px-3 py-2 text-gray-700">
                      {c.descricao}
                    </td>
                    <td className="truncate px-3 py-2 text-gray-500">
                      {c.tipo_label}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        c.dias_restantes <= 3
                          ? "text-red-600"
                          : c.dias_restantes <= 7
                            ? "text-amber-600"
                            : "text-gray-600"
                      }`}
                    >
                      {c.dias_restantes}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-800">
              Lançamentos Vencidos
            </h3>
          </div>
          {vencidos.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm text-gray-400">
              Nenhum vencido
            </p>
          ) : (
            <table className="w-full table-fixed font-body text-xs">
              <colgroup>
                <col />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[44px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                    Descrição
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">
                    Valor
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                    Vencto
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">
                    Atraso
                  </th>
                </tr>
              </thead>
              <tbody>
                {vencidos.slice(0, 10).map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="truncate px-3 py-2 text-gray-700">
                      {v.descricao}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        v.tipo === "entrada" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {fmt(v.valor)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {v.data_vencimento}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">
                      {v.dias_atraso}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function TaticoTab({ data }: { data: GerenciadorData }) {
  const {
    kpis,
    counts,
    receitasPorMes,
    controlesPorTipo,
    novosClientesPorMes,
  } = data;

  const barData = receitasPorMes.map((m) => ({
    mes: m.mesLabel,
    Receitas: m.receitas,
    Despesas: m.despesas,
  }));

  const clientesData = novosClientesPorMes.slice(-6).map((m) => ({
    mes: m.mesLabel,
    Clientes: m.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Recebido (mês)" value={fmt(kpis.recebidoMes)} />
        <KpiCard label="Pago (mês)" value={fmt(kpis.pagoMes)} />
        <KpiCard
          label="Saldo (mês)"
          value={fmt(kpis.saldoMes)}
          alert={kpis.saldoMes < 0}
        />
        <KpiCard
          label="Controles Pendentes"
          value={String(counts.controlesProximos)}
          sub="nos próximos 7 dias"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Receitas vs Despesas — 12 meses
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={barData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={50}
              />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Controles Pendentes
          </h3>
          {controlesPorTipo.length === 0 ? (
            <p className="py-10 text-center font-body text-sm text-gray-400">
              Sem controles
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={controlesPorTipo}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                >
                  {controlesPorTipo.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} controles`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
          Novos Clientes — últimos 6 meses
        </h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={clientesData}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              width={30}
              allowDecimals={false}
            />
            <Tooltip />
            <Bar dataKey="Clientes" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EstrategicoTab({ data }: { data: GerenciadorData }) {
  const { kpis, counts, topClientes, receitasPorMes } = data;

  const topData = topClientes.map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
    Receita: c.receita,
  }));

  const evolucaoData = receitasPorMes.map((m) => ({
    mes: m.mesLabel,
    Receitas: m.receitas,
  }));

  const saldoAnual = kpis.recebidoAno - kpis.pagoAno;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Recebido (ano)" value={fmt(kpis.recebidoAno)} />
        <KpiCard label="Pago (ano)" value={fmt(kpis.pagoAno)} />
        <KpiCard label="Total Clientes" value={String(counts.totalClientes)} />
        <KpiCard
          label="Total Processos"
          value={String(counts.totalProcessos)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Top 5 Clientes por Receita
          </h3>
          {topData.length === 0 ? (
            <p className="py-10 text-center font-body text-sm text-gray-400">
              Sem dados
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={topData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  width={90}
                  interval={0}
                />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="Receita" fill="#a855f7" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Evolução de Receitas — 12 meses
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={evolucaoData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={50}
              />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="Receitas" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Colaboradores",
            value: String(counts.totalColaboradores),
            href: "/dashboard/colaboradores",
          },
          {
            label: "A Receber",
            value: fmt(kpis.aReceber),
            href: "/dashboard/financeiro",
          },
          {
            label: "A Pagar",
            value: fmt(kpis.aPagar),
            href: "/dashboard/financeiro",
          },
          {
            label: "Saldo Anual",
            value: fmt(saldoAnual),
            href: "/dashboard/financeiro",
            alert: saldoAnual < 0,
          },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`rounded-xl border p-4 transition-colors ${
              item.alert
                ? "border-red-100 bg-red-50 hover:bg-red-100"
                : "border-purple-100 bg-purple-50 hover:bg-purple-100"
            }`}
          >
            <p
              className={`font-body text-xs font-medium uppercase tracking-wide ${
                item.alert ? "text-red-600" : "text-purple-600"
              }`}
            >
              {item.label}
            </p>
            <p
              className={`mt-1 font-heading text-lg font-bold ${
                item.alert ? "text-red-900" : "text-purple-900"
              }`}
            >
              {item.value}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

function AnaliticoTab({ data }: { data: GerenciadorData }) {
  const { receitasPorCategoria, processosPorTipo, controlesPorTipo, vencidos } =
    data;

  const totalControles = controlesPorTipo.reduce((s, t) => s + t.count, 0);

  const catData = receitasPorCategoria.map((c) => ({
    name: c.categoria,
    Valor: c.total,
  }));

  const tipoData = processosPorTipo.map((p) => ({
    name: p.label.length > 22 ? p.label.slice(0, 20) + "…" : p.label,
    Processos: p.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Receitas Recebidas por Categoria
          </h3>
          {catData.length === 0 ? (
            <p className="py-10 text-center font-body text-sm text-gray-400">
              Sem dados
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="Valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                >
                  {catData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Processos por Tipo de Ação
          </h3>
          {tipoData.length === 0 ? (
            <p className="py-10 text-center font-body text-sm text-gray-400">
              Sem dados
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={tipoData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  width={100}
                  interval={0}
                />
                <Tooltip />
                <Bar dataKey="Processos" fill="#10b981" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-4 font-heading text-sm font-semibold text-gray-800">
            Controles Pendentes por Tipo
          </h3>
          {controlesPorTipo.length === 0 ? (
            <p className="py-6 text-center font-body text-sm text-gray-400">
              Sem controles
            </p>
          ) : (
            <div className="space-y-3">
              {controlesPorTipo.map((t, i) => (
                <div key={t.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-body text-xs text-gray-700">
                      {t.label}
                    </span>
                    <span className="font-body text-xs font-semibold text-gray-900">
                      {t.count}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width:
                          totalControles > 0
                            ? `${(t.count / totalControles) * 100}%`
                            : "0%",
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-800">
              Inadimplência Detalhada
            </h3>
          </div>
          {vencidos.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm text-gray-400">
              Sem vencidos
            </p>
          ) : (
            <div className="max-h-[260px] overflow-y-auto">
              {vencidos.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between border-b border-gray-50 px-4 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-xs font-medium text-gray-800">
                      {v.descricao}
                    </p>
                    {v.client_name && (
                      <p className="font-body text-[10px] text-gray-400">
                        {v.client_name}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex flex-col items-end">
                    <span
                      className={`font-body text-xs font-semibold ${
                        v.tipo === "entrada" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {fmt(v.valor)}
                    </span>
                    <span className="font-body text-[10px] text-red-400">
                      {v.dias_atraso}d atraso
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GerenciadorContent({ data }: Props) {
  const [tab, setTab] = useState<Tab>("operacional");

  const tabs: Array<{
    key: Tab;
    label: string;
    sub: string;
    activeBorder: string;
    activeBg: string;
    dot: string;
    activeLabel: string;
    activeSub: string;
  }> = [
    {
      key: "operacional",
      label: "Operacional",
      sub: "Alertas do dia",
      activeBorder: "border-amber-500",
      activeBg: "bg-amber-50",
      dot: "bg-amber-500",
      activeLabel: "text-amber-800",
      activeSub: "text-amber-600",
    },
    {
      key: "tatico",
      label: "Tático",
      sub: "Performance do mês",
      activeBorder: "border-blue-500",
      activeBg: "bg-blue-50",
      dot: "bg-blue-500",
      activeLabel: "text-blue-800",
      activeSub: "text-blue-600",
    },
    {
      key: "estrategico",
      label: "Estratégico",
      sub: "Visão anual",
      activeBorder: "border-purple-500",
      activeBg: "bg-purple-50",
      dot: "bg-purple-500",
      activeLabel: "text-purple-800",
      activeSub: "text-purple-600",
    },
    {
      key: "analitico",
      label: "Analítico",
      sub: "Análise profunda",
      activeBorder: "border-emerald-500",
      activeBg: "bg-emerald-50",
      dot: "bg-emerald-500",
      activeLabel: "text-emerald-800",
      activeSub: "text-emerald-600",
    },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex cursor-pointer flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                isActive
                  ? `${t.activeBorder} ${t.activeBg}`
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {isActive && (
                <span
                  className={`absolute right-3 top-3 h-2 w-2 rounded-full ${t.dot}`}
                />
              )}
              <span
                className={`font-heading text-sm font-semibold ${
                  isActive ? t.activeLabel : "text-gray-700"
                }`}
              >
                {t.label}
              </span>
              <span
                className={`mt-0.5 font-body text-xs ${
                  isActive ? t.activeSub : "text-gray-400"
                }`}
              >
                {t.sub}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "operacional" && <OperacionalTab data={data} />}
      {tab === "tatico" && <TaticoTab data={data} />}
      {tab === "estrategico" && <EstrategicoTab data={data} />}
      {tab === "analitico" && <AnaliticoTab data={data} />}
    </div>
  );
}
