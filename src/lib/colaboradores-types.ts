export type CargoColaborador =
  | "advogado"
  | "estagiario"
  | "recepcao"
  | "agente"
  | "advogado_associado"
  | "comercial";

export const CARGO_LABELS: Record<CargoColaborador, string> = {
  advogado: "Advogado",
  estagiario: "Estagiário",
  recepcao: "Recepção",
  agente: "Agente",
  advogado_associado: "Advogado Associado",
  comercial: "Comercial",
};

export const CARGO_COLORS: Record<CargoColaborador, string> = {
  advogado: "bg-blue-50 text-blue-700",
  estagiario: "bg-emerald-50 text-emerald-700",
  recepcao: "bg-pink-50 text-pink-700",
  agente: "bg-orange-50 text-orange-700",
  advogado_associado: "bg-indigo-50 text-indigo-700",
  comercial: "bg-teal-50 text-teal-700",
};
