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
import type {
  GerenciadorData,
  ProducaoCasoUrgente,
} from "@/lib/gerenciador-db";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "operacional" | "tatico" | "estrategico" | "analitico" | "equipe";

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

// ── Pipeline Fluxo Completo ───────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    key: "crm_ativos",
    label: "Leads Ativos",
    sub: "CRM",
    color: "#6366f1",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    href: "/dashboard/crm",
  },
  {
    key: "crm_fechados",
    label: "Fechados",
    sub: "CRM → Cliente",
    color: "#22c55e",
    bg: "bg-green-50",
    border: "border-green-200",
    href: "/dashboard/crm",
  },
  {
    key: "analise",
    label: "Análise",
    sub: "Produção",
    color: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    href: "/dashboard/producao",
  },
  {
    key: "producao",
    label: "Produção",
    sub: "Produção",
    color: "#14b8a6",
    bg: "bg-teal-50",
    border: "border-teal-200",
    href: "/dashboard/producao",
  },
  {
    key: "administrativo",
    label: "Administrativo",
    sub: "Produção",
    color: "#f97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    href: "/dashboard/producao",
  },
  {
    key: "judicial",
    label: "Judicial",
    sub: "Produção",
    color: "#8b5cf6",
    bg: "bg-purple-50",
    border: "border-purple-200",
    href: "/dashboard/producao",
  },
  {
    key: "arquivado",
    label: "Arquivados",
    sub: "Produção",
    color: "#94a3b8",
    bg: "bg-slate-50",
    border: "border-slate-200",
    href: "/dashboard/producao",
  },
] as const;

