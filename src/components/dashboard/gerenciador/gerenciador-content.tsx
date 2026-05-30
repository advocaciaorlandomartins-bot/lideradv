"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "operacional" | "tatico" | "estrategico" | "analitico";

interface Props {
  data: GerenciadorData;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const TIPO_COLORS: Record<string, string> = {
  audiencias: "#6366f1",
  prazos: "#ef4444",
  pericias: "#f59e0b",
  dcb: "#22c55e",
  beneficios: "#3b82f6",
  implantados: "#ec4899",
  "implantados-data": "#14b8a6",
  alvaras: "#f97316",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

interface UrgencyConfig {
  label: string;
  badgeCls: string;
  rowCls: string;
}

function urgencyConfig(dias: number): UrgencyConfig {
  if (dias <= 0)
    return {
      label: "Hoje",
      badgeCls: "bg-red-100 text-red-700 border border-red-200",
      rowCls: "bg-red-50",
    };
  if (dias === 1)
    return {
      label: "Amanhã",
      badgeCls: "bg-orange-100 text-orange-700 border border-orange-200",
      rowCls: "bg-orange-50",
    };
  if (dias <= 3)
    return {
      label: `${dias}d`,
      badgeCls: "bg-amber-100 text-amber-700 border border-amber-200",
      rowCls: "",
    };
  if (dias <= 7)
    return {
      label: `${dias}d`,
      badgeCls: "bg-blue-100 text-blue-700 border border-blue-200",
      rowCls: "",
    };
  return {
    label: `${dias}d`,
    badgeCls: "bg-slate-100 text-slate-600 border border-slate-200",
    rowCls: "",
  };
}

function atrasoBadge(dias: number): string {
  if (dias > 30) return "bg-red-100 text-red-700 border border-red-200";
  if (dias > 7) return "bg-orange-100 text-orange-700 border border-orange-200";
  return "bg-amber-100 text-amber-700 border border-amber-200";
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  alert,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  href?: string;
}) {
  const inner = (
    <>
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
      {href && (
        <p className="mt-2 font-body text-[10px] text-gray-400 transition-colors group-hover:text-gray-600">
          Ver detalhes →
        </p>
      )}
    </>
  );

  const cls = `group rounded-xl border bg-white p-4 shadow-sm transition-all ${
    alert
      ? "border-red-200 bg-red-50 hover:border-red-300"
      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
  }`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }

  return <div className={cls}>{inner}</div>;
}

// ── ClickableRow ──────────────────────────────────────────────────────────────

