import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  WifiIcon,
  FolderOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertIcon,
  ClockIcon,
  BellAlertIcon,
  ActivityIcon,
} from "@/components/icons";

export const metadata = {
  title: "Monitoramento (Push) — AdvMartins",
};

const MOCK_CAPTURAS = [
  {
    id: "1",
    numero_processo: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    orgao: "JEF - 1ª Turma Recursal SP",
    ultima_captura: "03/06/2024 08:30",
    status_captura: "sucesso",
    movimentacoes: 3,
    ativo: true,
  },
  {
    id: "2",
    numero_processo: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    orgao: "1ª Vara Cível de São Paulo",
    ultima_captura: "02/06/2024 14:15",
    status_captura: "sucesso",
    movimentacoes: 1,
    ativo: true,
  },
  {
    id: "3",
    numero_processo: "5555555-11.2023.4.03.6183",
    tipo_acao: "B87 - BPC à pessoa com deficiência",
    cliente: "Carlos Eduardo Lima",
    orgao: "JEF - 7ª Vara Federal SP",
    ultima_captura: "01/06/2024 09:00",
    status_captura: "erro",
    movimentacoes: 0,
    ativo: true,
  },
  {
    id: "4",
    numero_processo: "3333333-44.2022.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    orgao: "TRT 15ª Região",
    ultima_captura: "30/05/2024 11:45",
    status_captura: "desabilitado",
    movimentacoes: 0,
    ativo: false,
  },
];

function CapturaStatus({ status }: { status: string }) {
  if (status === "sucesso")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-700">
        <CheckCircleIcon className="h-3 w-3" />
        Capturado
      </span>
    );
  if (status === "erro")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Erro
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-slate-500">
      <ClockIcon className="h-3 w-3" />
      Inativo
    </span>
  );
}

export default function CentralCapturaPage() {
  const ativos = MOCK_CAPTURAS.filter((c) => c.ativo).length;
  const comErro = MOCK_CAPTURAS.filter(
    (c) => c.status_captura === "erro"
  ).length;
  const totalMovimentacoes = MOCK_CAPTURAS.reduce(
    (s, c) => s + c.movimentacoes,
    0
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Central de Captura
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Monitoramento automático (Push) de movimentações processuais
        </p>
      </div>

      <ProcessosSubNav />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Monitorados",
            count: ativos,
            icon: WifiIcon,
            color: "text-primary",
            bg: "bg-primary/5",
          },
          {
            label: "Movimentações hoje",
            count: totalMovimentacoes,
            icon: ActivityIcon,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Com erro",
            count: comErro,
            icon: AlertIcon,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Inativos",
            count: MOCK_CAPTURAS.length - ativos,
            icon: ClockIcon,
            color: "text-slate-500",
            bg: "bg-slate-50",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`rounded-xl border border-border ${s.bg} px-4 py-3`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${s.color}`} />
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  {s.label}
                </p>
              </div>
              <p className={`font-heading text-2xl font-bold ${s.color}`}>
                {s.count}
              </p>
            </div>
          );
        })}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <BellAlertIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              Processos monitorados
            </h2>
            <p className="font-body text-xs text-muted">
              Atualização automática a cada 24h
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {MOCK_CAPTURAS.map((cap) => (
            <div
              key={cap.id}
              className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                !cap.ativo ? "opacity-60" : ""
              }`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                  cap.status_captura === "sucesso"
                    ? "bg-emerald-50"
                    : cap.status_captura === "erro"
                      ? "bg-red-50"
                      : "bg-slate-100"
                }`}
              >
                <WifiIcon
                  className={`h-5 w-5 ${
                    cap.status_captura === "sucesso"
                      ? "text-emerald-600"
                      : cap.status_captura === "erro"
                        ? "text-red-500"
                        : "text-slate-400"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-body text-sm font-semibold text-fg">
                    {cap.tipo_acao}
                  </p>
                  <CapturaStatus status={cap.status_captura} />
                  {cap.movimentacoes > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-body text-xs font-semibold text-amber-700">
                      <ActivityIcon className="h-3 w-3" />
                      {cap.movimentacoes} nova{cap.movimentacoes > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="font-body text-xs text-muted">{cap.cliente}</p>
                <p className="font-mono text-xs text-slate-400">
                  {cap.numero_processo}
                </p>
                <p className="font-body text-xs text-muted">{cap.orgao}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Última: {cap.ultima_captura}
                </div>
                <button
                  className={`cursor-pointer rounded-lg border px-3 py-1 font-body text-xs font-semibold transition-colors ${
                    cap.ativo
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  {cap.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-6 text-center">
          <FolderOpenIcon className="h-5 w-5 text-slate-300" />
          <p className="font-body text-sm text-muted">
            Integração com tribunais em desenvolvimento. Dados ilustrativos.
          </p>
        </div>
      </div>
    </div>
  );
}
