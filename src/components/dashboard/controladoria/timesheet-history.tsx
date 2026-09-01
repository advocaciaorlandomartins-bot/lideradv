"use client";

import { useEffect, useState } from "react";
import { getTimesheetsPorOrigem, type TimesheetEntrada } from "@/lib/timesheet";
import type { OrigemChecklist } from "@/lib/checklist-types";
import { ClockIcon } from "@/components/icons";

function formatDuracao(min: number | null): string {
  if (min === null) return "em andamento";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TimesheetHistory({
  origemTipo,
  origemId,
}: {
  origemTipo: OrigemChecklist;
  origemId: string;
}) {
  const [entradas, setEntradas] = useState<TimesheetEntrada[] | null>(null);

  useEffect(() => {
    getTimesheetsPorOrigem(origemTipo, origemId).then(setEntradas);
  }, [origemTipo, origemId]);

  if (entradas === null)
    return (
      <p className="font-body text-xs text-muted">
        Carregando tempo registrado…
      </p>
    );
  if (entradas.length === 0)
    return (
      <p className="font-body text-xs text-muted">
        Nenhum tempo registrado ainda — use o botão &ldquo;Cronômetro&rdquo; em
        Minhas Tarefas.
      </p>
    );

  const totalMin = entradas.reduce((s, e) => s + (e.duracaoMin ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-body text-xs font-semibold text-fg">
        <ClockIcon className="h-3.5 w-3.5 text-muted" />
        Total: {formatDuracao(totalMin)}
      </div>
      <div className="space-y-1">
        {entradas.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between font-body text-xs text-muted"
          >
            <span>
              {e.colaboradorNome} · {formatDataHora(e.inicio)}
            </span>
            <span className="font-semibold text-fg">
              {formatDuracao(e.duracaoMin)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
