import {
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  CalendarIcon,
  TrendUpIcon,
  TrendDownIcon,
  ClockIcon,
  AlertIcon,
  UserPlusIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────

interface KPI {
  title: string;
  value: string;
  sub: string;
  positive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  sparkline: number[];
}

interface Deadline {
  label: string;
  date: string;
  proc: string;
  urgent: boolean;
}

interface Activity {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  text: string;
  sub: string;
  time: string;
}

// ── Mock data (substituir por queries Neon) ──────────────

const kpis: KPI[] = [
  {
    title: "Clientes Ativos",
    value: "48",
    sub: "+3 este mês",
    positive: true,
    icon: UsersIcon,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    sparkline: [30, 34, 36, 38, 40, 44, 48],
  },
  {
    title: "Processos Ativos",
    value: "23",
    sub: "2 com prazo hoje",
    positive: false,
    icon: FolderOpenIcon,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    sparkline: [18, 19, 21, 20, 22, 21, 23],
  },
  {
    title: "Receita do Mês",
    value: "R$ 12.400",
    sub: "+18% vs anterior",
    positive: true,
    icon: BanknotesIcon,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    sparkline: [6000, 7200, 8400, 9100, 10500, 11200, 12400],
  },
  {
    title: "Prazos Esta Semana",
    value: "7",
    sub: "1 urgente",
    positive: false,
    icon: CalendarIcon,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    sparkline: [3, 5, 4, 6, 8, 6, 7],
  },
];

const monthlyData = [
  { month: "Dez", value: 7 },
  { month: "Jan", value: 8 },
  { month: "Fev", value: 5 },
  { month: "Mar", value: 9 },
  { month: "Abr", value: 11 },
  { month: "Mai", value: 4, current: true },
];

const deadlines: Deadline[] = [
  {
    label: "Audiência de conciliação",
    proc: "1023456-78.2025",
    date: "Amanhã, 14:00",
    urgent: true,
  },
  {
    label: "Recurso Ordinário",
    proc: "0054321-12.2025",
    date: "16/05/2026",
    urgent: true,
  },
  {
    label: "Contestação",
    proc: "0089123-45.2025",
    date: "19/05/2026",
    urgent: false,
  },
  {
    label: "Perícia médica",
    proc: "0067890-32.2025",
    date: "21/05/2026",
    urgent: false,
  },
];

const activities: Activity[] = [
  {
    icon: FolderOpenIcon,
    iconColor: "text-blue-600",
    text: "Despacho publicado — Proc. 1023456-78",
    sub: "Tribunal de Justiça de SP",
    time: "há 2h",
  },
  {
    icon: UserPlusIcon,
    iconColor: "text-emerald-600",
    text: "Novo cliente cadastrado — Maria F. Costa",
    sub: "Ação trabalhista",
    time: "hoje",
  },
  {
    icon: BanknotesIcon,
    iconColor: "text-emerald-600",
    text: "Honorários recebidos — R$ 2.500",
    sub: "João Roberto Silva",
    time: "hoje",
  },
  {
    icon: AlertIcon,
    iconColor: "text-amber-600",
    text: "Prazo em 2 dias — Recurso Proc. 0054321",
    sub: "Ação urgente necessária",
    time: "2 dias",
  },
  {
    icon: FolderOpenIcon,
    iconColor: "text-blue-600",
    text: "Recurso protocolado — Proc. 0098765-43",
    sub: "2ª Câmara Cível",
    time: "ontem",
  },
];

// ── Components ────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  const w = 80;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.75 - h * 0.1,
  }));
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KPICard({ kpi }: { kpi: KPI }) {
  const Icon = kpi.icon;
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2.5 ${kpi.iconBg}`}>
          <Icon className={`h-5 w-5 ${kpi.iconColor}`} />
        </div>
        <div
          className={`flex items-center gap-1 ${kpi.positive ? "text-emerald-600" : "text-amber-600"}`}
        >
          {kpi.positive ? (
            <TrendUpIcon className="h-4 w-4" />
          ) : (
            <TrendDownIcon className="h-4 w-4" />
          )}
          <Sparkline values={kpi.sparkline} />
        </div>
      </div>
      <div className="mt-3">
        <p className="font-heading text-3xl font-semibold text-fg">
          {kpi.value}
        </p>
        <p className="mt-0.5 font-body text-sm text-muted">{kpi.title}</p>
      </div>
      <p
        className={`mt-3 font-body text-xs font-semibold ${kpi.positive ? "text-emerald-600" : "text-amber-600"}`}
      >
        {kpi.sub}
      </p>
    </div>
  );
}

function BarChart() {
  const max = Math.max(...monthlyData.map((d) => d.value));
  return (
    <div className="flex h-36 items-end gap-2.5">
      {monthlyData.map((d) => (
        <div
          key={d.month}
          className="flex flex-1 flex-col items-center gap-1.5"
        >
          <span className="font-body text-xs text-muted">{d.value}</span>
          <div
            className={`w-full rounded-t-md transition-all duration-500 ${d.current ? "bg-primary/30" : "bg-primary"}`}
            style={{ height: `${(d.value / max) * 104}px` }}
          />
          <span className="font-body text-[11px] text-muted">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const quickActions = [
  {
    label: "Novo cliente",
    icon: UserPlusIcon,
    href: "/dashboard/clientes/novo",
  },
  { label: "Novo processo", icon: PlusIcon, href: "/dashboard/processos/novo" },
  { label: "Buscar OAB", icon: MagnifyingGlassIcon, href: "/dashboard/oab" },
  {
    label: "Registrar pagamento",
    icon: BanknotesIcon,
    href: "/dashboard/financeiro/novo",
  },
];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            {getGreeting()}, Dr. Orlando.
          </h1>
          <p className="mt-1 font-body text-sm text-muted capitalize">
            {today}
          </p>
        </div>
        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <a
                key={a.label}
                href={a.href}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 font-body text-xs font-semibold text-fg shadow-sm transition-colors duration-150 hover:border-primary hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} kpi={kpi} />
        ))}
      </div>

      {/* Charts + Deadlines */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Bar chart */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold text-fg">
                Processos por mês
              </h2>
              <p className="font-body text-xs text-muted">
                Últimos 6 meses · Mai/2026 parcial
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-body text-xs font-semibold text-primary">
              2025–2026
            </span>
          </div>
          <BarChart />
        </div>

        {/* Upcoming deadlines */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-heading text-lg font-semibold text-fg">
            Próximos prazos
          </h2>
          <ul className="space-y-3">
            {deadlines.map((d) => (
              <li key={d.proc} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                    d.urgent ? "bg-red-50" : "bg-slate-100"
                  }`}
                >
                  {d.urgent ? (
                    <AlertIcon className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <ClockIcon className="h-3.5 w-3.5 text-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-fg">
                    {d.label}
                  </p>
                  <p className="font-body text-xs text-muted">Proc. {d.proc}</p>
                  <p
                    className={`font-body text-xs font-semibold ${
                      d.urgent ? "text-red-500" : "text-muted"
                    }`}
                  >
                    {d.date}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-semibold text-fg">
          Atividades recentes
        </h2>
        <ul className="divide-y divide-border">
          {activities.map((a, i) => {
            const Icon = a.icon;
            return (
              <li
                key={i}
                className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-50`}
                >
                  <Icon className={`h-4 w-4 ${a.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-semibold text-fg">
                    {a.text}
                  </p>
                  <p className="font-body text-xs text-muted">{a.sub}</p>
                </div>
                <span className="flex-shrink-0 font-body text-xs text-muted">
                  {a.time}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
