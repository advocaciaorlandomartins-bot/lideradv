import type { ChecklistItem } from "@/lib/checklist-types";
import { checklistStatus } from "@/lib/checklist-types";

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
