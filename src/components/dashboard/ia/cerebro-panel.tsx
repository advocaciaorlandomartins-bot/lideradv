"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Analise {
  id: string;
  tipo: "inicial" | "documento" | "andamento";
  titulo: string;
  analise: string;
  risco: "alto" | "medio" | "baixo" | null;
  probabilidade_sucesso: number | null;
  proxima_acao: string | null;
  base_legal: string[] | null;
  created_at: string;
}

interface Props {
  processoId: string;
  processoStatus: string;
}

const COR_RISCO: Record<string, string> = {
  baixo: "text-emerald-700 bg-emerald-50 border-emerald-200",
  medio: "text-amber-700 bg-amber-50 border-amber-200",
  alto: "text-red-700 bg-red-50 border-red-200",
};

const LABEL_RISCO: Record<string, string> = {
  baixo: "Risco Baixo",
  medio: "Risco Médio",
  alto: "Risco Alto",
};

const COR_BARRA: Record<string, string> = {
  baixo: "bg-emerald-500",
  medio: "bg-amber-500",
  alto: "bg-red-500",
};

const TIPO_LABEL: Record<string, string> = {
  inicial: "Análise do Caso",
  documento: "Análise de Documento",
  andamento: "Interpretação de Andamento",
};

const TIPO_ICON: Record<string, string> = {
  inicial: "🧠",
  documento: "📄",
  andamento: "📋",
};

