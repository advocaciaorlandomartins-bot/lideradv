"use client";

import { useState, useRef, useCallback } from "react";
import { SKILLS, type SkillId } from "@/lib/ai-juridico-skills";

interface Props {
  clienteId?: string;
  processoId?: string;
  areaProcesso?: string;
  onClose: () => void;
}

const SKILL_AREA_MAP: Record<string, SkillId> = {
  Previdenciário: "previdenciario",
  Trabalhista: "trabalhista",
  Cível: "civel",
  "Direito do Consumidor": "consumidor",
  Família: "familia",
};

export default function IaPeticaoModal({
  clienteId,
  processoId,
  areaProcesso,
  onClose,
}: Props) {
  const defaultSkill: SkillId =
    (areaProcesso ? SKILL_AREA_MAP[areaProcesso] : undefined) ??
    "previdenciario";

  const [skill, setSkill] = useState<SkillId>(defaultSkill);
  const [tipoPeticao, setTipoPeticao] = useState(
    SKILLS[defaultSkill].tiposPeticao[0]
  );
  const [instrucaoExtra, setInstrucaoExtra] = useState("");
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [revisao, setRevisao] = useState("");
  const [aba, setAba] = useState<"gerar" | "revisao">("gerar");
  const [copiado, setCopiado] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSkillChange = (s: SkillId) => {
    setSkill(s);
    setTipoPeticao(SKILLS[s].tiposPeticao[0]);
    setTexto("");
    setRevisao("");
    setAba("gerar");
  };

  const gerar = useCallback(async () => {
    setGerando(true);
    setTexto("");
    setRevisao("");
    setAba("gerar");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ia/peticao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          skill,
          tipoPeticao,
          clienteId,
          processoId,
          instrucaoExtra: instrucaoExtra || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Erro desconhecido" }));
        setTexto(`Erro: ${err.error}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTexto(acc);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setTexto("Erro de conexão. Tente novamente.");
      }
    } finally {
      setGerando(false);
    }
  }, [skill, tipoPeticao, clienteId, processoId, instrucaoExtra]);

  const cancelar = () => {
    abortRef.current?.abort();
    setGerando(false);
  };

  const revisar = useCallback(async () => {
    if (!texto.trim()) return;
    setRevisando(true);
    setAba("revisao");
    try {
      const res = await fetch("/api/ia/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoPeticao: texto,
          tipoPeticao,
          skill,
          clienteId,
          processoId,
        }),
      });
      const data = await res.json();
      setRevisao(data.resultado ?? data.error ?? "Erro ao revisar.");
    } catch {
      setRevisao("Erro de conexão.");
    } finally {
      setRevisando(false);
    }
  }, [texto, tipoPeticao, skill, clienteId, processoId]);

  const copiar = () => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const skillAtual = SKILLS[skill];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-fg">
              ✍️ Gerar Petição com IA
            </h2>
            <p className="font-body text-sm text-muted">
              Dr. Lex — especialista em {skillAtual.nome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-0">
          {/* Left panel — configuração */}
          <div className="w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border p-5 space-y-4">
            {/* Skill selector */}
            <div>
              <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Especialidade
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                {(Object.values(SKILLS) as (typeof SKILLS)[SkillId][]).map(
                  (s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSkillChange(s.id)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left font-body text-sm transition-colors ${
                        skill === s.id
                          ? "bg-primary text-white font-semibold"
                          : "bg-slate-50 text-fg hover:bg-slate-100"
                      }`}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.nome}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Tipo de petição */}
            <div>
              <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Tipo de petição
              </label>
              <select
                value={tipoPeticao}
                onChange={(e) => setTipoPeticao(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg focus:border-primary focus:outline-none"
              >
                {skillAtual.tiposPeticao.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Instruções extras */}
            <div>
              <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Instruções específicas{" "}
                <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                value={instrucaoExtra}
                onChange={(e) => setInstrucaoExtra(e.target.value)}
                placeholder="Ex: Incluir pedido de tutela antecipada, mencionar que o cliente tentou 3 vezes no INSS..."
                rows={4}
                className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Gerar button */}
            <button
              onClick={gerando ? cancelar : gerar}
              className={`w-full rounded-xl px-4 py-3 font-body text-sm font-semibold transition-colors ${
                gerando
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              {gerando ? "⏹ Cancelar geração" : "⚡ Gerar petição"}
            </button>
          </div>

          {/* Right panel — resultado */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            {/* Tabs */}
            {texto && (
              <div className="flex border-b border-border px-5 pt-3 gap-4">
                <button
                  onClick={() => setAba("gerar")}
                  className={`pb-2 font-body text-sm font-semibold border-b-2 transition-colors ${
                    aba === "gerar"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  Petição gerada
                </button>
                <button
                  onClick={() => setAba("revisao")}
                  className={`pb-2 font-body text-sm font-semibold border-b-2 transition-colors ${
                    aba === "revisao"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  Revisão da IA
                  {revisando && (
                    <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  )}
                </button>
              </div>
            )}

            <div className="flex-1 p-5">
              {!texto && !gerando && (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted">
                  <span className="text-4xl mb-3">✍️</span>
                  <p className="font-body text-sm">
                    Selecione a especialidade e o tipo de petição,
                    <br />
                    depois clique em <strong>Gerar petição</strong>.
                  </p>
                  <p className="font-body text-xs mt-2 text-slate-400">
                    O Dr. Lex usa todos os dados do processo e do cliente
                    <br />
                    para criar uma peça específica e não-genérica.
                  </p>
                </div>
              )}

              {gerando && !texto && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
                    <p className="font-body text-sm text-muted">
                      Dr. Lex está redigindo...
                    </p>
                  </div>
                </div>
              )}

              {aba === "gerar" && texto && (
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full h-full min-h-[420px] rounded-lg border border-border p-4 font-mono text-sm text-fg focus:border-primary focus:outline-none resize-none leading-relaxed"
                  placeholder="A petição aparecerá aqui..."
                />
              )}

              {aba === "revisao" && (
                <div className="prose prose-sm max-w-none h-full overflow-y-auto">
                  {revisando && !revisao && (
                    <p className="text-muted">Analisando a petição...</p>
                  )}
                  {revisao && (
                    <div
                      className="text-fg font-body text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: revisao
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(
                            /^(#+)\s(.+)/gm,
                            (_, h, t) =>
                              `<h${h.length} class="font-semibold mt-4 mb-1">${t}</h${h.length}>`
                          )
                          .replace(/^- (.+)/gm, "<li>$1</li>")
                          .replace(/\n/g, "<br/>"),
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {texto && (
              <div className="border-t border-border px-5 py-3 flex flex-wrap gap-2 justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={copiar}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg hover:border-primary hover:text-primary transition-colors"
                  >
                    {copiado ? "✓ Copiado!" : "📋 Copiar texto"}
                  </button>
                  <button
                    onClick={revisar}
                    disabled={revisando}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 font-body text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {revisando ? "Revisando..." : "🔍 Revisar com IA"}
                  </button>
                </div>
                <button
                  onClick={gerar}
                  disabled={gerando}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 font-body text-xs font-semibold text-muted hover:text-fg transition-colors disabled:opacity-50"
                >
                  🔄 Regerar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
