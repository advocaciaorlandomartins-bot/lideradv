export type TipoRemuneracao = "salario" | "comissao" | "bonificacao";
export type StatusRemuneracao = "pendente" | "pago";

export const TIPO_LABELS: Record<TipoRemuneracao, string> = {
  salario: "Salário",
  comissao: "Comissão",
  bonificacao: "Bonificação",
};

export const TIPO_COLORS: Record<TipoRemuneracao, string> = {
  salario: "bg-blue-50 text-blue-700",
  comissao: "bg-emerald-50 text-emerald-700",
  bonificacao: "bg-amber-50 text-amber-700",
};

export const TIPO_DESCS: Record<TipoRemuneracao, string> = {
  salario: "Remuneração fixa mensal do colaborador",
  comissao: "Percentual ou valor sobre processo / captação",
  bonificacao: "Gratificação ou premiação por desempenho",
};