export default function CerebroPanel({ processoId, processoStatus }: Props) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [idExpandida, setIdExpandida] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const autoRef = useRef(false);
  const didMount = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/cerebro/status/${processoId}`);
      if (r.ok) {
        const data = await r.json();
        setAnalises(data.analises || []);
      }
    } catch {
      // silently fail
    }
  }, [processoId]);

  const analisar = useCallback(async () => {
    setAnalisando(true);
    setErro("");
    try {
      const r = await fetch("/api/cerebro/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d.error || "Erro ao analisar.");
      } else {
        await carregar();
        setExpandido(true);
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setAnalisando(false);
    }
  }, [processoId, carregar]);

  // Load on mount
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    carregar().then(() => {
      // trigger learning silently for concluded cases
      if (processoStatus === "Concluída") {
        fetch("/api/cerebro/aprender", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processo_id: processoId }),
        }).catch(() => {});
      }
    });
  }, [processoId, processoStatus, carregar]);

  // Auto-analyze on first open if no analysis yet
  useEffect(() => {
    if (autoRef.current) return;
    if (analises.length === 0) return;
    // only skip the auto if we already have data
    autoRef.current = true;
  }, [analises]);

  useEffect(() => {
    if (autoRef.current) return;
    if (!didMount.current) return;
    // if after loading there's still nothing, auto-analyze (once)
    const t = setTimeout(() => {
      if (!autoRef.current && analises.length === 0 && !analisando) {
        autoRef.current = true;
        analisar();
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [analises, analisando, analisar]);

  const ultimaInicial = analises.find((a) => a.tipo === "inicial");
  const risco = ultimaInicial?.risco ?? null;
  const prob = ultimaInicial?.probabilidade_sucesso ?? null;
  const corBarra = risco ? COR_BARRA[risco] : "bg-slate-300";

  // Format analysis text as HTML-ish rendered sections
  const renderAnalise = (texto: string) => {
    const lines = texto.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        elements.push(
          <h3
            key={i}
            className="font-body text-sm font-bold text-fg mt-4 mb-1 first:mt-0"
          >
            {line.replace("## ", "")}
          </h3>
        );
      } else if (line.startsWith("• ") || line.startsWith("- ")) {
        elements.push(
          <li key={i} className="font-body text-sm text-fg ml-3 leading-snug">
            {line.slice(2)}
          </li>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={i} className="font-body text-sm text-fg leading-relaxed">
            {line}
          </p>
        );
      }
      i++;
    }
    return elements;
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-violet-50 border-b border-violet-200">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🧠</span>
          <div>
            <p className="font-body text-sm font-bold text-violet-900">
              Cérebro Jurídico
            </p>
            <p className="font-body text-xs text-violet-600">
              {analisando
                ? "Analisando o caso..."
                : ultimaInicial
                  ? `Analisado em ${new Date(ultimaInicial.created_at).toLocaleDateString("pt-BR")}`
                  : "Análise automática inteligente"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analises.length > 0 && (
            <button
              onClick={() => setExpandido((v) => !v)}
              className="font-body text-xs text-violet-700 hover:text-violet-900 underline-offset-2 hover:underline transition-colors"
            >
              {expandido ? "Ocultar" : "Ver análise"}
            </button>
          )}
          <button
            onClick={analisar}
            disabled={analisando}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 font-body text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {analisando ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analisando...
              </>
            ) : ultimaInicial ? (
              "🔄 Reanalisar"
            ) : (
              "⚡ Analisar caso"
            )}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {ultimaInicial && !analisando && (
        <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-border">
          {/* Risk */}
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-muted">Risco:</span>
            {risco && (
              <span
                className={`rounded-full border px-2 py-0.5 font-body text-xs font-bold ${COR_RISCO[risco]}`}
              >
                {LABEL_RISCO[risco]}
              </span>
            )}
          </div>

          {/* Probability */}
          {prob !== null && (
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-muted">Êxito:</span>
              <div className="flex items-center gap-1.5 flex-1">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 max-w-[80px]">
                  <div
                    className={`h-1.5 rounded-full ${corBarra}`}
                    style={{ width: `${prob}%` }}
                  />
                </div>
                <span className="font-body text-xs font-bold text-fg">
                  {prob}%
                </span>
              </div>
            </div>
          )}

          {/* Next action */}
          {ultimaInicial.proxima_acao && (
            <div className="flex items-start gap-1.5 sm:col-span-1">
              <span className="font-body text-xs text-muted flex-shrink-0">
                Ação:
              </span>
              <span className="font-body text-xs text-fg line-clamp-2">
                {ultimaInicial.proxima_acao}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {analisando && (
        <div className="px-5 py-6 flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="font-body text-sm text-muted">
            O Cérebro Jurídico está analisando o caso completo — histórico,
            documentos e jurisprudência. Isso leva alguns segundos...
          </p>
        </div>
      )}

      {/* First-time empty state (after load, not analyzing) */}
      {!ultimaInicial && !analisando && analises.length === 0 && (
        <div className="px-5 py-5 text-center">
          <p className="font-body text-sm text-muted">
            Nenhuma análise ainda. Clique em <strong>⚡ Analisar caso</strong>{" "}
            para gerar o diagnóstico estratégico completo.
          </p>
        </div>
      )}

      {/* Error */}
      {erro && (
        <div className="px-5 py-3">
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 font-body text-xs text-red-700">
            {erro}
          </p>
        </div>
      )}

      {/* Expanded full analysis */}
      {expandido && analises.length > 0 && (
        <div className="divide-y divide-border">
          {analises.map((a) => (
            <div key={a.id} className="px-5 py-4">
              <button
                onClick={() =>
                  setIdExpandida(idExpandida === a.id ? null : a.id)
                }
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span>{TIPO_ICON[a.tipo] || "📝"}</span>
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      {a.titulo || TIPO_LABEL[a.tipo]}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                      {a.risco && (
                        <span
                          className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${COR_RISCO[a.risco]}`}
                        >
                          {LABEL_RISCO[a.risco]}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-muted text-xs flex-shrink-0">
                  {idExpandida === a.id ? "▲" : "▼"}
                </span>
              </button>

              {idExpandida === a.id && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {renderAnalise(a.analise || "")}

                  {a.base_legal && a.base_legal.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border">
                      {a.base_legal.map((b, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 font-body text-[11px] text-blue-700"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
