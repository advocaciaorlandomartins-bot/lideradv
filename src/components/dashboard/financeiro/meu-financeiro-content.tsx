"use client";

import Link from "next/link";
import type {
  MeuFinanceiroDados,
  FluxoMensal,
  ProcessoHonorario,
} from "@/lib/lancamentos-db";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color: "green" | "blue" | "red" | "slate" | "amber";
}) {
  const colors = {
    green: "text-emerald-600",
    blue: "text-primary",
    red: "text-red-600",
    slate: "text-slate-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="font-body text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-1 font-heading text-2xl font-bold ${colors[color]}`}>
        {fmt(value)}
      </p>
      {sub && <p className="mt-0.5 font-body text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

// ── Gráfico de barras empilhadas ──────────────────────────────────────────────

function GraficoFluxo({ fluxo }: { fluxo: FluxoMensal[] }) {
  const data = fluxo.map((f) => ({
    name: f.mes,
    Receitas: f.entradas,
    Despesas: f.saidas,
    Saldo: f.saldo,
  }));

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-heading text-sm font-semibold text-fg">
        Fluxo de Caixa — Próximos 6 Meses
      </h2>
      {fluxo.every((f) => f.entradas === 0 && f.saidas === 0) ? (
        <div className="flex h-48 items-center justify-center text-center">
          <div>
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum lançamento futuro cadastrado
            </p>
            <Link
              href="/dashboard/financeiro/novo?tipo=entrada"
              className="mt-2 inline-block font-body text-xs text-primary underline"
            >
              Adicionar lançamento
            </Link>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
              }
            />
            <Tooltip
              formatter={(v) => fmt(Number(v))}
              labelStyle={{ fontWeight: 600, fontSize: 12 }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
            <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Tabela de processos ───────────────────────────────────────────────────────

function TabelaProcessos({ processos }: { processos: ProcessoHonorario[] }) {
  if (processos.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-heading text-sm font-semibold text-fg">
          Honorários Esperados por Processo
        </h2>
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <div className="text-center">
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo ativo com honorário definido
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Preencha o campo <strong>Honorários</strong> nos processos para
              ver a projeção aqui.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Honorários Esperados por Processo ({processos.length})
        </h2>
        <p className="font-body text-xs text-muted">
          Processos ativos com valor de honorário cadastrado (estimativa, não
          garantia de recebimento)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-slate-50/60">
              {[
                "Cliente",
                "Tipo de Ação",
                "Modelo",
                "Valor Causa",
                "Honorário Estimado",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {processos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="font-body text-sm font-semibold text-primary hover:underline"
                  >
                    {p.client_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-body text-sm text-fg">
                  {p.tipo_acao}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-body text-xs font-semibold text-primary">
                    {p.modelo_honorario ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 font-body text-sm text-muted">
                  {p.valor_causa ? fmt(p.valor_causa) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="font-body text-sm font-bold text-emerald-600">
                    {fmt(p.honorario_estimado)}
                  </span>
                  {p.percentual_honorario && !p.valor_honorario && (
                    <span className="ml-1 font-body text-[11px] text-muted">
                      ({p.percentual_honorario}%)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-slate-50">
              <td
                colSpan={4}
                className="px-4 py-3 font-body text-sm font-semibold text-muted"
              >
                Total esperado (se todos deferidos)
              </td>
              <td className="px-4 py-3">
                <span className="font-heading text-base font-bold text-emerald-600">
                  {fmt(processos.reduce((s, p) => s + p.honorario_estimado, 0))}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Resumo mensal do fluxo ────────────────────────────────────────────────────

function ResumoMensal({ fluxo }: { fluxo: FluxoMensal[] }) {
  const comDados = fluxo.filter((f) => f.entradas > 0 || f.saidas > 0);
  if (comDados.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Resumo por Mês
        </h2>
      </div>
      <div className="divide-y divide-border">
        {fluxo.map((f) => (
          <div
            key={f.mesISO}
            className="flex items-center justify-between px-5 py-3"
          >
            <span className="font-body text-sm font-semibold text-fg w-20">
              {f.mes}
            </span>
            <div className="flex flex-1 items-center gap-6 justify-end">
              <div className="text-right">
                <p className="font-body text-[10px] text-muted">Receitas</p>
                <p className="font-body text-sm font-semibold text-emerald-600">
                  {fmt(f.entradas)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-body text-[10px] text-muted">Despesas</p>
                <p className="font-body text-sm font-semibold text-red-500">
                  {fmt(f.saidas)}
                </p>
              </div>
              <div className="text-right min-w-[90px]">
                <p className="font-body text-[10px] text-muted">Saldo</p>
                <p
                  className={`font-body text-sm font-bold ${f.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {fmt(f.saldo)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MeuFinanceiroContent({
  dados,
}: {
  dados: MeuFinanceiroDados;
}) {
  const { kpis, fluxo, processosHonorarios } = dados;

  return (
    <div className="space-y-5">
      {/* Aviso */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 font-body text-sm text-blue-800">
        💡 <strong>Meu Painel Financeiro</strong> — visão geral dos seus
        honorários esperados, lançamentos e projeção dos próximos 6 meses. Para
        cadastrar honorários num processo, acesse o processo e preencha o campo{" "}
        <strong>Honorários</strong>.
      </div>

      {/* KPIs do mês */}
      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-muted uppercase tracking-wide">
          Este mês
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Recebido este mês"
            value={kpis.recebidoMes}
            color="green"
          />
          <KpiCard
            label="A receber este mês"
            value={kpis.aReceberMes}
            color="amber"
            sub="lançamentos com vencimento no mês"
          />
          <KpiCard
            label="Despesas do mês"
            value={kpis.despesasMes}
            color="red"
          />
          <KpiCard
            label="Saldo do mês"
            value={kpis.saldoMes}
            color={kpis.saldoMes >= 0 ? "green" : "red"}
            sub="recebido − despesas"
          />
        </div>
      </div>

      {/* KPIs gerais */}
      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-muted uppercase tracking-wide">
          Visão geral
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            label="Total a receber (lançamentos pendentes)"
            value={kpis.totalAReceber}
            color="blue"
            sub="todas as entradas pendentes cadastradas"
          />
          <KpiCard
            label="Honorários previstos (processos ativos)"
            value={kpis.totalPrevisto}
            color="slate"
            sub={`${processosHonorarios.length} processo${processosHonorarios.length !== 1 ? "s" : ""} com honorário definido`}
          />
        </div>
      </div>

      {/* Gráfico de fluxo */}
      <GraficoFluxo fluxo={fluxo} />

      {/* Resumo mensal */}
      <ResumoMensal fluxo={fluxo} />

      {/* Tabela de processos */}
      <TabelaProcessos processos={processosHonorarios} />

      {/* Link para lançamentos */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/financeiro/novo?tipo=entrada"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          + Nova Receita
        </Link>
        <Link
          href="/dashboard/financeiro/novo?tipo=saida"
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          + Nova Despesa
        </Link>
        <Link
          href="/dashboard/financeiro"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
        >
          Ver todos os lançamentos
        </Link>
      </div>
    </div>
  );
}