function ClickableRow({
  href,
  children,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer border-b border-gray-50 last:border-0 transition-colors hover:bg-primary/5 ${highlight ?? ""}`}
    >
      {children}
    </tr>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  noPad,
}: {
  title: string;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-gray-800">
          {title}
        </h3>
      </div>
      <div className={noPad ? "" : "p-4"}>{children}</div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <p className="px-4 py-8 text-center font-body text-sm text-gray-400">
      {msg}
    </p>
  );
}

// ── Aba Operacional ───────────────────────────────────────────────────────────

function OperacionalTab({ data }: { data: GerenciadorData }) {
  const { kpis, counts, proximosControles, vencidos, crm } = data;

  const controlesHojeAmanha = proximosControles.filter(
    (c) => c.dias_restantes <= 1
  ).length;

  return (
    <div className="space-y-6">
      {/* KPIs financeiros + CRM */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Controles Hoje/Amanhã"
          value={String(controlesHojeAmanha)}
          sub="eventos urgentes"
          alert={controlesHojeAmanha > 0}
          href="/dashboard/controles"
        />
        <KpiCard
          label="Vencidos"
          value={String(counts.vencidosCount)}
          sub="lançamentos em atraso"
          alert={counts.vencidosCount > 0}
          href="/dashboard/financeiro"
        />
        <KpiCard
          label="Leads Ativos"
          value={String(crm.leadsAtivos)}
          sub="no funil de vendas"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Tarefas CRM Vencidas"
          value={String(crm.tarefasVencidas)}
          sub="follow-ups atrasados"
          alert={crm.tarefasVencidas > 0}
          href="/dashboard/crm"
        />
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tarefas CRM */}
        <SectionCard title="Tarefas CRM — Próximas e Vencidas" noPad>
          {crm.tarefasProximas.length === 0 ? (
            <EmptyState msg="Nenhuma tarefa pendente" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Tarefa
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Lead
                    </th>
                    <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                      Prazo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {crm.tarefasProximas.map((t) => {
                    const vencida = t.dias_restantes < 0;
                    const hoje = t.dias_restantes === 0;
                    const rowCls = vencida
                      ? "bg-red-50"
                      : hoje
                        ? "bg-orange-50"
                        : "";
                    const badgeCls = vencida
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : hoje
                        ? "bg-orange-100 text-orange-700 border border-orange-200"
                        : t.dias_restantes <= 3
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-blue-100 text-blue-700 border border-blue-200";
                    const badgeLabel = vencida
                      ? `${Math.abs(t.dias_restantes)}d atraso`
                      : hoje
                        ? "Hoje"
                        : `${t.dias_restantes}d`;
                    return (
                      <ClickableRow
                        key={t.id}
                        href={`/dashboard/crm/leads/${t.lead_id}`}
                        highlight={rowCls}
                      >
                        <td className="max-w-[140px] truncate px-3 py-2 font-medium text-gray-800">
                          {t.titulo}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-gray-500">
                          {t.lead_nome}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Próximos Controles */}
        <SectionCard title="Próximos Controles (14 dias)" noPad>
          {proximosControles.length === 0 ? (
            <EmptyState msg="Nenhum controle próximo" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                      Urgência
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proximosControles.map((c) => {
                    const urg = urgencyConfig(c.dias_restantes);
                    const href = `/dashboard/controles/${c.id}`;
                    return (
                      <ClickableRow
                        key={c.id}
                        href={href}
                        highlight={urg.rowCls}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                          {fmtDate(c.data_evento)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            style={{
                              backgroundColor: TIPO_COLORS[c.tipo] ?? "#6b7280",
                            }}
                          >
                            {c.tipo_label}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 font-medium text-gray-800">
                          {c.descricao}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-gray-500">
                          {c.cliente_nome ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${urg.badgeCls}`}
                          >
                            {urg.label}
                          </span>
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Lançamentos Vencidos */}
        <SectionCard title="Lançamentos Vencidos" noPad>
          {vencidos.length === 0 ? (
            <EmptyState msg="Nenhum vencido" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">
                      Valor
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Vencto
                    </th>
                    <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                      Atraso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vencidos.slice(0, 15).map((v) => {
                    const href = v.client_id
                      ? `/dashboard/clientes/${v.client_id}`
                      : "/dashboard/financeiro";
                    return (
                      <ClickableRow key={v.id} href={href}>
                        <td className="max-w-[140px] truncate px-3 py-2 font-medium text-gray-800">
                          {v.descricao}
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-gray-500">
                          {v.client_name ?? "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                            v.tipo === "entrada"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {fmt(v.valor)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                          {v.data_vencimento}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${atrasoBadge(v.dias_atraso)}`}
                          >
                            {v.dias_atraso}d
                          </span>
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Aba Tático ────────────────────────────────────────────────────────────────

function TaticoTab({ data }: { data: GerenciadorData }) {
  const { kpis, receitasPorMes, controlesPorTipo, novosClientesPorMes, crm } =
    data;

  const novosClientesUltimo =
    novosClientesPorMes.length > 0
      ? novosClientesPorMes[novosClientesPorMes.length - 1].count
      : 0;

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
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Recebido (mês)" value={fmt(kpis.recebidoMes)} />
        <KpiCard label="Pago (mês)" value={fmt(kpis.pagoMes)} />
        <KpiCard
          label="Saldo (mês)"
          value={fmt(kpis.saldoMes)}
          alert={kpis.saldoMes < 0}
        />
        <KpiCard
          label="Novos Clientes (mês)"
          value={String(novosClientesUltimo)}
          sub="no mês atual"
        />
        <KpiCard
          label="Novos Leads (mês)"
          value={String(crm.leadsMes)}
          sub="entradas no CRM"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Leads em Andamento"
          value={String(crm.leadsAtivos)}
          sub="no funil ativo"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Leads Fechados"
          value={String(crm.leadsFechados)}
          sub="convertidos em cliente"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Taxa de Conversão"
          value={`${crm.taxaConversao.toFixed(0)}%`}
          sub="fechados / (fechados + perdidos)"
          href="/dashboard/crm"
        />
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Receitas vs Despesas — 12 meses
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={52}
              />
              <Tooltip
                formatter={(v) => (typeof v === "number" ? fmt(v) : v)}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Controles Pendentes por Tipo
          </h3>
          {controlesPorTipo.length === 0 ? (
            <EmptyState msg="Sem controles" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={controlesPorTipo}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                >
                  {controlesPorTipo.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? `${v} controles` : v
                  }
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Novos clientes + Funil CRM */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Novos Clientes — últimos 6 meses
          </h3>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={clientesData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
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

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Funil de Vendas CRM — por Estágio
          </h3>
          {crm.leadsPorEstagio.length === 0 ? (
            <EmptyState msg="Nenhum lead cadastrado" />
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart
                data={crm.leadsPorEstagio.map((e) => ({
                  name: e.label,
                  Leads: e.count,
                }))}
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
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  width={110}
                  interval={0}
                />
                <Tooltip />
                <Bar dataKey="Leads" fill="#6366f1" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Aba Estratégico ───────────────────────────────────────────────────────────

function EstrategicoTab({ data }: { data: GerenciadorData }) {
  const { kpis, counts, topClientes, receitasPorMes, crm } = data;

  const saldoAnual = kpis.recebidoAno - kpis.pagoAno;

  const topData = topClientes.map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
    fullName: c.name,
    Receita: c.receita,
    id: c.id,
  }));

  const evolucaoData = receitasPorMes.map((m) => ({
    mes: m.mesLabel,
    Receitas: m.receitas,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Recebido (ano)" value={fmt(kpis.recebidoAno)} />
        <KpiCard label="Pago (ano)" value={fmt(kpis.pagoAno)} />
        <KpiCard
          label="Saldo Anual"
          value={fmt(saldoAnual)}
          alert={saldoAnual < 0}
        />
        <KpiCard
          label="Total Clientes"
          value={String(counts.totalClientes)}
          href="/dashboard/clientes"
        />
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top clientes */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-800">
              Top 5 Clientes por Receita
            </h3>
          </div>
          <div className="p-4">
            {topData.length === 0 ? (
              <EmptyState msg="Sem dados" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
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
                    <Tooltip
                      formatter={(v) => (typeof v === "number" ? fmt(v) : v)}
                    />
                    <Bar
                      dataKey="Receita"
                      fill="#a855f7"
                      radius={[0, 2, 2, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabela clicável abaixo do chart */}
                <table className="mt-3 w-full font-body text-xs">
                  <tbody>
                    {topClientes.map((c, i) => (
                      <tr
                        key={c.id}
                        className="border-t border-gray-50 first:border-0"
                      >
                        <td className="py-1.5 pr-2 text-gray-400 font-semibold w-6">
                          {i + 1}
                        </td>
                        <td className="py-1.5">
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="font-medium text-gray-800 hover:text-purple-600 hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right font-semibold text-purple-700">
                          {fmt(c.receita)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Evolução de receitas */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Evolução de Receitas — 12 meses
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={evolucaoData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={52}
              />
              <Tooltip
                formatter={(v) => (typeof v === "number" ? fmt(v) : v)}
              />
              <Bar dataKey="Receitas" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cards de métricas extras */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="A Receber"
          value={fmt(kpis.aReceber)}
          href="/dashboard/financeiro"
        />
        <KpiCard
          label="A Pagar"
          value={fmt(kpis.aPagar)}
          href="/dashboard/financeiro"
        />
        <KpiCard
          label="Total Processos"
          value={String(counts.totalProcessos)}
          href="/dashboard/processos"
        />
        <KpiCard
          label="Total Colaboradores"
          value={String(counts.totalColaboradores)}
          href="/dashboard/colaboradores"
        />
        <KpiCard
          label="Total Leads (CRM)"
          value={String(crm.leadsTotal)}
          href="/dashboard/crm"
        />
        <KpiCard
          label="Leads Convertidos"
          value={String(crm.leadsFechados)}
          sub="fechados como clientes"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Taxa de Conversão"
          value={`${crm.taxaConversao.toFixed(1)}%`}
          sub="fechados / (fechados + perdidos)"
          href="/dashboard/crm"
        />
        <KpiCard
          label="Leads Perdidos"
          value={String(crm.leadsTotal - crm.leadsAtivos - crm.leadsFechados)}
          alert={crm.leadsTotal - crm.leadsAtivos - crm.leadsFechados > 0}
          href="/dashboard/crm"
        />
      </div>
    </div>
  );
}

// ── Aba Analítico ─────────────────────────────────────────────────────────────

function AnaliticoTab({ data }: { data: GerenciadorData }) {
  const {
    receitasPorCategoria,
    processosPorTipo,
    controlesPorTipo,
    vencidos,
    crm,
  } = data;

  const totalControles = controlesPorTipo.reduce((s, t) => s + t.count, 0);
  const totalCategorias = receitasPorCategoria.reduce((s, c) => s + c.total, 0);

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
      {/* Receitas por Categoria + tabela */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-heading text-sm font-semibold text-gray-800">
              Receitas Recebidas por Categoria
            </h3>
          </div>
          <div className="p-4">
            {catData.length === 0 ? (
              <EmptyState msg="Sem dados" />
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={catData}
                        dataKey="Valor"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                      >
                        {catData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => (typeof v === "number" ? fmt(v) : v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <table className="w-full font-body text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                          Categoria
                        </th>
                        <th className="pb-2 text-right font-semibold text-gray-500 uppercase tracking-wide">
                          Valor
                        </th>
                        <th className="pb-2 text-right font-semibold text-gray-500 uppercase tracking-wide">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {receitasPorCategoria.map((c, i) => (
                        <tr
                          key={c.categoria}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-1.5 pr-2">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    PIE_COLORS[i % PIE_COLORS.length],
                                }}
                              />
                              <Link
                                href="/dashboard/financeiro"
                                className="text-gray-700 hover:text-indigo-600 hover:underline transition-colors"
                              >
                                {c.categoria}
                              </Link>
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-semibold text-gray-800">
                            {fmt(c.total)}
                          </td>
                          <td className="py-1.5 text-right text-gray-500">
                            {totalCategorias > 0
                              ? ((c.total / totalCategorias) * 100).toFixed(1)
                              : "0"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Processos por Tipo */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            Processos por Tipo de Ação
          </h3>
          {tipoData.length === 0 ? (
            <EmptyState msg="Sem dados" />
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

      {/* Controles pendentes por tipo + Inadimplência */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Progress bars */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-heading text-sm font-semibold text-gray-800">
            Controles Pendentes por Tipo
          </h3>
          {controlesPorTipo.length === 0 ? (
            <EmptyState msg="Sem controles" />
          ) : (
            <div className="space-y-3">
              {controlesPorTipo.map((t, i) => {
                const pct =
                  totalControles > 0 ? (t.count / totalControles) * 100 : 0;
                return (
                  <div key={t.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-body text-xs text-gray-700">
                        {t.label}
                      </span>
                      <span className="font-body text-xs font-semibold text-gray-900">
                        {t.count}{" "}
                        <span className="font-normal text-gray-400">
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CRM — Funil por estágio */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-heading text-sm font-semibold text-gray-800">
            CRM — Funil de Vendas por Estágio
          </h3>
          {crm.leadsPorEstagio.length === 0 ? (
            <EmptyState msg="Nenhum lead cadastrado" />
          ) : (
            <div className="space-y-3">
              {crm.leadsPorEstagio.map((e, i) => {
                const pct =
                  crm.leadsTotal > 0 ? (e.count / crm.leadsTotal) * 100 : 0;
                const ESTAGIO_COLORS: Record<string, string> = {
                  novo_contato: "#3b82f6",
                  consulta_agendada: "#f59e0b",
                  em_analise: "#f97316",
                  proposta_enviada: "#8b5cf6",
                  fechado: "#22c55e",
                  perdido: "#94a3b8",
                };
                const color =
                  ESTAGIO_COLORS[e.estagio] ??
                  PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <div key={e.estagio}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-body text-xs text-gray-700">
                        {e.label}
                      </span>
                      <span className="font-body text-xs font-semibold text-gray-900">
                        {e.count}{" "}
                        <span className="font-normal text-gray-400">
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CRM — Leads por área */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-semibold text-gray-800">
            CRM — Leads por Área de Interesse
          </h3>
          {crm.leadsPorArea.length === 0 ? (
            <EmptyState msg="Nenhum lead com área definida" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={crm.leadsPorArea.map((a) => ({
                  name: a.area,
                  Leads: a.count,
                }))}
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
                <Bar dataKey="Leads" fill="#6366f1" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Inadimplência completa */}
        <SectionCard title="Inadimplência Completa" noPad>
          {vencidos.length === 0 ? (
            <EmptyState msg="Sem vencidos" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-gray-500">
                      Valor
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
                      Vencto
                    </th>
                    <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                      Atraso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vencidos.map((v) => {
                    const href = v.client_id
                      ? `/dashboard/clientes/${v.client_id}`
                      : "/dashboard/financeiro";
                    return (
                      <ClickableRow key={v.id} href={href}>
                        <td className="max-w-[130px] truncate px-3 py-2 font-medium text-gray-800">
                          {v.descricao}
                        </td>
                        <td className="max-w-[90px] truncate px-3 py-2 text-gray-500">
                          {v.client_name ?? "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                            v.tipo === "entrada"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {fmt(v.valor)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                          {v.data_vencimento}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${atrasoBadge(v.dias_atraso)}`}
                          >
                            {v.dias_atraso}d
                          </span>
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

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
      {/* Tab Buttons */}
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

      {/* Tab Content */}
      {tab === "operacional" && <OperacionalTab data={data} />}
      {tab === "tatico" && <TaticoTab data={data} />}
      {tab === "estrategico" && <EstrategicoTab data={data} />}
      {tab === "analitico" && <AnaliticoTab data={data} />}
    </div>
  );
}
