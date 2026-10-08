"use client";

import { useState, useTransition } from "react";
import { resolverPontoAtencaoAction } from "@/lib/pontos-atencao-actions";

interface PontoAtencao {
  id: string;
  codigo: string;
  gravidade: "impeditivo" | "alto" | "medio" | "baixo";
  descricao: string;
  baseLegal: string | null;
}

const GRAVIDADE_STYLE: Record<
  PontoAtencao["gravidade"],
  { badge: string; card: string; label: string }
> = {
  impeditivo: {
    badge: "bg-red-600 text-white",
    card: "border-red-300 bg-red-50",
    label: "Impeditivo",
  },
  alto: {
    badge: "bg-orange-500 text-white",
    card: "border-orange-200 bg-orange-50",
    label: "Alto",
  },
  medio: {
    badge: "bg-amber-400 text-amber-950",
    card: "border-amber-200 bg-amber-50",
    label: "Médio",
  },
  baixo: {
    badge: "bg-slate-300 text-slate-800",
    card: "border-slate-200 bg-slate-50",
    label: "Baixo",
  },
};

export default function PontosAtencaoPanel({
  processoId,
  pontos: pontosIniciais,
}: {
  processoId: string;
  pontos: PontoAtencao[];
}) {
  const [pontos, setPontos] = useState(pontosIniciais);
  const [pending, startTransition] = useTransition();
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);

  if (pontos.length === 0) return null;

  function resolver(id: string) {
    setResolvendoId(id);
    startTransition(async () => {
      const res = await resolverPontoAtencaoAction(id, processoId);
      if (!res.error) {
        setPontos((prev) => prev.filter((p) => p.id !== id));
      }
      setResolvendoId(null);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Pontos de atenção
        </h2>
        <span className="rounded-full bg-fg/10 px-2 py-0.5 font-body text-xs font-semibold text-fg">
          {pontos.length}
        </span>
      </div>
      <p className="mb-4 font-body text-xs text-muted">
        Alertas gerados por regra fixa a partir dos dados cadastrados — não é a
        IA avaliando, é checagem automática contra a lei. Confira cada um antes
        de prosseguir com diagnóstico ou petição.
      </p>
      <div className="space-y-3">
        {pontos.map((p) => {
          const style = GRAVIDADE_STYLE[p.gravidade];
          return (
            <div key={p.id} className={`rounded-lg border p-4 ${style.card}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <span
                  className={`inline-flex h-5 items-center rounded-full px-2 font-body text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
                >
                  {style.label}
                </span>
                <button
                  type="button"
                  disabled={pending && resolvendoId === p.id}
                  onClick={() => resolver(p.id)}
                  className="font-body text-xs font-semibold text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-fg disabled:opacity-50 cursor-pointer"
                >
                  {pending && resolvendoId === p.id
                    ? "Marcando…"
                    : "Já verifiquei, marcar como resolvido"}
                </button>
              </div>
              <p className="font-body text-sm text-fg leading-relaxed">
                {p.descricao}
              </p>
              {p.baseLegal && (
                <p className="mt-2 font-body text-xs font-medium text-muted">
                  Base legal: {p.baseLegal}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
