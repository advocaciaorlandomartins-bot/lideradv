export interface ChecklistItem {
  texto: string;
  feito: boolean;
}

export type OrigemChecklist =
  | "controle"
  | "tarefa_processo"
  | "cliente"
  | "processo";

export const TABELA_CHECKLIST: Record<OrigemChecklist, string> = {
  controle: "controles",
  tarefa_processo: "tarefas_processo",
  cliente: "clients",
  processo: "processos",
};

export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (i): i is ChecklistItem =>
        !!i &&
        typeof i === "object" &&
        typeof (i as ChecklistItem).texto === "string"
    )
    .map((i) => ({ texto: i.texto, feito: !!i.feito }));
}

/**
 * Resumo pra badge "Completo" / "Faltam N documentos" — checklist vazio
 * conta como completo (mesma regra de checklistCompleto em checklist.ts),
 * então todo cliente/processo criado já nasce com pelo menos os itens
 * base (ver checklistPadrao em checklist-documentos.ts) pra essa badge
 * nunca mostrar "completo" só por nunca ter recebido uma lista.
 */
export function checklistStatus(itens: ChecklistItem[]): {
  completo: boolean;
  pendentes: number;
  total: number;
} {
  const pendentes = itens.filter((i) => !i.feito).length;
  return { completo: pendentes === 0, pendentes, total: itens.length };
}
