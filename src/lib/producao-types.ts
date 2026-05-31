export const ESTAGIOS_PRODUCAO = [
  "analise",
  "producao",
  "administrativo",
  "judicial",
  "arquivado",
] as const;

export type EstagioProducao = (typeof ESTAGIOS_PRODUCAO)[number];

export const RESULTADOS_ADMIN = ["concedido", "negado"] as const;
export type ResultadoAdmin = (typeof RESULTADOS_ADMIN)[number];

export const RESULTADOS_JUDICIAL = [
  "procedente",
  "improcedente",
  "parcial",
] as const;
export type ResultadoJudicial = (typeof RESULTADOS_JUDICIAL)[number];

export const ESTAGIO_PRODUCAO_META: Record<
  EstagioProducao,
  { label: string; color: string; dot: string; bg: string; border: string }
> = {
  analise: {
    label: "Análise",
    color: "text-blue-700",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  producao: {
    label: "Produção",
    color: "text-teal-700",
    dot: "bg-teal-500",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  administrativo: {
    label: "Administrativo",
    color: "text-orange-700",
    dot: "bg-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  judicial: {
    label: "Judicial",
    color: "text-purple-700",
    dot: "bg-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  arquivado: {
    label: "Arquivado",
    color: "text-slate-600",
    dot: "bg-slate-400",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
};

export const RESULTADO_ADMIN_META: Record<
  ResultadoAdmin,
  { label: string; color: string; bg: string }
> = {
  concedido: {
    label: "Concedido",
    color: "text-green-700",
    bg: "bg-green-100",
  },
  negado: { label: "Negado", color: "text-red-700", bg: "bg-red-100" },
};

export const RESULTADO_JUDICIAL_META: Record<
  ResultadoJudicial,
  { label: string; color: string; bg: string }
> = {
  procedente: {
    label: "Procedente",
    color: "text-green-700",
    bg: "bg-green-100",
  },
  improcedente: {
    label: "Improcedente",
    color: "text-red-700",
    bg: "bg-red-100",
  },
  parcial: {
    label: "Parcial Procedente",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
};

export interface ProcessoProducao {
  id: string;
  client_id: string;
  client_name: string;
  numero: string | null;
  tipo_acao: string;
  area: string;
  estagio_producao: EstagioProducao;
  resultado_administrativo: ResultadoAdmin | null;
  resultado_judicial: ResultadoJudicial | null;
  dias_no_estagio: number;
  created_at_formatted: string;
}
