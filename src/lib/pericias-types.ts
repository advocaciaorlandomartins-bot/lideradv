export type TipoPericia =
  | "pericia_administrativa"
  | "pericia_judicial"
  | "avaliacao_social_administrativa"
  | "avaliacao_social_judicial"
  | "prorrogacao_beneficio";

export const TIPO_LABELS: Record<TipoPericia, string> = {
  pericia_administrativa: "Perícia Administrativa",
  pericia_judicial: "Perícia Judicial",
  avaliacao_social_administrativa: "Av. Social Administrativa",
  avaliacao_social_judicial: "Av. Social Judicial",
  prorrogacao_beneficio: "Prorrogação de Benefício",
};

export const TIPO_COLORS: Record<TipoPericia, string> = {
  pericia_administrativa: "bg-blue-50 text-blue-600",
  pericia_judicial: "bg-indigo-50 text-indigo-600",
  avaliacao_social_administrativa: "bg-teal-50 text-teal-600",
  avaliacao_social_judicial: "bg-violet-50 text-violet-600",
  prorrogacao_beneficio: "bg-amber-50 text-amber-700",
};
