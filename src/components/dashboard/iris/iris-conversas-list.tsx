"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import type { IrisConversaResumo } from "./use-iris-chat";

function formatData(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function IrisConversasList({
  conversas,
  conversaAtualId,
  onSelect,
  onDelete,
  onNova,
}: {
  conversas: IrisConversaResumo[];
  conversaAtualId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNova: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        onClick={onNova}
        className="mb-2 flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 font-body text-xs font-semibold text-violet-700 hover:bg-violet-100 cursor-pointer"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Nova conversa
      </button>
      {conversas.length === 0 ? (
        <p className="px-1 font-body text-xs text-muted">
          Nenhuma conversa salva ainda.
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {conversas.map((c) => (
            <div
              key={c.id}
              className={`group flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                c.id === conversaAtualId
                  ? "bg-violet-100"
                  : "hover:bg-slate-100"
              }`}
              onClick={() => onSelect(c.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-xs text-fg">{c.titulo}</p>
                <p className="font-body text-[10px] text-muted">
                  {formatData(c.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-red-100 hover:text-red-600 group-hover:flex cursor-pointer"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
