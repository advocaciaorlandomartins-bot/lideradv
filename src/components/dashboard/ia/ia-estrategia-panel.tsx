"use client";

import { useState } from "react";
import {
  SKILLS,
  type SkillId,
  type EstrategiaResult,
} from "@/lib/ai-juridico-skills";

interface Props {
  clienteId?: string;
  processoId?: string;
  areaProcesso?: string;
}

const SKILL_AREA_MAP: Record<string, SkillId> = {
  Previdenciário: "previdenciario",
  Trabalhista: "trabalhista",
  Cível: "civel",
  "Direito do Consumidor": "consumidor",
  Família: "familia",
};

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

export default function IaEstrategiaPanel({
  clienteId,
  processoId,
  areaProcesso,
}: Props) {
  const defaultSkill: SkillId =
    (areaProcesso ? SKILL_AREA_MAP[areaProcesso] : undefined) ??
    "previdenciario";

  const [skill, setSkill] = useState<SkillId>(defaultSkill);
  const [resultado, setResultado] = useState<EstrategiaResult | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const analisar = async () => {
    setCarregando(true);
    setErro("");
    setResultado(null);
    try {
      const res = await fetch("/api/ia/estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, clienteId, processoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao analisar.");
      } else {
        setResultado(data);
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  };

  const prob = resultado?.probabilidadeExito ?? 0;
  const corBarra =
    prob >= 70 ? "bg-emerald-500" : prob >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-fg flex items-center gap-2">
            🧠 Diagnóstico Estratégico IA
          </h3>
          <p className="font-body text-xs text-muted mt-0.5">
            Análise da probabilidade de êxito e estratégia recomendada pelo Dr.
            Lex
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as SkillId)}
            className="rounded-lg border border-border px-2 py-1.5 font-body text-xs text-fg focus:border-primary focus:outline-none"
          >
            {Object.values(SKILLS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.nome}
              </option>
            ))}
          </select>
          <button
            onClick={analisar}
            disabled={carregando}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {carregando ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analisando...
              </>
            ) : resultado ? (
              "🔄 Reanalisar"
            ) : (
              "⚡ Analisar caso"
            )}
          </button>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="space-y-4">
          {/* Probabilidade */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm font-semibold text-fg">
                Probabilidade de êxito
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-body text-xs font-bold ${COR_RISCO[resultado.classificacaoRisco]}`}
                >
                  {LABEL_RISCO[resultado.classificacaoRisco]}
                </span>
                <span className="font-heading text-2xl font-bold text-fg">
                  {prob}%
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${corBarra}`}
                style={{ width: `${prob}%` }}
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="font-body text-sm text-fg leading-relaxed">
              {resultado.resumoEstrategico}
            </p>
          </div>

          {/* Fortes e Frágeis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 className="font-body text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                ✅ Pontos fortes
              </h4>
              <ul className="space-y-1">
                {resultado.pontosFortes.map((p, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-emerald-800 flex gap-2"
                  >
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h4 className="font-body text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                ⚠️ Pontos frágeis
              </h4>
              <ul className="space-y-1">
                {resultado.pontosFrageis.map((p, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-red-800 flex gap-2"
                  >
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Estratégia */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h4 className="font-body text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">
              🎯 Estratégia recomendada
            </h4>
            <p className="font-body text-sm text-blue-900 leading-relaxed">
              {resultado.estrategiaRecomendada}
            </p>
          </div>

          {/* Próximas ações */}
          {resultado.proximas_acoes.length > 0 && (
            <div>
              <h4 className="font-body text-xs font-bold text-muted uppercase tracking-wide mb-2">
                📋 Próximas ações
              </h4>
              <ol className="space-y-1">
                {resultado.proximas_acoes.map((a, i) => (
                  <li key={i} className="flex gap-2 font-body text-sm text-fg">
                    <span className="flex-shrink-0 font-semibold text-primary">
                      {i + 1}.
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Jurisprudência */}
          {resultado.jurisprudenciaRelevante.length > 0 && (
            <div>
              <h4 className="font-body text-xs font-bold text-muted uppercase tracking-wide mb-2">
                📚 Jurisprudência relevante
              </h4>
              <ul className="space-y-1">
                {resultado.jurisprudenciaRelevante.map((j, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-muted flex gap-2"
                  >
                    <span>•</span>
                    <span>{j}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.tempoEstimadoMeses && (
            <p className="font-body text-xs text-muted border-t border-border pt-3">
              ⏱ Tempo estimado de resolução:{" "}
              <strong>
                {resultado.tempoEstimadoMeses} mese
                {resultado.tempoEstimadoMeses !== 1 ? "s" : ""}
              </strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
