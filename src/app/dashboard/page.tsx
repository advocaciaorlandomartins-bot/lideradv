import Link from "next/link";
import { getGerenciadorData } from "@/lib/gerenciador-db";
import { getDashboardData } from "@/lib/dashboard-db";
import { getSession } from "@/lib/session";
import MiniCalendar from "@/components/dashboard/mini-calendar";
import {
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  CalendarIcon,
  ClockIcon,
  AlertIcon,
  UserPlusIcon,
  PlusIcon,
  ChartBarIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function urgencyBadge(dias: number): {
  label: string;
  cls: string;
  dotCls: string;
} {
  if (dias === 0)
    return {
      label: "Hoje",
      cls: "bg-red-100 text-red-700",
      dotCls: "bg-red-500",
    };
  if (dias === 1)
    return {
      label: "Amanhã",
      cls: "bg-orange-100 text-orange-700",
      dotCls: "bg-orange-500",
    };
  if (dias <= 3)
    return {
      label: `${dias}d`,
      cls: "bg-amber-100 text-amber-700",
      dotCls: "bg-amber-500",
    };
  if (dias <= 7)
    return {
      label: `${dias}d`,
      cls: "bg-blue-100 text-blue-700",
      dotCls: "bg-blue-400",
    };
  return {
    label: `${dias}d`,
    cls: "bg-slate-100 text-slate-600",
    dotCls: "bg-slate-400",
  };
}

const TIPO_COLORS: Record<string, string> = {
  audiencias: "bg-violet-100 text-violet-700",
  prazos: "bg-red-100 text-red-700",
  pericias: "bg-cyan-100 text-cyan-700",
  dcb: "bg-orange-100 text-orange-700",
  beneficios: "bg-emerald-100 text-emerald-700",
  implantados: "bg-blue-100 text-blue-700",
  "implantados-data": "bg-blue-100 text-blue-700",
  alvaras: "bg-amber-100 text-amber-700",
};

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({
  data,
}: {
  data: { mesLabel: string; receitas: number; despesas: number }[];
}) {
  const max = Math.max(...data.map((d) => Math.max(d.receitas, d.despesas)), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div
          key={d.mesLabel}
          className="flex flex-1 flex-col items-center gap-1"
        >
          <div
            className="flex w-full items-end gap-0.5"
            style={{ height: "128px" }}
          >
            <div
              className="flex-1 rounded-t bg-emerald-400 opacity-90 transition-all"
              style={{
                height: `${(d.receitas / max) * 100}%`,
                minHeight: d.receitas > 0 ? "2px" : "0",
              }}
              title={`Receitas: ${fmt(d.receitas)}`}
            />
            <div
              className="flex-1 rounded-t bg-red-400 opacity-80 transition-all"
              style={{
                height: `${(d.despesas / max) * 100}%`,
                minHeight: d.despesas > 0 ? "2px" : "0",
              }}
              title={`Despesas: ${fmt(d.despesas)}`}
            />
          </div>
          <span className="whitespace-nowrap font-body text-[10px] text-muted">
            {d.mesLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [data, dashData, session] = await Promise.all([
    getGerenciadorData(),
    getDashboardData(),
    getSession(),
  ]);

  const { kpis, counts, receitasPorMes } = data;
  const { clientesDevedores, lancamentosVencidos, proximosControles } =
    dashData;

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // No eventDays needed — MiniCalendar receives full events and filters internally

  const chartData = receitasPorMes.slice(-6);

  const quickActions = [
    {
      label: "Novo cliente",
      icon: UserPlusIcon,
      href: "/dashboard/clientes/novo",
    },
    {
      label: "Novo processo",
      icon: PlusIcon,
      href: "/dashboard/processos/novo",
    },
    {
      label: "Financeiro",
      icon: BanknotesIcon,
      href: "/dashboard/financeiro/novo",
    },
    {
      label: "Gerenciador",
      icon: ChartBarIcon,
      href: "/dashboard/gerenciador",
    },
  ];

  const nomeUsuario = session?.login
    ? session.login.charAt(0).toUpperCase() + session.login.slice(1)
    : "Orlando";

  const totalVencido = clientesDevedores.reduce(
    (s, c) => s + c.total_vencido,
    0
  );

  return (
    <div className="space-y-6">
      {/* ── Saudação + ações rápidas ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            {getGreeting()}, Dr.&nbsp;{nomeUsuario}.
          </h1>
          <p className="mt-1 font-body text-sm text-muted capitalize">
            {today}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 font-body text-xs font-semibold text-fg shadow-sm transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── KPI cards (todos clicáveis) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Clientes */}
        <Link
          href="/dashboard/clientes"
          className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-blue-50 p-2.5 transition-colors group-hover:bg-blue-100">
              <UsersIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="font-body text-xs font-semibold text-emerald-600">
              Ativos
            </span>
          </div>
          <p className="mt-3 font-heading text-3xl font-bold text-fg">
            {counts.totalClientes}
          </p>
          <p className="mt-0.5 font-body text-xs font-semibold text-muted">
            Clientes
          </p>
          <p className="mt-2 font-body text-xs text-blue-600 group-hover:underline">
            {counts.totalColaboradores} colaborador
            {counts.totalColaboradores !== 1 ? "es" : ""} →
          </p>
        </Link>

        {/* Processos */}
        <Link
          href="/dashboard/processos"
          className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-amber-50 p-2.5 transition-colors group-hover:bg-amber-100">
              <FolderOpenIcon className="h-5 w-5 text-amber-600" />
            </div>
            <span className="font-body text-xs font-semibold text-amber-600">
              Ativos
            </span>
          </div>
          <p className="mt-3 font-heading text-3xl font-bold text-fg">
            {counts.totalProcessos}
          </p>
          <p className="mt-0.5 font-body text-xs font-semibold text-muted">
            Processos
          </p>
          <p
            className={`mt-2 font-body text-xs group-hover:underline ${counts.controlesProximos > 0 ? "text-red-500 font-semibold" : "text-muted"}`}
          >
            {counts.controlesProximos} controle
            {counts.controlesProximos !== 1 ? "s" : ""} esta semana →
          </p>
        </Link>

        {/* Receita do mês */}
        <Link
          href="/dashboard/financeiro"
          className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-emerald-50 p-2.5 transition-colors group-hover:bg-emerald-100">
              <BanknotesIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <span
              className={`font-body text-xs font-semibold ${kpis.saldoMes >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {kpis.saldoMes >= 0 ? "▲" : "▼"} Saldo
            </span>
          </div>
          <p className="mt-3 font-heading text-2xl font-bold text-fg">
            {fmt(kpis.recebidoMes)}
          </p>
          <p className="mt-0.5 font-body text-xs font-semibold text-muted">
            Receita do mês
          </p>
          <p
            className={`mt-2 font-body text-xs font-semibold group-hover:underline ${kpis.saldoMes >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            Saldo: {fmt(kpis.saldoMes)} →
          </p>
        </Link>

        {/* Controles / Alertas */}
        <Link
          href="/dashboard/controles"
          className={`group rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${counts.controlesProximos > 0 ? "border-red-200 hover:border-red-300" : "border-border hover:border-primary/30"}`}
        >
          <div className="flex items-start justify-between">
            <div
              className={`rounded-lg p-2.5 ${counts.controlesProximos > 0 ? "bg-red-50 group-hover:bg-red-100" : "bg-slate-50 group-hover:bg-slate-100"} transition-colors`}
            >
              {counts.controlesProximos > 0 ? (
                <AlertIcon className="h-5 w-5 text-red-500" />
              ) : (
                <CalendarIcon className="h-5 w-5 text-slate-400" />
              )}
            </div>
            {counts.vencidosCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-body text-xs font-bold text-red-600">
                {counts.vencidosCount} vencido
                {counts.vencidosCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p
            className={`mt-3 font-heading text-3xl font-bold ${counts.controlesProximos > 0 ? "text-red-600" : "text-fg"}`}
          >
            {counts.controlesProximos}
          </p>
          <p className="mt-0.5 font-body text-xs font-semibold text-muted">
            Prazos esta semana
          </p>
          <p
            className={`mt-2 font-body text-xs group-hover:underline ${kpis.vencidosValor > 0 ? "text-red-500 font-semibold" : "text-muted"}`}
          >
            {kpis.vencidosValor > 0
              ? `${fmt(kpis.vencidosValor)} em atraso →`
              : "Sem pendências →"}
          </p>
        </Link>
      </div>

      {/* ── Prazos + Calendário ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Tabela de próximos controles — cada linha é clicável */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-fg">
                Próximos Prazos e Controles
              </h2>
              <p className="mt-0.5 font-body text-xs text-muted">
                Próximos 14 dias
              </p>
            </div>
            {counts.controlesProximos > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1 font-body text-xs font-semibold text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {counts.controlesProximos} esta semana
              </span>
            )}
          </div>

          {proximosControles.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-slate-200" />
              <p className="font-body text-sm text-muted">
                Nenhum controle nos próximos 14 dias.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {proximosControles.map((c) => {
                const urg = urgencyBadge(c.dias_restantes);
                const tipoCls =
                  TIPO_COLORS[c.tipo] ?? "bg-slate-100 text-slate-600";
                const href = `/dashboard/controles/${c.id}`;
                return (
                  <Link
                    key={c.id}
                    href={href}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-primary/5 cursor-pointer"
                  >
                    {/* Data */}
                    <div className="w-12 flex-shrink-0 text-center">
                      <span
                        className={`mb-1 inline-block h-1.5 w-1.5 rounded-full ${urg.dotCls}`}
                      />
                      <p className="font-body text-xs font-semibold text-muted">
                        {fmtDateShort(c.data_evento)}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-body text-[11px] font-semibold ${tipoCls}`}
                        >
                          {c.tipo_label}
                        </span>
                        {c.processo_numero && (
                          <span className="font-body text-[11px] text-muted">
                            Proc.&nbsp;{c.processo_numero}
                          </span>
                        )}
                      </div>
                      <p className="truncate font-body text-sm text-fg">
                        {c.descricao}
                      </p>
                      {c.cliente_nome && (
                        <p className="font-body text-xs font-semibold text-primary">
                          {c.cliente_nome}
                        </p>
                      )}
                    </div>

                    {/* Badge urgência */}
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-0.5 font-body text-xs font-bold ${urg.cls}`}
                    >
                      {urg.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="border-t border-border px-5 py-3">
            <Link
              href="/dashboard/controles"
              className="font-body text-xs font-semibold text-primary hover:underline"
            >
              Ver todos os controles →
            </Link>
          </div>
        </div>

        {/* Calendário + Resumo Financeiro */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <MiniCalendar events={proximosControles} />

          {/* Resumo financeiro — linhas clicáveis */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-heading text-sm font-semibold text-fg">
              Resumo Financeiro
            </h2>
            <div className="space-y-1">
              {[
                {
                  label: "Recebido no mês",
                  value: kpis.recebidoMes,
                  cls: "text-emerald-600",
                  href: "/dashboard/financeiro?tipo=entrada&status=pago",
                },
                {
                  label: "Pago no mês",
                  value: kpis.pagoMes,
                  cls: "text-red-500",
                  href: "/dashboard/financeiro?tipo=saida&status=pago",
                },
                {
                  label: "A receber",
                  value: kpis.aReceber,
                  cls: "text-amber-600",
                  href: "/dashboard/financeiro?tipo=entrada&status=pendente",
                },
                {
                  label: "A pagar",
                  value: kpis.aPagar,
                  cls: "text-orange-600",
                  href: "/dashboard/financeiro?tipo=saida&status=pendente",
                },
              ].map(({ label, value, cls, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/5"
                >
                  <span className="font-body text-xs text-muted">{label}</span>
                  <span className={`font-body text-sm font-bold ${cls}`}>
                    {fmt(value)}
                  </span>
                </Link>
              ))}
              <div className="border-t border-border pt-2.5">
                <div className="flex items-center justify-between px-2">
                  <span className="font-body text-sm font-semibold text-fg">
                    Saldo do mês
                  </span>
                  <span
                    className={`font-body text-base font-bold ${kpis.saldoMes >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {fmt(kpis.saldoMes)}
                  </span>
                </div>
              </div>
            </div>

            {kpis.vencidosCount > 0 && (
              <Link
                href="/dashboard/financeiro?status=vencido"
                className="mt-3 block rounded-lg border border-red-100 bg-red-50 px-3 py-2 transition-colors hover:bg-red-100"
              >
                <p className="font-body text-xs font-semibold text-red-700">
                  ⚠ {kpis.vencidosCount} lançamento
                  {kpis.vencidosCount !== 1 ? "s" : ""} vencido
                  {kpis.vencidosCount !== 1 ? "s" : ""} —{" "}
                  {fmt(kpis.vencidosValor)}
                </p>
              </Link>
            )}

            <Link
              href="/dashboard/financeiro"
              className="mt-3 block font-body text-xs font-semibold text-primary hover:underline"
            >
              Ver financeiro completo →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Gráfico + Clientes em Débito ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Gráfico Receitas × Despesas */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold text-fg">
                Receitas × Despesas
              </h2>
              <p className="font-body text-xs text-muted">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-body text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                Receitas
              </span>
              <span className="flex items-center gap-1.5 font-body text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />
                Despesas
              </span>
            </div>
          </div>
          {chartData.every((d) => d.receitas === 0 && d.despesas === 0) ? (
            <div className="flex h-40 items-center justify-center">
              <p className="font-body text-sm text-muted">
                Sem dados financeiros ainda.
              </p>
            </div>
          ) : (
            <BarChart data={chartData} />
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            {[
              {
                label: "Recebido no ano",
                value: kpis.recebidoAno,
                cls: "text-emerald-600",
              },
              {
                label: "Pago no ano",
                value: kpis.pagoAno,
                cls: "text-red-500",
              },
              {
                label: "Saldo anual",
                value: kpis.recebidoAno - kpis.pagoAno,
                cls:
                  kpis.recebidoAno - kpis.pagoAno >= 0
                    ? "text-emerald-600"
                    : "text-red-600",
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-center">
                <p className="font-body text-xs text-muted">{label}</p>
                <p className={`mt-0.5 font-heading text-base font-bold ${cls}`}>
                  {fmt(value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes em Débito — cada linha leva ao financeiro do cliente */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-fg">
                Clientes em Débito
              </h2>
              <p className="mt-0.5 font-body text-xs text-muted">
                Honorários em atraso
              </p>
            </div>
            {clientesDevedores.length > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-body text-xs font-bold text-red-600">
                {clientesDevedores.length}
              </span>
            )}
          </div>

          {clientesDevedores.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BanknotesIcon className="mx-auto mb-2 h-8 w-8 text-slate-200" />
              <p className="font-body text-sm text-muted">
                Sem honorários em atraso.
              </p>
              <p className="mt-1 font-body text-xs font-semibold text-emerald-600">
                Tudo em dia!
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {clientesDevedores.map((c) => (
                <Link
                  key={c.client_id}
                  href={`/dashboard/clientes/${c.client_id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-50 cursor-pointer group"
                >
                  {/* Avatar inicial */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 font-heading text-xs font-bold text-red-600 group-hover:bg-red-200 transition-colors">
                    {c.client_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                      {c.client_name}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {c.count_vencidos} lançamento
                      {c.count_vencidos !== 1 ? "s" : ""} · {c.max_dias_atraso}d
                      atraso
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="font-body text-sm font-bold text-red-600">
                      {fmt(c.total_vencido)}
                    </p>
                    <p className="font-body text-[10px] text-muted group-hover:text-primary transition-colors">
                      ver →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Link
              href="/dashboard/financeiro"
              className="font-body text-xs font-semibold text-primary hover:underline"
            >
              Ver financeiro →
            </Link>
            {clientesDevedores.length > 0 && (
              <span className="font-body text-xs font-semibold text-red-600">
                Total: {fmt(totalVencido)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Vencidos detalhados (se houver) ─────────────────────────────── */}
      {lancamentosVencidos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-red-800">
                Lançamentos Vencidos
              </h2>
              <p className="mt-0.5 font-body text-xs text-red-600">
                Clique para abrir o financeiro do cliente
              </p>
            </div>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-body text-xs font-bold text-red-700">
              {lancamentosVencidos.length}
            </span>
          </div>

          <div className="divide-y divide-border">
            {lancamentosVencidos.slice(0, 10).map((v) => {
              const href = v.client_id
                ? `/dashboard/clientes/${v.client_id}`
                : "/dashboard/financeiro";
              return (
                <Link
                  key={v.id}
                  href={href}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-red-50 cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                      {v.descricao}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {v.client_name ?? "Sem cliente"} · venceu em{" "}
                      {v.data_vencimento}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-body text-sm font-bold text-red-600">
                      {fmt(v.valor)}
                    </p>
                    <p className="font-body text-xs text-red-400">
                      {v.dias_atraso}d atraso
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {lancamentosVencidos.length > 10 && (
            <div className="border-t border-border px-5 py-3">
              <Link
                href="/dashboard/financeiro"
                className="font-body text-xs font-semibold text-primary hover:underline"
              >
                + {lancamentosVencidos.length - 10} lançamentos — ver todos →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Acesso rápido às seções ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Clientes",
            icon: UsersIcon,
            href: "/dashboard/clientes",
            bg: "bg-blue-50",
            ic: "text-blue-600",
          },
          {
            label: "Processos",
            icon: FolderOpenIcon,
            href: "/dashboard/processos",
            bg: "bg-amber-50",
            ic: "text-amber-600",
          },
          {
            label: "Financeiro",
            icon: BanknotesIcon,
            href: "/dashboard/financeiro",
            bg: "bg-emerald-50",
            ic: "text-emerald-600",
          },
          {
            label: "Controles",
            icon: ClockIcon,
            href: "/dashboard/controles",
            bg: "bg-violet-50",
            ic: "text-violet-600",
          },
          {
            label: "Relatórios",
            icon: ChartBarIcon,
            href: "/dashboard/relatorios",
            bg: "bg-cyan-50",
            ic: "text-cyan-600",
          },
          {
            label: "Gerenciador",
            icon: AlertIcon,
            href: "/dashboard/gerenciador",
            bg: "bg-red-50",
            ic: "text-red-500",
          },
        ].map(({ label, icon: Icon, href, bg, ic }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className={`rounded-lg p-2.5 ${bg}`}>
              <Icon className={`h-5 w-5 ${ic}`} />
            </div>
            <span className="font-body text-xs font-semibold text-fg">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
