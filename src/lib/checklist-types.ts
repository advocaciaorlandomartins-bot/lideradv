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

/**
 * Mescla os checklists de todos os processos de um cliente num único
 * checklist "efetivo" — um item por texto, marcado como feito só se
 * estiver feito em TODOS os processos que o contêm. Usado pra calcular o
 * selo do Cliente a partir dos processos reais em vez de guardar uma
 * cópia separada em clients.checklist que precisa ficar sincronizada à
 * mão (era a causa raiz de casos como processo "Completo" e cliente
 * "Faltam N" pro mesmo caso — duas cópias do mesmo dado divergindo).
 */
export function mesclarChecklistsDeProcessos(
  listas: ChecklistItem[][]
): ChecklistItem[] {
  const porTexto = new Map<string, boolean>();
  const ordem: string[] = [];
  for (const lista of listas) {
    for (const item of lista) {
      if (!porTexto.has(item.texto)) ordem.push(item.texto);
      const atual = porTexto.get(item.texto);
      porTexto.set(
        item.texto,
        atual === undefined ? item.feito : atual && item.feito
      );
    }
  }
  return ordem.map((texto) => ({ texto, feito: porTexto.get(texto)! }));
}
