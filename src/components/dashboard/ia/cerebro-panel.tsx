"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MetadadosCerebro } from "@/lib/cerebroJuridico";

interface Analise {
  id: string;
  tipo: "inicial" | "documento" | "andamento";
  titulo: string;
  analise: string;
  risco: "alto" | "medio" | "baixo" | null;
  probabilidade_sucesso: number | null;
  proxima_acao: string | null;
  base_legal: string[] | null;
  metadata: MetadadosCerebro | null;
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
  const [mostrarChecklist, setMostrarChecklist] = useState(false);
  const [erro, setErro] = useState("");
  const [streamText, setStreamText] = useState("");
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
      // silencioso
    }
  }, [processoId]);

  const analisar = useCallback(async () => {
    setAnalisando(true);
    setErro("");
    setStreamText("");

    try {
      const response = await fetch("/api/cerebro/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId }),
      });

      if (!response.ok || !response.body) {
        const d = await response.json().catch(() => ({}));
        const msg = (d as { error?: string }).error;
        setErro(
          msg || `Erro ao analisar (HTTP ${response.status}). Tente novamente.`
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              t?: string;
              done?: boolean;
              error?: string;
            };
            if (data.t) {
              setStreamText((prev) => prev + data.t);
            } else if (data.done) {
              await carregar();
              setExpandido(true);
              setStreamText("");
            } else if (data.error) {
              setErro(data.error);
            }
          } catch {
            // evento mal-formado — ignora
          }
        }
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setAnalisando(false);
    }
  }, [processoId, carregar]);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    carregar().then(() => {
      if (processoStatus === "Concluída") {
        fetch("/api/cerebro/aprender", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processo_id: processoId }),
        }).catch(() => {});
      }
    });
  }, [processoId, processoStatus, carregar]);

  useEffect(() => {
    if (analises.length > 0) autoRef.current = true;
  }, [analises]);

  useEffect(() => {
    if (autoRef.current || !didMount.current) return;
    const t = setTimeout(() => {
      if (!autoRef.current && analises.length === 0 && !analisando) {
        autoRef.current = true;
        analisar();
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [analises, analisando, analisar]);

  const ultima = analises.find((a) => a.tipo === "inicial");
  const meta = ultima?.metadata ?? null;
  const risco = ultima?.risco ?? null;
  const prob = ultima?.probabilidade_sucesso ?? null;
  const corBarra = risco ? COR_BARRA[risco] : "bg-slate-300";

  const alertasCriticos =
    meta?.alertas?.filter((a) => a.nivel === "critico") ?? [];
  const alertasAtencao =
    meta?.alertas?.filter((a) => a.nivel === "atencao") ?? [];
  const faltantesCriticos =
    meta?.dados_faltantes?.filter((f) => f.prioridade === "alta") ?? [];
  const faltantesMedia =
    meta?.dados_faltantes?.filter((f) => f.prioridade === "media") ?? [];

  const renderAnalise = (texto: string) =>
    texto.split("\n").map((line, i) => {
      if (line.startsWith("## "))
        return (
          <h3
            key={i}
            className="font-body text-sm font-bold text-fg mt-4 mb-1 first:mt-0"
          >
            {line.replace("## ", "")}
          </h3>
        );
      if (line.startsWith("• ") || line.startsWith("- "))
        return (
          <li key={i} className="font-body text-sm text-fg ml-3 leading-snug">
            {line.slice(2)}
          </li>
        );
      if (line.trim())
        return (
          <p key={i} className="font-body text-sm text-fg leading-relaxed">
            {line}
          </p>
        );
      return null;
    });

  return (
    <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-violet-50 border-b border-violet-200">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🧠</span>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-body text-sm font-bold text-violet-900">
                Cérebro Jurídico
              </p>
              {meta?.modo_especializado && (
                <span className="rounded-full bg-violet-100 border border-violet-300 px-2 py-0.5 font-body text-[10px] font-semibold text-violet-700">
                  {meta.modo_especializado}
                </span>
              )}
              {meta?.completude_pct !== undefined && (
                <span
                  className={`rounded-full border px-2 py-0.5 font-body text-[10px] font-semibold ${
                    meta.completude_pct >= 80
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : meta.completude_pct >= 55
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  Dados: {meta.completude_pct}%
                </span>
              )}
            </div>
            <p className="font-body text-xs text-violet-600">
              {analisando
                ? "Analisando o caso completo — aguarde..."
                : ultima
                  ? `Atualizado em ${new Date(ultima.created_at).toLocaleDateString("pt-BR")}`
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
            ) : ultima ? (
              "🔄 Reanalisar"
            ) : (
              "⚡ Analisar caso"
            )}
          </button>
        </div>
      </div>

      {/* ── Alertas críticos (prescrição/decadência) ── */}
      {alertasCriticos.length > 0 && (
        <div className="px-5 py-3 border-b border-red-200 bg-red-50 space-y-1.5">
          {alertasCriticos.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-red-600 flex-shrink-0 font-bold text-sm">
                ⚠️
              </span>
              <div>
                <p className="font-body text-xs font-bold text-red-800">
                  {a.mensagem}
                </p>
                <p className="font-body text-[10px] text-red-600">
                  {a.base_legal}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Alertas de atenção ── */}
      {alertasAtencao.length > 0 && (
        <div className="px-5 py-2.5 border-b border-amber-200 bg-amber-50 space-y-1">
          {alertasAtencao.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber-600 flex-shrink-0 text-sm">⏰</span>
              <div>
                <p className="font-body text-xs font-semibold text-amber-800">
                  {a.mensagem}
                </p>
                <p className="font-body text-[10px] text-amber-600">
                  {a.base_legal}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary strip ── */}
      {ultima && !analisando && (
        <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-border">
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
          {ultima.proxima_acao && (
            <div className="flex items-start gap-1.5">
              <span className="font-body text-xs text-muted flex-shrink-0">
                Ação:
              </span>
              <span className="font-body text-xs text-fg line-clamp-2">
                {ultima.proxima_acao}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Benefício + Estratégia ── */}
      {meta && (meta.beneficio_provavel || meta.estrategia_recomendada) && (
        <div className="px-5 py-2.5 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
          {meta.beneficio_provavel && (
            <div className="flex items-start gap-1.5">
              <span className="font-body text-[10px] text-muted uppercase tracking-wide flex-shrink-0 mt-0.5">
                Benefício:
              </span>
              <span className="font-body text-xs text-fg font-medium line-clamp-2">
                {meta.beneficio_provavel}
              </span>
            </div>
          )}
          {meta.estrategia_recomendada && (
            <div className="flex items-start gap-1.5">
              <span className="font-body text-[10px] text-muted uppercase tracking-wide flex-shrink-0 mt-0.5">
                Via:
              </span>
              <span className="font-body text-xs text-fg font-medium line-clamp-2">
                {meta.estrategia_recomendada}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Checklist de dados faltantes ── */}
      {meta && (faltantesCriticos.length > 0 || faltantesMedia.length > 0) && (
        <div className="border-b border-border">
          <button
            onClick={() => setMostrarChecklist((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="font-body text-xs font-semibold text-fg">
                Dados faltantes
              </span>
              {faltantesCriticos.length > 0 && (
                <span className="rounded-full bg-red-100 border border-red-200 px-1.5 py-0.5 font-body text-[10px] font-bold text-red-700">
                  {faltantesCriticos.length} crítico
                  {faltantesCriticos.length !== 1 ? "s" : ""}
                </span>
              )}
              {faltantesMedia.length > 0 && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 font-body text-[10px] text-amber-700">
                  {faltantesMedia.length} importante
                  {faltantesMedia.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <span className="text-muted text-xs">
              {mostrarChecklist ? "▲" : "▼"}
            </span>
          </button>
          {mostrarChecklist && (
            <div className="px-5 pb-4 space-y-1.5">
              {faltantesCriticos.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2"
                >
                  <span className="text-red-500 flex-shrink-0 text-xs font-bold mt-0.5">
                    !
                  </span>
                  <div>
                    <p className="font-body text-xs font-semibold text-red-800">
                      {f.campo}
                    </p>
                    <p className="font-body text-[10px] text-red-600">
                      {f.impacto}
                    </p>
                  </div>
                </div>
              ))}
              {faltantesMedia.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2"
                >
                  <span className="text-amber-500 flex-shrink-0 text-xs mt-0.5">
                    ○
                  </span>
                  <div>
                    <p className="font-body text-xs font-semibold text-amber-800">
                      {f.campo}
                    </p>
                    <p className="font-body text-[10px] text-amber-600">
                      {f.impacto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tarefa criada ── */}
      {meta?.tarefa_criada && (
        <div className="px-5 py-2 border-b border-emerald-100 bg-emerald-50">
          <p className="font-body text-xs text-emerald-700">
            ✅ Tarefa criada automaticamente em &ldquo;Minhas Tarefas&rdquo; com
            a próxima ação recomendada.
          </p>
        </div>
      )}

      {/* ── Loading / Streaming ── */}
      {analisando && (
        <div className="px-5 py-4">
          {streamText ? (
            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent flex-shrink-0" />
                <p className="font-body text-xs text-violet-600 font-semibold">
                  Analisando...
                </p>
              </div>
              {renderAnalise(streamText)}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="font-body text-sm text-muted">
                Preparando análise jurídica completa...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!ultima && !analisando && analises.length === 0 && (
        <div className="px-5 py-5 text-center">
          <p className="font-body text-sm text-muted">
            Nenhuma análise ainda. Clique em <strong>⚡ Analisar caso</strong>{" "}
            para gerar o diagnóstico estratégico completo.
          </p>
        </div>
      )}

      {/* ── Erro ── */}
      {erro && (
        <div className="px-5 py-3">
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 font-body text-xs text-red-700">
            {erro}
          </p>
        </div>
      )}

      {/* ── Análise completa expandida ── */}
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
                      {a.titulo}
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
