"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  SKILLS,
  type SkillId,
  type EstrategiaResult,
} from "@/lib/ai-juridico-skills";

const IaPeticaoModal = dynamic(() => import("./ia-peticao-modal"), {
  ssr: false,
});
const IaAnalisarModal = dynamic(() => import("./ia-analisar-modal"), {
  ssr: false,
});

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

type Secao = "peticao" | "analisar" | "estrategia" | null;

export default function IaJuridicaSection({
  clienteId,
  processoId,
  areaProcesso,
}: Props) {
  const defaultSkill: SkillId =
    (areaProcesso ? SKILL_AREA_MAP[areaProcesso] : undefined) ??
    "previdenciario";

  const [secao, setSecao] = useState<Secao>(null);
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
      if (!res.ok) setErro(data.error ?? "Erro ao analisar.");
      else setResultado(data);
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
    <>
      {/* ── Modais ── */}
      {secao === "peticao" && (
        <IaPeticaoModal
          clienteId={clienteId}
          processoId={processoId}
          areaProcesso={areaProcesso}
          onClose={() => setSecao(null)}
        />
      )}
      {secao === "analisar" && (
        <IaAnalisarModal
          clienteId={clienteId}
          processoId={processoId}
          onClose={() => setSecao(null)}
        />
      )}

      {/* ── Painel principal ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {/* Header com 3 botões em linha */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border">
          <ActionButton
            icon="✍️"
            label="Gerar Petição"
            sublabel="Dr. Lex · Especialista"
            active={secao === "peticao"}
            onClick={() => setSecao(secao === "peticao" ? null : "peticao")}
            color="primary"
          />
          <ActionButton
            icon="🔍"
            label="Analisar Documento"
            sublabel="PDF ou imagem"
            active={secao === "analisar"}
            onClick={() => setSecao(secao === "analisar" ? null : "analisar")}
            color="blue"
            border
          />
          <ActionButton
            icon="🧠"
            label="Diagnóstico Estratégico"
            sublabel="Probabilidade de êxito"
            active={secao === "estrategia"}
            onClick={() =>
              setSecao(secao === "estrategia" ? null : "estrategia")
            }
            color="violet"
            border
          />
        </div>

        {/* ── Diagnóstico Estratégico inline ── */}
        {secao === "estrategia" && (
          <div className="p-5 space-y-4">
            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
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
              {!resultado && !carregando && (
                <p className="font-body text-xs text-muted">
                  Analisa o caso completo com base em todos os dados do processo
                  e do cliente.
                </p>
              )}
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
                        <li
                          key={i}
                          className="flex gap-2 font-body text-sm text-fg"
                        >
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
                    ⏱ Tempo estimado:{" "}
                    <strong>
                      {resultado.tempoEstimadoMeses} mese
                      {resultado.tempoEstimadoMeses !== 1 ? "s" : ""}
                    </strong>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ActionButton({
  icon,
  label,
  sublabel,
  active,
  onClick,
  color,
  border,
}: {
  icon: string;
  label: string;
  sublabel: string;
  active: boolean;
  onClick: () => void;
  color: "primary" | "blue" | "violet";
  border?: boolean;
}) {
  const activeClasses = {
    primary: "bg-primary text-white",
    blue: "bg-blue-600 text-white",
    violet: "bg-violet-600 text-white",
  };
  const hoverClasses = {
    primary: "hover:bg-primary/5 hover:text-primary",
    blue: "hover:bg-blue-50 hover:text-blue-700",
    violet: "hover:bg-violet-50 hover:text-violet-700",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 transition-colors text-left w-full ${
        border ? "sm:border-l border-border" : ""
      } ${active ? activeClasses[color] : `text-fg ${hoverClasses[color]}`}`}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <p className="font-body text-sm font-semibold">{label}</p>
        <p
          className={`font-body text-xs ${active ? "opacity-80" : "text-muted"}`}
        >
          {sublabel}
        </p>
      </div>
    </button>
  );
}
