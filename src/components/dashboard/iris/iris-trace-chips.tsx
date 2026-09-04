"use client";

import type { IrisToolTraceItem, IrisAnexo } from "./use-iris-chat";
import { DocumentTextIcon } from "@/components/icons";

export function IrisTraceChips({ trace }: { trace?: IrisToolTraceItem[] }) {
  if (!trace || trace.length === 0) return null;
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {trace.map((t, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-body text-[10px] font-medium text-violet-700"
        >
          🔎 {t.label}
        </span>
      ))}
    </div>
  );
}

export function IrisAnexoChips({ anexos }: { anexos?: IrisAnexo[] }) {
  if (!anexos || anexos.length === 0) return null;
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {anexos.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-body text-[10px] font-medium"
        >
          <DocumentTextIcon className="h-3 w-3" />
          {a.nome}
        </span>
      ))}
    </div>
  );
}
