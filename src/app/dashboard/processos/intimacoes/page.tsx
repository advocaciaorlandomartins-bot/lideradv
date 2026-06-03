import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  InboxArrowDownIcon,
  CalendarIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
} from "@/components/icons";

export const metadata = {
  title: "Intimações — AdvMartins",
};

const MOCK_INTIMACOES = [
  {
    id: "1",
    numero_processo: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    orgao: "JEF - 1ª Turma Recursal SP",
    data_publicacao: "30/05/2024",
    data_prazo: "14/06/2024",
    dias_restantes: 14,
    tipo: "Intimação para manifestação",
    status: "pendente",
  },
  {
    id: "2",
    numero_processo: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    orgao: "1ª Vara Cível de São Paulo",
    data_publicacao: "28/05/2024",
    data_prazo: "12/06/2024",
    dias_restantes: 12,
    tipo: "Intimação para audiência",
    status: "lida",
  },
  {
    id: "3",
    numero_processo: "1111111-00.2024.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    orgao: "TRT 15ª Região",
    data_publicacao: "26/05/2024",
    data_prazo: "05/06/2024",
    dias_restantes: 5,
    tipo: "Decisão para recurso",
    status: "urgente",
  },
];

function StatusChip({ status, dias }: { status: string; dias: number }) {
  if (status === "urgente" || dias <= 5)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Urgente · {dias}d
      </span>
    );
  if (status === "lida")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-slate-500">
        <CheckIcon className="h-3 w-3" />
        Lida
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-body text-xs font-semibold text-amber-700">
      <ClockIcon className="h-3 w-3" />
      Pendente · {dias}d
    </span>
  );
}

export default function IntimacoesPape() {
  const pendentes = MOCK_INTIMACOES.filter((i) => i.status !== "lida").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Intimações
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {pendentes} intimações pendentes de resposta
        </p>
      </div>

      <ProcessosSubNav />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total",
            count: MOCK_INTIMACOES.length,
            color: "text-fg",
            bg: "bg-slate-50",
          },
          {
            label: "Pendentes",
            count: 1,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Urgentes",
            count: 1,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Lidas",
            count: 1,
            color: "text-slate-500",
            bg: "bg-slate-50",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border border-border ${s.bg} px-4 py-3`}
          >
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
              {s.label}
            </p>
            <p className={`font-heading text-2xl font-bold ${s.color}`}>
              {s.count}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <InboxArrowDownIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              Intimações recebidas
            </h2>
            <p className="font-body text-xs text-muted">
              Ordenadas por prazo mais próximo
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {MOCK_INTIMACOES.map((intim) => (
            <div
              key={intim.id}
              className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                intim.status === "urgente" ? "border-l-4 border-red-400" : ""
              }`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <InboxArrowDownIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-body text-sm font-semibold text-fg">
                    {intim.tipo}
                  </p>
                  <StatusChip
                    status={intim.status}
                    dias={intim.dias_restantes}
                  />
                </div>
                <p className="font-body text-xs text-muted">
                  {intim.tipo_acao} · {intim.cliente}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {intim.numero_processo}
                </p>
                <p className="font-body text-xs text-muted">{intim.orgao}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Publicado: {intim.data_publicacao}
                </div>
                <div className="flex items-center gap-1.5 font-body text-xs font-semibold text-fg">
                  <ClockIcon className="h-3.5 w-3.5 text-amber-500" />
                  Prazo: {intim.data_prazo}
                </div>
                <button className="mt-1 cursor-pointer rounded-lg border border-border px-3 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary">
                  Ver processo
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-6 text-center">
          <FolderOpenIcon className="h-5 w-5 text-slate-300" />
          <p className="font-body text-sm text-muted">
            Integração com sistema judicial em desenvolvimento.
          </p>
        </div>
      </div>
    </div>
  );
}
