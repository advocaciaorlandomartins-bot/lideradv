import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  ClipboardListIcon,
  CalendarIcon,
  FolderOpenIcon,
  ActivityIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/icons";

export const metadata = {
  title: "Andamentos Processuais — AdvMartins",
};

const MOCK_ANDAMENTOS = [
  {
    id: "1",
    data: "03/06/2024",
    hora: "10:22",
    numero_processo: "1234567-89.2024.4.03.6100",
    tipo_acao: "B31 - Auxílio-doença",
    cliente: "Maria da Silva",
    descricao:
      "Decisão: Recurso do INSS não provido. Mantida a concessão do benefício.",
    tipo_andamento: "Decisão",
    orgao: "JEF - 1ª Turma Recursal SP",
    responsavel: "Dr. Orlando Martins",
    lido: false,
  },
  {
    id: "2",
    data: "02/06/2024",
    hora: "15:45",
    numero_processo: "9876543-21.2023.8.26.0001",
    tipo_acao: "B41 - Aposentadoria por idade",
    cliente: "João Aparecido Santos",
    descricao:
      "Juntada de documentos requeridos. Aguardando nova designação de audiência.",
    tipo_andamento: "Juntada",
    orgao: "1ª Vara Cível de São Paulo",
    responsavel: "Dr. Orlando Martins",
    lido: true,
  },
  {
    id: "3",
    data: "01/06/2024",
    hora: "09:11",
    numero_processo: "1111111-00.2024.5.15.0001",
    tipo_acao: "Revisão do Benefício",
    cliente: "Ana Souza Ferreira",
    descricao:
      "Audiência realizada. Partes intimadas para apresentar alegações finais em 15 dias.",
    tipo_andamento: "Audiência",
    orgao: "TRT 15ª Região",
    responsavel: "Dr. Orlando Martins",
    lido: true,
  },
  {
    id: "4",
    data: "31/05/2024",
    hora: "14:30",
    numero_processo: "5555555-11.2023.4.03.6183",
    tipo_acao: "B87 - BPC à pessoa com deficiência",
    cliente: "Carlos Eduardo Lima",
    descricao:
      "Expedição de ofício ao INSS para apresentação de relatório médico pericial.",
    tipo_andamento: "Ofício",
    orgao: "JEF - 7ª Vara Federal SP",
    responsavel: "Dra. Assistente",
    lido: true,
  },
];

const TIPO_COLORS: Record<string, string> = {
  Decisão: "bg-purple-50 text-purple-700",
  Juntada: "bg-blue-50 text-blue-700",
  Audiência: "bg-orange-50 text-orange-700",
  Ofício: "bg-teal-50 text-teal-700",
  Despacho: "bg-indigo-50 text-indigo-700",
  Sentença: "bg-emerald-50 text-emerald-700",
};

function groupByDate(andamentos: typeof MOCK_ANDAMENTOS) {
  const groups: Record<string, typeof MOCK_ANDAMENTOS> = {};
  for (const a of andamentos) {
    if (!groups[a.data]) groups[a.data] = [];
    groups[a.data].push(a);
  }
  return groups;
}

export default function AndamentosPage() {
  const naoLidos = MOCK_ANDAMENTOS.filter((a) => !a.lido).length;
  const groups = groupByDate(MOCK_ANDAMENTOS);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Andamentos Processuais
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {naoLidos > 0
            ? `${naoLidos} andamento${naoLidos > 1 ? "s" : ""} não lido${naoLidos > 1 ? "s" : ""}`
            : `${MOCK_ANDAMENTOS.length} andamentos registrados`}
        </p>
      </div>

      <ProcessosSubNav />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Hoje",
            count: 1,
            icon: CalendarIcon,
            color: "text-primary",
          },
          {
            label: "Não lidos",
            count: naoLidos,
            icon: ActivityIcon,
            color: "text-amber-600",
          },
          {
            label: "Esta semana",
            count: MOCK_ANDAMENTOS.length,
            icon: ClipboardListIcon,
            color: "text-fg",
          },
          {
            label: "Processos",
            count: new Set(MOCK_ANDAMENTOS.map((a) => a.numero_processo)).size,
            icon: FolderOpenIcon,
            color: "text-muted",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-white px-4 py-3"
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

      {/* Timeline */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardListIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              Linha do tempo
            </h2>
            <p className="font-body text-xs text-muted">
              Andamentos ordenados por data de publicação
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {Object.entries(groups).map(([data, andamentos]) => (
            <div key={data}>
              {/* Date separator */}
              <div className="flex items-center gap-3 bg-slate-50/70 px-5 py-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                  {data}
                </span>
                <div className="flex-1 border-t border-border" />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[10px] font-bold text-slate-500">
                  {andamentos.length}
                </span>
              </div>

              {andamentos.map((and) => (
                <div
                  key={and.id}
                  className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                    !and.lido ? "border-l-4 border-primary" : ""
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                      and.lido ? "bg-slate-100" : "bg-primary/10"
                    }`}
                  >
                    {and.lido ? (
                      <CheckCircleIcon className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ActivityIcon className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                          TIPO_COLORS[and.tipo_andamento] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {and.tipo_andamento}
                      </span>
                      {!and.lido && (
                        <span className="inline-block rounded-full bg-primary px-2 py-0.5 font-body text-[10px] font-bold text-white">
                          Novo
                        </span>
                      )}
                    </div>
                    <p className="font-body text-sm font-semibold text-fg">
                      {and.tipo_acao}
                    </p>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {and.descricao}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="flex items-center gap-1 font-body text-xs text-muted">
                        <UsersIcon className="h-3.5 w-3.5" />
                        {and.cliente}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {and.numero_processo}
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted">{and.orgao}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {and.hora}
                    </div>
                    <p className="font-body text-xs text-muted">
                      {and.responsavel}
                    </p>
                    <button className="mt-1 cursor-pointer rounded-lg border border-border px-3 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary">
                      Ver processo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-6 text-center">
          <FolderOpenIcon className="h-5 w-5 text-slate-300" />
          <p className="font-body text-sm text-muted">
            Integração com sistema judicial em desenvolvimento. Dados
            ilustrativos.
          </p>
        </div>
      </div>
    </div>
  );
}
