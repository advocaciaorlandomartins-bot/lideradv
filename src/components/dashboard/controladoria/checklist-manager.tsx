"use client";

import { useState, useTransition } from "react";
import type { ChecklistItem, OrigemChecklist } from "@/lib/checklist-types";
import {
  toggleChecklistItemAction,
  adicionarChecklistItemAction,
  removerChecklistItemAction,
} from "@/lib/checklist";
import { CheckIcon, XMarkIcon, PlusIcon } from "@/components/icons";

interface Props {
  origemTipo: OrigemChecklist;
  origemId: string;
  itensIniciais: ChecklistItem[];
  /** Somente leitura + marcar/desmarcar — sem adicionar/remover item (uso em cards de "Minhas Tarefas"). */
  somenteToggle?: boolean;
  onChange?: (itens: ChecklistItem[]) => void;
}

export default function ChecklistManager({
  origemTipo,
  origemId,
  itensIniciais,
  somenteToggle = false,
  onChange,
}: Props) {
  const [itens, setItens] = useState(itensIniciais);
  const [novoTexto, setNovoTexto] = useState("");
  const [isPending, startTransition] = useTransition();

  function aplicar(next: ChecklistItem[] | undefined) {
    if (next) {
      setItens(next);
      onChange?.(next);
    }
  }

  function toggle(index: number) {
    startTransition(async () => {
      const r = await toggleChecklistItemAction(origemTipo, origemId, index);
      aplicar(r.checklist);
    });
  }

  function adicionar() {
    const texto = novoTexto.trim();
    if (!texto) return;
    setNovoTexto("");
    startTransition(async () => {
      const r = await adicionarChecklistItemAction(origemTipo, origemId, texto);
      aplicar(r.checklist);
    });
  }

  function remover(index: number) {
    startTransition(async () => {
      const r = await removerChecklistItemAction(origemTipo, origemId, index);
      aplicar(r.checklist);
    });
  }

  return (
    <div className={`space-y-1.5 ${isPending ? "opacity-60" : ""}`}>
      {itens.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggle(idx)}
            disabled={isPending}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
              item.feito
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border bg-white"
            }`}
          >
            {item.feito && <CheckIcon className="h-3 w-3" />}
          </button>
          <span
            className={`flex-1 font-body text-xs ${item.feito ? "text-muted line-through" : "text-fg"}`}
          >
            {item.texto}
          </span>
          {!somenteToggle && (
            <button
              type="button"
              onClick={() => remover(idx)}
              disabled={isPending}
              className="text-muted hover:text-red-600"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {!somenteToggle && (
        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="Novo item do checklist…"
            className="h-8 flex-1 rounded-lg border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={isPending || !novoTexto.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
