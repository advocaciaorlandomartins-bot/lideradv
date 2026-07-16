import Link from "next/link";
import { getGerenciadorData } from "@/lib/gerenciador-db";
import { getAllRecentEmails, countUnreadEmails } from "@/lib/inbound-emails-db";

export const metadata = {
  title: "Dashboard — LiderAdv",
};
import {
  getDashboardData,
  getAlertasPrevidenciarios,
} from "@/lib/dashboard-db";
import { countMinhasPendentes } from "@/lib/minhas-tarefas-db";
import { TIPO_LABELS_COMP, TIPO_ICONS_COMP } from "@/lib/compromissos-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import MiniCalendar from "@/components/dashboard/mini-calendar";
import DashboardAniversariosCard from "@/components/dashboard/dashboard-aniversarios-card";
import {
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  CalendarIcon,
  AlertIcon,
  UserPlusIcon,
  PlusIcon,
  ChartBarIcon,
  FunnelIcon,
  PhoneIcon,
  InboxArrowDownIcon,
  CheckCircleIcon,
  ArrowRightIcon,
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
  const h = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  ).getHours();
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

// ── Sem acesso — bloco neutro ─────────────────────────────────────────────────

function SemAcesso({ modulo }: { modulo: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-slate-50">
      <p className="font-body text-xs text-muted">
        Sem permissão de acesso a {modulo}.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  // ── Flags de permissão ────────────────────────────────────────────────────
  const perm = {
    clientes: hasPermission(session, "clientes", "ver"),
    processos: hasPermission(session, "processos", "ver"),
    financeiro: hasPermission(session, "financeiro", "ver"),
    controles: hasPermission(session, "controles", "ver"),
    crm: hasPermission(session, "crm", "ver"),
    producao: hasPermission(session, "producao", "ver"),
    gerenciador: hasPermission(session, "gerenciador", "ver"),
    relatorios: hasPermission(session, "relatorios", "ver"),
    modelos: hasPermission(session, "modelos", "ver"),
    dashboard_crm: hasPermission(session, "dashboard_crm", "ver"),
    dashboard_controles: hasPermission(session, "dashboard_controles", "ver"),
    dashboard_financeiro: hasPermission(session, "dashboard_financeiro", "ver"),
  };

  // ── Busca condicional de dados ────────────────────────────────────────────
  const showCrm = perm.crm && perm.dashboard_crm;
  const showControles = perm.controles && perm.dashboard_controles;
  const showFinanceiro = perm.financeiro && perm.dashboard_financeiro;

  const needsGerData =
    showFinanceiro || showCrm || perm.clientes || perm.processos;
  const needsDashData = showControles || showFinanceiro || perm.clientes;

  const [
    gerData,
    dashData,
    emailsRecentes,
    totalNaoLidos,
    minhasPendentes,
    alertasPrevidenciarios,
  ] = await Promise.all([
    needsGerData ? getGerenciadorData() : Promise.resolve(null),
    needsDashData ? getDashboardData(session.login) : Promise.resolve(null),
    perm.clientes
      ? getAllRecentEmails(20).catch(() => [])
      : Promise.resolve([]),
    perm.clientes ? countUnreadEmails().catch(() => 0) : Promise.resolve(0),
    countMinhasPendentes(session.login).catch(() => 0),
    perm.processos
      ? getAlertasPrevidenciarios().catch(() => [])
      : Promise.resolve([]),
  ]);

  const kpis = gerData?.kpis;
  const counts = gerData?.counts;
  const receitasPorMes = gerData?.receitasPorMes ?? [];
  const crm = gerData?.crm;
  const clientesDevedores = dashData?.clientesDevedores ?? [];
  const lancamentosVencidos = dashData?.lancamentosVencidos ?? [];
  const proximosControles = dashData?.proximosControles ?? [];
  const aniversariantesTodos = dashData?.aniversariantesTodos ?? [];
  const compromissosProximos = dashData?.compromissosProximos ?? [];

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hoje = new Date();
  const inicioSemana = hoje.toISOString().slice(0, 10);
  const fimSemana = new Date(hoje.getTime() + 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const chartData = receitasPorMes.slice(-6);
  const totalVencido = clientesDevedores.reduce(
    (s, c) => s + c.total_vencido,
    0
  );

  const nomeUsuario = session.nome || session.login || "Usuário";

  // ── Ações rápidas — apenas módulos com acesso ─────────────────────────────
  const quickActions = [
    {
      label: "Novo cliente",
      icon: UserPlusIcon,
      href: "/dashboard/clientes/novo",
      show: hasPermission(session, "clientes", "criar"),
    },
    {
      label: "Novo processo",
      icon: PlusIcon,
      href: "/dashboard/processos/novo",
      show: hasPermission(session, "processos", "criar"),
    },
    {
      label: "Novo lead",
      icon: FunnelIcon,
      href: "/dashboard/crm/leads/novo",
      show: hasPermission(session, "crm", "criar"),
    },
    {
      label: "Financeiro",
      icon: BanknotesIcon,
      href: "/dashboard/financeiro/novo",
      show: perm.financeiro,
    },
    {
      label: "Gerenciador",
      icon: ChartBarIcon,
      href: "/dashboard/gerenciador",
      show: perm.gerenciador,
    },
  ].filter((a) => a.show);

  return (
    <div className="space-y-6">
      {/* ── Saudação + ações rápidas ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg sm:text-3xl">
            {getGreeting()}, {nomeUsuario}.
          </h1>
          <p className="mt-1 font-body text-sm text-muted capitalize">
            {today}
          </p>
        </div>
        {quickActions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none sm:flex-wrap sm:overflow-visible sm:pb-0">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 font-body text-xs font-semibold text-fg shadow-sm transition-colors hover:border-primary hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Banner: minhas tarefas pendentes ────────────────────────────── */}
      {minhasPendentes > 0 && (
        <Link
          href="/dashboard/minhas-tarefas"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
        >
          <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="flex-1 font-body text-sm font-semibold text-amber-800">
            Você tem{" "}
            <span className="text-amber-700">
              {minhasPendentes} tarefa{minhasPendentes !== 1 ? "s" : ""}{" "}
              pendente{minhasPendentes !== 1 ? "s" : ""}
            </span>{" "}
            atribuída{minhasPendentes !== 1 ? "s" : ""} a você
          </p>
          <span className="flex items-center gap-1 font-body text-xs font-semibold text-amber-700">
            Ver minhas tarefas
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      {/* ── Alertas Previdenciários ─────────────────────────────────────── */}
      {alertasPrevidenciarios.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <AlertIcon className="h-4 w-4 text-orange-600" />
              <h2 className="font-heading text-sm font-semibold text-orange-900">
                Alertas Previdenciários
              </h2>
            </div>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 font-body text-xs font-bold text-orange-700">
              {alertasPrevidenciarios.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {alertasPrevidenciarios.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/processos/${a.processo_id}`}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-orange-50 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`rounded px-2 py-0.5 font-body text-[11px] font-semibold ${
                        a.tipo === "dcb_proxima"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {a.tipo === "dcb_proxima" ? "DCB Próxima" : "Indeferido"}
                    </span>
                    <span className="font-body text-xs text-muted truncate">
                      {a.tipo_acao}
                    </span>
                  </div>
                  <p className="font-body text-sm font-semibold text-fg">
                    {a.client_name}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-body text-xs font-semibold text-orange-700">
                    {a.data_ref}
                  </p>
                  {a.tipo === "dcb_proxima" && (
                    <p
                      className={`font-body text-xs ${a.dias <= 0 ? "text-red-600 font-bold" : a.dias <= 15 ? "text-orange-600" : "text-muted"}`}
                    >
                      {a.dias <= 0
                        ? `${Math.abs(a.dias)}d atrás`
                        : `em ${a.dias}d`}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3">
            <Link
              href="/dashboard/processos"
              className="font-body text-xs font-semibold text-orange-700 hover:underline"
            >
              Ver todos os processos →
            </Link>
          </div>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {perm.clientes && counts && (
          <Link
            href="/dashboard/clientes"
            className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
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
        )}

        {perm.processos && counts && (
          <Link
            href="/dashboard/processos"
            className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
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
        )}

        {perm.financeiro && kpis && (
          <Link
            href="/dashboard/financeiro"
            className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
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
            <p
              className="mt-3 font-heading text-sm font-bold text-fg sm:text-xl whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
              title={fmt(kpis.recebidoMes)}
            >
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
        )}

        {perm.controles && counts && (
          <div
            className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${counts.controlesProximos > 0 ? "border-red-200" : "border-border"}`}
          >
            <Link
              href={`/dashboard/controles?inicio=${inicioSemana}&fim=${fimSemana}&ordem=asc`}
              className="group block"
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
              </div>
              <p
                className={`mt-3 font-heading text-3xl font-bold ${counts.controlesProximos > 0 ? "text-red-600" : "text-fg"}`}
              >
                {counts.controlesProximos}
              </p>
              <p className="mt-0.5 font-body text-xs font-semibold text-muted">
                Prazos esta semana
              </p>
              <p className="mt-2 font-body text-xs text-muted group-hover:underline">
                {counts.controlesProximos > 0
                  ? "Ver prazos →"
                  : "0 controles esta semana →"}
              </p>
            </Link>
            {showFinanceiro && kpis && kpis.vencidosValor > 0 && (
              <Link
                href="/dashboard/financeiro?tab=receber"
                className="mt-2 block font-body text-xs font-semibold text-red-500 hover:underline"
              >
                {fmt(kpis.vencidosValor)} em atraso — ver →
              </Link>
            )}
          </div>
        )}

        {showCrm && crm && (
          <Link
            href="/dashboard/crm"
            className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-indigo-50 p-2.5 transition-colors group-hover:bg-indigo-100">
                <FunnelIcon className="h-5 w-5 text-indigo-600" />
              </div>
              {crm.tarefasVencidas > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 font-body text-xs font-bold text-orange-700">
                  {crm.tarefasVencidas} task
                </span>
              )}
            </div>
            <p className="mt-3 font-heading text-3xl font-bold text-fg">
              {crm.leadsAtivos}
            </p>
            <p className="mt-0.5 font-body text-xs font-semibold text-muted">
              Leads no funil
            </p>
            <p className="mt-2 font-body text-xs text-indigo-600 group-hover:underline">
              {crm.leadsFechados} convertido{crm.leadsFechados !== 1 ? "s" : ""}{" "}
              · {crm.taxaConversao.toFixed(0)}% conversão →
            </p>
          </Link>
        )}
      </div>

      {/* ── Aniversariantes — card com filtro por mês ────────────────────── */}
      {perm.clientes && aniversariantesTodos.length > 0 && (
        <DashboardAniversariosCard clientes={aniversariantesTodos} />
      )}

      {/* ── CRM — Funil + Tarefas (somente se tiver acesso ao CRM) ──────── */}
      {showCrm &&
        crm &&
        (crm.leadsAtivos > 0 || crm.tarefasProximas.length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Mini funil por estágio */}
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-heading text-base font-semibold text-fg">
                    Funil de Vendas CRM
                  </h2>
                  <p className="mt-0.5 font-body text-xs text-muted">
                    {crm.leadsTotal} lead{crm.leadsTotal !== 1 ? "s" : ""} total
                  </p>
                </div>
                <Link
                  href="/dashboard/crm"
                  className="font-body text-xs font-semibold text-primary hover:underline"
                >
                  Ver CRM →
                </Link>
              </div>
              <div className="space-y-3 p-5">
                {crm.leadsTotal === 0 ? (
                  <p className="py-4 text-center font-body text-sm text-muted">
                    Nenhum lead cadastrado ainda.
                  </p>
                ) : (
                  (() => {
                    const ESTAGIO_COLORS: Record<
                      string,
                      { bar: string; dot: string; text: string }
                    > = {
                      novo_contato: {
                        bar: "bg-blue-400",
                        dot: "bg-blue-400",
                        text: "text-blue-700",
                      },
                      consulta_agendada: {
                        bar: "bg-yellow-400",
                        dot: "bg-yellow-400",
                        text: "text-yellow-700",
                      },
                      em_analise: {
                        bar: "bg-orange-400",
                        dot: "bg-orange-400",
                        text: "text-orange-700",
                      },
                      proposta_enviada: {
                        bar: "bg-purple-400",
                        dot: "bg-purple-400",
                        text: "text-purple-700",
                      },
                      fechado: {
                        bar: "bg-emerald-400",
                        dot: "bg-emerald-400",
                        text: "text-emerald-700",
                      },
                      perdido: {
                        bar: "bg-slate-300",
                        dot: "bg-slate-400",
                        text: "text-slate-500",
                      },
                    };
                    return crm.leadsPorEstagio.map((e) => {
                      const pct =
                        crm.leadsTotal > 0
                          ? (e.count / crm.leadsTotal) * 100
                          : 0;
                      const clr = ESTAGIO_COLORS[e.estagio] ?? {
                        bar: "bg-primary",
                        dot: "bg-primary",
                        text: "text-primary",
                      };
                      return (
                        <div key={e.estagio}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-body text-xs text-fg">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${clr.dot}`}
                              />
                              {e.label}
                            </span>
                            <span
                              className={`font-body text-xs font-semibold ${clr.text}`}
                            >
                              {e.count}{" "}
                              <span className="font-normal text-muted">
                                ({pct.toFixed(0)}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${clr.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
              <div className="border-t border-border px-5 py-3">
                <Link
                  href="/dashboard/crm/leads/novo"
                  className="font-body text-xs font-semibold text-primary hover:underline"
                >
                  + Novo lead →
                </Link>
              </div>
            </div>

            {/* Tarefas CRM */}
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-heading text-base font-semibold text-fg">
                    Tarefas CRM
                  </h2>
                  <p className="mt-0.5 font-body text-xs text-muted">
                    Próximas e vencidas
                  </p>
                </div>
                {crm.tarefasVencidas > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1 font-body text-xs font-semibold text-orange-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {crm.tarefasVencidas} vencida
                    {crm.tarefasVencidas !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {crm.tarefasProximas.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <PhoneIcon className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="font-body text-sm text-muted">
                    Sem tarefas pendentes.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {crm.tarefasProximas.slice(0, 6).map((t) => {
                    const vencida = t.dias_restantes < 0;
                    const hoje = t.dias_restantes === 0;
                    return (
                      <Link
                        key={t.id}
                        href={`/dashboard/crm/leads/${t.lead_id}`}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-primary/5 ${vencida ? "bg-red-50/50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body text-sm font-medium text-fg">
                            {t.titulo}
                          </p>
                          <p className="font-body text-xs text-muted">
                            {t.lead_nome}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 font-body text-xs font-bold ${
                            vencida
                              ? "bg-red-100 text-red-700"
                              : hoje
                                ? "bg-orange-100 text-orange-700"
                                : t.dias_restantes <= 3
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {vencida
                            ? `${Math.abs(t.dias_restantes)}d atraso`
                            : hoje
                              ? "Hoje"
                              : `${t.dias_restantes}d`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-border px-5 py-3">
                <Link
                  href="/dashboard/crm"
                  className="font-body text-xs font-semibold text-primary hover:underline"
                >
                  Ver CRM completo →
                </Link>
              </div>
            </div>
          </div>
        )}

      {/* ── Prazos + Calendário (somente se tiver acesso a controles) ────── */}
      {showControles ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
              {counts && counts.controlesProximos > 0 && (
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
                  return (
                    <Link
                      key={c.id}
                      href={c.href ?? `/dashboard/controles/${c.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-primary/5 cursor-pointer"
                    >
                      <div className="w-12 flex-shrink-0 text-center">
                        <span
                          className={`mb-1 inline-block h-1.5 w-1.5 rounded-full ${urg.dotCls}`}
                        />
                        <p className="font-body text-xs font-semibold text-muted">
                          {fmtDateShort(c.data_evento)}
                        </p>
                      </div>
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

          <div className="flex flex-col gap-4 lg:col-span-2">
            <MiniCalendar
              events={[
                ...proximosControles,
                ...compromissosProximos.map((c) => ({
                  id: c.id,
                  tipo_label: `${TIPO_ICONS_COMP[c.tipo] ?? "📌"} ${TIPO_LABELS_COMP[c.tipo] ?? "Compromisso"}`,
                  descricao: c.titulo,
                  cliente_nome: c.cliente_nome ?? null,
                  data_evento: c.data_inicio,
                  dias_restantes: Math.max(
                    0,
                    Math.floor(
                      (new Date(c.data_inicio + "T12:00:00").getTime() -
                        new Date().setHours(0, 0, 0, 0)) /
                        86400000
                    )
                  ),
                  source: "compromisso" as const,
                  href: `/dashboard/agenda?date=${c.data_inicio}`,
                })),
              ]}
            />

            {/* Resumo financeiro — só aparece se tiver acesso */}
            {showFinanceiro && kpis ? (
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
                      <span className="font-body text-xs text-muted">
                        {label}
                      </span>
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
                    href="/dashboard/financeiro?tab=receber"
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
            ) : (
              <SemAcesso modulo="Financeiro" />
            )}
          </div>
        </div>
      ) : showFinanceiro && kpis ? (
        /* Se não tem controles mas tem financeiro, mostra só o financeiro */
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-sm font-semibold text-fg">
            Resumo Financeiro
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Recebido no mês",
                value: kpis.recebidoMes,
                cls: "text-emerald-600",
              },
              {
                label: "Pago no mês",
                value: kpis.pagoMes,
                cls: "text-red-500",
              },
              {
                label: "A receber",
                value: kpis.aReceber,
                cls: "text-amber-600",
              },
              {
                label: "Saldo do mês",
                value: kpis.saldoMes,
                cls: kpis.saldoMes >= 0 ? "text-emerald-600" : "text-red-600",
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3 min-w-0">
                <p className="font-body text-xs text-muted leading-tight">
                  {label}
                </p>
                <p
                  className={`mt-1 font-heading text-sm sm:text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight ${cls}`}
                  title={fmt(value)}
                >
                  {fmt(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Gráfico + Clientes em Débito (somente se tiver acesso financeiro) */}
      {showFinanceiro && kpis && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />{" "}
                  Receitas
                </span>
                <span className="flex items-center gap-1.5 font-body text-xs text-muted">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />{" "}
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
                <div key={label} className="text-center min-w-0">
                  <p className="font-body text-xs text-muted leading-tight">
                    {label}
                  </p>
                  <p
                    className={`mt-0.5 font-heading text-xs sm:text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight ${cls}`}
                    title={fmt(value)}
                  >
                    {fmt(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

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
                    href={`/dashboard/financeiro?tab=receber&cliente=${encodeURIComponent(c.client_name)}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-50 cursor-pointer group"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 font-heading text-xs font-bold text-red-600 group-hover:bg-red-200 transition-colors">
                      {c.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                        {c.client_name}
                      </p>
                      <p className="font-body text-xs text-muted">
                        {c.count_vencidos} lançamento
                        {c.count_vencidos !== 1 ? "s" : ""} ·{" "}
                        {c.max_dias_atraso}d atraso
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
                href="/dashboard/financeiro?tab=receber"
                className="font-body text-xs font-semibold text-primary hover:underline"
              >
                Ver A Receber →
              </Link>
              {clientesDevedores.length > 0 && (
                <span className="font-body text-xs font-semibold text-red-600">
                  Total: {fmt(totalVencido)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Caixa de Entrada — E-mails Exclusivos ────────────────────────── */}
      {perm.clientes && emailsRecentes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <InboxArrowDownIcon className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="font-heading text-base font-semibold text-indigo-900">
                  Caixa de Entrada — E-mails Exclusivos
                </h2>
                <p className="mt-0.5 font-body text-xs text-indigo-600">
                  Clique para abrir o e-mail do cliente
                </p>
              </div>
            </div>
            {totalNaoLidos > 0 && (
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 font-body text-xs font-bold text-white">
                {totalNaoLidos} não {totalNaoLidos === 1 ? "lido" : "lidos"}
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {emailsRecentes.map((email) => (
              <Link
                key={email.id}
                href={`/dashboard/clientes/${email.client_id}?tab=email`}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-indigo-50 cursor-pointer group"
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 font-heading text-xs font-bold text-indigo-700 group-hover:bg-indigo-200 transition-colors mt-0.5">
                  {email.client_name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-body text-sm font-semibold text-fg group-hover:text-indigo-700 transition-colors">
                      {email.client_name ?? "Cliente"}
                    </p>
                    {!email.lida && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="truncate font-body text-sm text-fg">
                    {email.subject || "(sem assunto)"}
                  </p>
                  <p className="font-body text-xs text-muted">
                    {email.from_name
                      ? `${email.from_name} <${email.from_address}>`
                      : email.from_address}{" "}
                    · {email.received_at}
                  </p>
                  {email.body_text && (
                    <p className="mt-0.5 truncate font-body text-xs text-muted">
                      {email.body_text.trim().slice(0, 120)}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 font-body text-xs text-indigo-400 group-hover:text-indigo-600 transition-colors mt-1">
                  ver →
                </span>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Link
              href="/dashboard/clientes"
              className="font-body text-xs font-semibold text-indigo-600 hover:underline"
            >
              Ver todos os clientes →
            </Link>
            {emailsRecentes.length >= 20 && (
              <span className="font-body text-xs text-muted">
                Exibindo os 20 mais recentes
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Lançamentos Vencidos (somente se tiver acesso financeiro) ────── */}
      {showFinanceiro && lancamentosVencidos.length > 0 && (
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
              const href =
                v.client_id && v.client_name
                  ? `/dashboard/financeiro?tab=receber&cliente=${encodeURIComponent(v.client_name)}`
                  : "/dashboard/financeiro?tab=receber";
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
                href="/dashboard/financeiro?tab=receber"
                className="font-body text-xs font-semibold text-primary hover:underline"
              >
                + {lancamentosVencidos.length - 10} lançamentos — ver todos →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