function PipelineFluxo({ data }: { data: GerenciadorData }) {
  const { crm, producao } = data;

  const counts: Record<string, number> = {
    crm_ativos: crm.leadsAtivos,
    crm_fechados: crm.leadsFechados,
    analise:
      producao.porEstagio.find((e) => e.estagio === "analise")?.count ?? 0,
    producao:
      producao.porEstagio.find((e) => e.estagio === "producao")?.count ?? 0,
    administrativo:
      producao.porEstagio.find((e) => e.estagio === "administrativo")?.count ??
      0,
    judicial:
      producao.porEstagio.find((e) => e.estagio === "judicial")?.count ?? 0,
    arquivado:
      producao.porEstagio.find((e) => e.estagio === "arquivado")?.count ?? 0,
  };

  const maxDias: Record<string, number> = {
    analise:
      producao.porEstagio.find((e) => e.estagio === "analise")?.max_dias ?? 0,
    producao:
      producao.porEstagio.find((e) => e.estagio === "producao")?.max_dias ?? 0,
    administrativo:
      producao.porEstagio.find((e) => e.estagio === "administrativo")
        ?.max_dias ?? 0,
    judicial:
      producao.porEstagio.find((e) => e.estagio === "judicial")?.max_dias ?? 0,
  };

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="font-heading text-sm font-semibold text-gray-800">
          Pipeline Completo — CRM → Produção
        </h2>
        <p className="font-body text-xs text-gray-400">
          Fluxo integrado: lead captado → cliente convertido → caso em produção
          → resultado
        </p>
      </div>
      <div className="overflow-x-auto px-4 py-4">
        <div
          className="flex items-stretch gap-0"
          style={{ minWidth: "max-content" }}
        >
          {PIPELINE_STAGES.map((stage, i) => {
            const count = counts[stage.key] ?? 0;
            const dias = maxDias[stage.key];
            const alert = dias !== undefined && dias > 30;
            const warn = dias !== undefined && dias > 7 && dias <= 30;
            const isLast = i === PIPELINE_STAGES.length - 1;
            const isCrmStage = stage.key.startsWith("crm_");

            return (
              <div key={stage.key} className="flex items-center">
                <Link
                  href={stage.href}
                  className={`group flex w-[130px] flex-col rounded-xl border-2 p-3 transition-all hover:shadow-md ${stage.bg} ${stage.border} ${alert ? "ring-2 ring-red-300 ring-offset-1" : ""}`}
                >
                  {/* Sub-label */}
                  <span className="mb-1 font-body text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                    {stage.sub}
                  </span>
                  {/* Count */}
                  <span
                    className="font-heading text-3xl font-bold leading-none"
                    style={{ color: stage.color }}
                  >
                    {count}
                  </span>
                  {/* Label */}
                  <span className="mt-1 font-body text-xs font-semibold text-gray-700">
                    {stage.label}
                  </span>
                  {/* Dias alerta */}
                  {dias !== undefined && dias > 0 && (
                    <span
                      className={`mt-1.5 inline-flex w-fit items-center rounded-full px-1.5 py-0.5 font-body text-[10px] font-semibold
                        ${alert ? "bg-red-100 text-red-700" : warn ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {alert ? "⚠ " : ""}
                      {dias}d parado
                    </span>
                  )}
                  {isCrmStage && (
                    <span className="mt-1.5 font-body text-[10px] text-gray-400 group-hover:text-indigo-600">
                      Ver CRM →
                    </span>
                  )}
                </Link>

                {/* Seta */}
                {!isLast && (
                  <div className="flex h-full items-center px-1">
                    <svg
                      className="h-5 w-5 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda de divisão CRM / Produção */}
      <div className="flex items-center gap-6 border-t border-gray-50 px-5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          <span className="font-body text-xs text-gray-500">
            CRM — Funil de Vendas
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          <span className="font-body text-xs text-gray-500">
            Produção — Linha Jurídica
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="font-body text-xs text-gray-500">
            ⚠ Casos parados há +30 dias
          </span>
        </div>
      </div>
    </div>
  );
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

const ESTAGIO_PRODUCAO_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  analise: { label: "Análise", color: "bg-blue-100 text-blue-700" },
  producao: { label: "Produção", color: "bg-teal-100 text-teal-700" },
  administrativo: {
    label: "Administrativo",
    color: "bg-orange-100 text-orange-700",
  },
  judicial: { label: "Judicial", color: "bg-purple-100 text-purple-700" },
};

function CasosProducaoTable({ casos }: { casos: ProducaoCasoUrgente[] }) {
  if (casos.length === 0) return <EmptyState msg="Nenhum caso em produção" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-body text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
              Cliente
            </th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-gray-500">
              Tipo de Ação
            </th>
            <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
              Etapa
            </th>
            <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
              Dias
            </th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => {
            const meta = ESTAGIO_PRODUCAO_LABELS[c.estagio_producao];
            const diasCls =
              c.dias_no_estagio > 30
                ? "bg-red-100 text-red-700 border border-red-200"
                : c.dias_no_estagio > 7
                  ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200";
            return (
              <ClickableRow key={c.id} href="/dashboard/producao">
                <td className="max-w-[140px] truncate px-3 py-2 font-medium text-gray-800">
                  {c.client_name}
                </td>
                <td className="max-w-[140px] truncate px-3 py-2 text-gray-500">
                  {c.tipo_acao}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta?.color ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {meta?.label ?? c.estagio_producao}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${diasCls}`}
                  >
                    {c.dias_no_estagio}d
                  </span>
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OperacionalTab({ data }: { data: GerenciadorData }) {
  const { counts, proximosControles, vencidos, crm, producao } = data;

  const controlesHojeAmanha = proximosControles.filter(
    (c) => c.dias_restantes <= 1
  ).length;
  const casosParados = producao.casosUrgentes.filter(
    (c) => c.dias_no_estagio > 30
  ).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
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
          label="Em Produção"
          value={String(producao.totalAtivos)}
          sub="casos em andamento"
          href="/dashboard/producao"
        />
        <KpiCard
          label="Casos Parados +30d"
          value={String(casosParados)}
          sub="precisam de atenção"
          alert={casosParados > 0}
          href="/dashboard/producao"
        />
      </div>

      {/* Casos em Produção + Tarefas CRM */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Casos em Produção — Mais Antigos" noPad>
          <CasosProducaoTable casos={producao.casosUrgentes} />
        </SectionCard>

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
      </div>

      {/* Controles + Vencidos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

// ── Aba Equipe ────────────────────────────────────────────────────────────────

const TIPO_LABELS_CONTROLE: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Implantado",
  alvaras: "Alvará",
};

function EquipeTab({ data }: { data: GerenciadorData }) {
  const { equipe } = data;
  const comPendencias = equipe.filter(
    (m) => m.tarefas.length + m.controles.length > 0
  );
  const semPendencias = equipe.filter(
    (m) => m.tarefas.length + m.controles.length === 0
  );

  return (
    <div className="space-y-6">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs text-muted">Colaboradores</p>
          <p className="mt-1 font-heading text-2xl font-bold text-fg">
            {equipe.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs text-muted">Com pendências</p>
          <p className="mt-1 font-heading text-2xl font-bold text-amber-600">
            {comPendencias.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs text-muted">Tarefas pendentes</p>
          <p className="mt-1 font-heading text-2xl font-bold text-teal-600">
            {equipe.reduce((s, m) => s + m.tarefas.length, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs text-muted">Controles pendentes</p>
          <p className="mt-1 font-heading text-2xl font-bold text-violet-600">
            {equipe.reduce((s, m) => s + m.controles.length, 0)}
          </p>
        </div>
      </div>

      {/* Cards por membro */}
      {comPendencias.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 py-16 text-center">
          <p className="font-heading text-base font-semibold text-fg">
            Equipe em dia!
          </p>
          <p className="mt-1 font-body text-sm text-muted">
            Nenhum colaborador tem pendências no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {comPendencias.map((m) => (
            <div
              key={m.id}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
            >
              {/* Header do membro */}
              <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                  {m.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-semibold text-fg truncate">
                    {m.nome}
                  </p>
                  <p className="font-body text-xs text-muted">{m.categoria}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.tarefas.length > 0 && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 font-body text-[11px] font-bold text-teal-700">
                      {m.tarefas.length}T
                    </span>
                  )}
                  {m.controles.length > 0 && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 font-body text-[11px] font-bold text-violet-700">
                      {m.controles.length}C
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de itens */}
              <ul className="divide-y divide-border">
                {m.tarefas.map((t) => (
                  <li
                    key={`t-${t.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[10px] font-semibold bg-teal-100 text-teal-700">
                      Tarefa
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-semibold text-fg leading-snug truncate">
                        {t.titulo}
                      </p>
                      {t.client_name && (
                        <p className="font-body text-xs text-primary font-semibold truncate">
                          {t.client_name}
                        </p>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {t.processo_numero && (
                          <span className="font-body text-[10px] text-muted">
                            Proc. {t.processo_numero}
                          </span>
                        )}
                        {t.prazo && (
                          <span className="font-body text-[10px] text-muted">
                            Prazo:{" "}
                            {new Date(t.prazo + "T00:00:00").toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        )}
                        <span
                          className={`rounded px-1 py-0.5 font-body text-[10px] font-semibold ${
                            t.prioridade === "Alta"
                              ? "bg-red-100 text-red-700"
                              : t.prioridade === "Normal"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t.prioridade}
                        </span>
                        <span
                          className={`rounded px-1 py-0.5 font-body text-[10px] font-semibold ${
                            t.status === "Em andamento"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                    {t.processo_id ? (
                      <Link
                        href={`/dashboard/processos/${t.processo_id}`}
                        className="flex-shrink-0 rounded-lg border border-border px-2 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver
                      </Link>
                    ) : t.client_id ? (
                      <Link
                        href={`/dashboard/clientes/${t.client_id}`}
                        className="flex-shrink-0 rounded-lg border border-border px-2 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver
                      </Link>
                    ) : null}
                  </li>
                ))}
                {m.controles.map((c) => (
                  <li
                    key={`c-${c.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[10px] font-semibold bg-violet-100 text-violet-700">
                      {TIPO_LABELS_CONTROLE[c.tipo] ?? c.tipo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-semibold text-fg leading-snug truncate">
                        {c.descricao}
                      </p>
                      {c.client_name && (
                        <p className="font-body text-xs text-primary font-semibold truncate">
                          {c.client_name}
                        </p>
                      )}
                      {c.data_evento && (
                        <p className="mt-0.5 font-body text-[10px] text-muted">
                          {new Date(
                            c.data_evento + "T00:00:00"
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    {c.processo_id ? (
                      <Link
                        href={`/dashboard/processos/${c.processo_id}`}
                        className="flex-shrink-0 rounded-lg border border-border px-2 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver
                      </Link>
                    ) : c.client_id ? (
                      <Link
                        href={`/dashboard/clientes/${c.client_id}`}
                        className="flex-shrink-0 rounded-lg border border-border px-2 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Sem pendências */}
      {semPendencias.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Em dia ({semPendencias.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {semPendencias.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-body text-xs font-semibold text-emerald-700"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {m.nome}
              </span>
            ))}
          </div>
        </div>
      )}
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
    {
      key: "equipe",
      label: "Equipe",
      sub: "Tarefas por colaborador",
      activeBorder: "border-teal-500",
      activeBg: "bg-teal-50",
      dot: "bg-teal-500",
      activeLabel: "text-teal-800",
      activeSub: "text-teal-600",
    },
  ];

  return (
    <div>
      {/* Pipeline sempre visível */}
      <PipelineFluxo data={data} />

      {/* Tab Buttons */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
      {tab === "equipe" && <EquipeTab data={data} />}
    </div>
  );
}
