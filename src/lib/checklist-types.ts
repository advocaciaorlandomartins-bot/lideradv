export interface ChecklistItem {
  texto: string;
  feito: boolean;
}

export type OrigemChecklist = "controle" | "tarefa_processo";

export const TABELA_CHECKLIST: Record<OrigemChecklist, string> = {
  controle: "controles",
  tarefa_processo: "tarefas_processo",
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
