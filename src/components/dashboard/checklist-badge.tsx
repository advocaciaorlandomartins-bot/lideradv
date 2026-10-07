import type { ChecklistItem } from "@/lib/checklist-types";
import { checklistStatus } from "@/lib/checklist-types";
import { CheckCircleIcon, AlertIcon } from "@/components/icons";

/** Selo "Completo" / "Faltam N documentos" — mesmo cálculo em toda tela que lista cliente/processo. */
export default function ChecklistBadge({
  checklist,
}: {
  checklist: ChecklistItem[];
}) {
  const { completo, pendentes } = checklistStatus(checklist);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${
        completo
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${completo ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {completo ? "Completo" : `Faltam ${pendentes}`}
    </span>
  );
}

/**
 * Ícone compacto pra colar do lado do NOME — a lista de Clientes/Processos
 * já tinha o selo "Completo"/"Faltam N", mas ele ficava numa coluna lá no
 * fim da tabela, fora da tela sem rolar pro lado (achado real: só dava pra
 * ver com a barra de rolagem horizontal). Isso fica sempre visível, na
 * mesma coluna do nome, sem precisar rolar nada.
 */
export function ChecklistInlineIcon({
  checklist,
}: {
  checklist: ChecklistItem[];
}) {
  const { completo, pendentes } = checklistStatus(checklist);
  return (
    <span
      title={
        completo
          ? "Documentos completos"
          : `Faltam ${pendentes} documento${pendentes !== 1 ? "s" : ""}`
      }
      className="inline-flex flex-shrink-0"
    >
      {completo ? (
        <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
      ) : (
        <AlertIcon className="h-4 w-4 text-red-600" />
      )}
    </span>
  );
}
