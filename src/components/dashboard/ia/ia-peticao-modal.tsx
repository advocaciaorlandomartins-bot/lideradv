"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

const TIPO_OUTRO = "Outro (especificar no campo de instruções)";

type Aba = "gerar" | "revisao" | "corrigido" | "banco";

interface PeticaoBanco {
  id: string;
  area: string;
  tipo_peticao: string;
  titulo: string;
  resumo: string;
  vezes_usada: number;
  created_at: string;
}

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
  const [tipoOutro, setTipoOutro] = useState("");
  const [instrucaoExtra, setInstrucaoExtra] = useState("");
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [revisao, setRevisao] = useState("");
  const [corrigindo, setCorrigindo] = useState(false);
  const [textoCorrigido, setTextoCorrigido] = useState("");
  const [aba, setAba] = useState<Aba>("gerar");
  const [copiado, setCopiado] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvou, setSalvou] = useState<string | null>(null);
  const [peticoesBanco, setPeticoesBanco] = useState<PeticaoBanco[]>([]);
  const [carregandoBanco, setCarregandoBanco] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const skillAtual = SKILLS[skill];
  const tipoEfetivo =
    tipoPeticao === TIPO_OUTRO
      ? tipoOutro.trim() || "Petição (especificar)"
      : tipoPeticao;
  const isOutro = tipoPeticao === TIPO_OUTRO;

  // Carrega banco ao abrir a aba banco
  const carregarBanco = useCallback(async () => {
    setCarregandoBanco(true);
    try {
      const r = await fetch(`/api/ia/banco?area=${skill}&limit=5`);
      if (r.ok) setPeticoesBanco(await r.json());
    } catch {
      /* silencia */
    } finally {
      setCarregandoBanco(false);
    }
  }, [skill]);

  useEffect(() => {
    if (aba !== "banco") return;
    // Dispara carregamento fora do ciclo síncrono do efeito
    const timeout = setTimeout(() => {
      carregarBanco();
    }, 0);
    return () => clearTimeout(timeout);
  }, [aba, carregarBanco]);

  const handleSkillChange = (s: SkillId) => {
    setSkill(s);
    setTipoPeticao(SKILLS[s].tiposPeticao[0]);
    setTipoOutro("");
    setTexto("");
    setRevisao("");
    setTextoCorrigido("");
    setAba("gerar");
    setSalvou(null);
  };

  const gerar = useCallback(async () => {
    setGerando(true);
    setTexto("");
    setRevisao("");
    setTextoCorrigido("");
    setAba("gerar");
    setSalvou(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ia/peticao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          skill,
          tipoPeticao: tipoEfetivo,
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
  }, [skill, tipoEfetivo, clienteId, processoId, instrucaoExtra]);

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
          tipoPeticao: tipoEfetivo,
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
  }, [texto, tipoEfetivo, skill, clienteId, processoId]);

  const aplicarCorrecoes = useCallback(async () => {
    if (!revisao.trim()) return;
    setCorrigindo(true);
    setAba("corrigido");
    try {
      const res = await fetch("/api/ia/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoPeticao: texto,
          revisao,
          tipoPeticao: tipoEfetivo,
          skill,
          clienteId,
          processoId,
        }),
      });
      const data = await res.json();
      setTextoCorrigido(data.resultado ?? "Erro ao aplicar correções.");
    } catch {
      setTextoCorrigido("Erro de conexão.");
    } finally {
      setCorrigindo(false);
    }
  }, [texto, revisao, tipoEfetivo, skill, clienteId, processoId]);

  const copiar = (conteudo: string) => {
    navigator.clipboard.writeText(conteudo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const baixarPdf = async (conteudo: string) => {
    if (!conteudo.trim()) return;
    setBaixandoPdf(true);
    try {
      const res = await fetch("/api/ia/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: conteudo,
          tipoPeticao: tipoEfetivo,
          titulo: `${tipoEfetivo} — Dr. Lex`,
        }),
      });
      if (!res.ok) {
        alert("Erro ao gerar PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipoEfetivo
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao gerar PDF.");
    } finally {
      setBaixandoPdf(false);
    }
  };

  const salvarNoBanco = async (conteudo: string) => {
    if (!conteudo.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/ia/banco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: skill,
          tipoPeticao: tipoEfetivo,
          texto: conteudo,
          processoId: processoId ?? null,
          clienteId: clienteId ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok) setSalvou(data.id);
    } catch {
      /* silencia */
    } finally {
      setSalvando(false);
    }
  };

  const usarDoBanco = (p: PeticaoBanco) => {
    // Instrui a IA a adaptar a petição do banco para o caso atual
    setInstrucaoExtra(
      `Usar como referência a petição "${p.titulo}" do banco. Adapte todos os dados ao caso atual.`
    );
    setAba("gerar");
  };

  const textoAtual = aba === "corrigido" ? textoCorrigido : texto;

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderMarkdown = (t: string) =>
    escapeHtml(t)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /^(#+)\s(.+)/gm,
        (_, h, title) =>
          `<h${h.length} class="font-semibold mt-4 mb-1">${title}</h${h.length}>`
      )
      .replace(/^- (.+)/gm, "<li>$1</li>")
      .replace(/\n/g, "<br/>");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-fg">
              ✍️ Gerar Petição — Dr. Lex
            </h2>
            <p className="font-body text-sm text-muted">
              Especialista em {skillAtual.nome} · Erro zero · 100% dentro da lei
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
          {/* ── Left panel ── */}
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

            {/* Tipo de petição — com optgroup quando há grupos */}
            <div>
              <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Tipo de petição
              </label>
              {skillAtual.grupos ? (
                <select
                  value={tipoPeticao}
                  onChange={(e) => {
                    setTipoPeticao(e.target.value);
                    setTipoOutro("");
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg focus:border-primary focus:outline-none"
                >
                  {skillAtual.grupos.map((g) => (
                    <optgroup key={g.grupo} label={g.grupo}>
                      {g.tipos.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <select
                  value={tipoPeticao}
                  onChange={(e) => {
                    setTipoPeticao(e.target.value);
                    setTipoOutro("");
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg focus:border-primary focus:outline-none"
                >
                  {skillAtual.tiposPeticao.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}

              {/* Campo livre quando "Outro" selecionado */}
              {isOutro && (
                <input
                  type="text"
                  value={tipoOutro}
                  onChange={(e) => setTipoOutro(e.target.value)}
                  placeholder="Descreva a peça a ser gerada..."
                  className="mt-2 w-full rounded-lg border border-primary px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 focus:outline-none"
                  autoFocus
                />
              )}
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
                placeholder={
                  skill === "previdenciario"
                    ? "Ex: Incluir pedido de tutela de urgência. DER: 10/01/2024. CID: M54.5 (Lombociatalgia). Afastado desde 15/12/2023..."
                    : "Ex: Incluir pedido de tutela antecipada, focar na questão de responsabilidade objetiva..."
                }
                rows={4}
                className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Botão Gerar / Cancelar */}
            <button
              onClick={gerando ? cancelar : gerar}
              disabled={isOutro && !tipoOutro.trim()}
              className={`w-full rounded-xl px-4 py-3 font-body text-sm font-semibold transition-colors disabled:opacity-50 ${
                gerando
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              {gerando ? "⏹ Cancelar" : "⚡ Gerar petição"}
            </button>

            {/* Banco de petições */}
            <button
              onClick={() => setAba("banco")}
              className="w-full rounded-xl border border-border px-4 py-2.5 font-body text-sm font-semibold text-muted hover:border-primary hover:text-primary transition-colors"
            >
              📚 Banco de petições
            </button>
          </div>

          {/* ── Right panel ── */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            {/* Abas */}
            {(texto || textoCorrigido) && (
              <div className="flex border-b border-border px-5 pt-3 gap-4 flex-wrap">
                <AbaBtn aba="gerar" atual={aba} onClick={() => setAba("gerar")}>
                  Petição gerada
                </AbaBtn>
                {revisao && (
                  <AbaBtn
                    aba="revisao"
                    atual={aba}
                    onClick={() => setAba("revisao")}
                  >
                    Revisão da IA
                    {revisando && <Spinner />}
                  </AbaBtn>
                )}
                {textoCorrigido && (
                  <AbaBtn
                    aba="corrigido"
                    atual={aba}
                    onClick={() => setAba("corrigido")}
                  >
                    Versão corrigida
                    {corrigindo && <Spinner />}
                  </AbaBtn>
                )}
                {aba === "banco" && (
                  <AbaBtn
                    aba="banco"
                    atual={aba}
                    onClick={() => setAba("banco")}
                  >
                    Banco de petições
                  </AbaBtn>
                )}
              </div>
            )}

            {/* Banco (aba especial, sem texto) */}
            {aba === "banco" && !texto && (
              <div className="p-5 border-b border-border flex gap-3">
                <AbaBtn aba="banco" atual={aba} onClick={() => {}}>
                  Banco de petições
                </AbaBtn>
              </div>
            )}

            <div className="flex-1 p-5 overflow-y-auto">
              {/* Estado vazio */}
              {!texto && !gerando && aba !== "banco" && (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted">
                  <span className="text-4xl mb-3">✍️</span>
                  <p className="font-body text-sm">
                    Selecione a especialidade e o tipo de petição,
                    <br />
                    depois clique em <strong>Gerar petição</strong>.
                  </p>
                  <p className="font-body text-xs mt-2 text-slate-400">
                    Dr. Lex usa TODOS os dados do processo e do cliente
                    <br />
                    para criar uma peça 100% específica — nunca genérica.
                  </p>
                </div>
              )}

              {/* Gerando... */}
              {gerando && !texto && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
                    <p className="font-body text-sm text-muted">
                      Dr. Lex está redigindo...
                    </p>
                    <p className="font-body text-xs text-slate-400 mt-1">
                      {skill === "previdenciario"
                        ? "Verificando legislação · TRF5 · TNU · STJ"
                        : "Verificando legislação e jurisprudência"}
                    </p>
                  </div>
                </div>
              )}

              {/* Aba petição gerada */}
              {aba === "gerar" && texto && (
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full h-full min-h-[420px] rounded-lg border border-border p-4 font-mono text-sm text-fg focus:border-primary focus:outline-none resize-none leading-relaxed"
                />
              )}

              {/* Aba revisão */}
              {aba === "revisao" && (
                <div className="min-h-[300px]">
                  {revisando && !revisao && (
                    <p className="text-muted font-body text-sm">
                      Analisando a petição...
                    </p>
                  )}
                  {revisao && (
                    <div
                      className="font-body text-sm text-fg leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(revisao),
                      }}
                    />
                  )}
                </div>
              )}

              {/* Aba corrigida */}
              {aba === "corrigido" && (
                <div className="min-h-[300px]">
                  {corrigindo && !textoCorrigido && (
                    <p className="text-muted font-body text-sm">
                      Aplicando correções...
                    </p>
                  )}
                  {textoCorrigido && (
                    <textarea
                      value={textoCorrigido}
                      onChange={(e) => setTextoCorrigido(e.target.value)}
                      className="w-full min-h-[420px] rounded-lg border border-border p-4 font-mono text-sm text-fg focus:border-primary focus:outline-none resize-none leading-relaxed"
                    />
                  )}
                </div>
              )}

              {/* Aba banco */}
              {aba === "banco" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-body text-sm font-semibold text-fg">
                      📚 Petições aprovadas — {skillAtual.nome}
                    </h3>
                    <button
                      onClick={carregarBanco}
                      className="font-body text-xs text-muted hover:text-primary"
                    >
                      🔄 Atualizar
                    </button>
                  </div>
                  <p className="font-body text-xs text-muted">
                    Petições aprovadas servem como base para novas peças. A IA
                    adapta ao caso atual.
                  </p>
                  {carregandoBanco && (
                    <div className="flex items-center gap-2 text-muted font-body text-sm">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Carregando...
                    </div>
                  )}
                  {!carregandoBanco && peticoesBanco.length === 0 && (
                    <div className="rounded-xl border border-border bg-slate-50 p-6 text-center">
                      <p className="font-body text-sm text-muted">
                        Nenhuma petição aprovada ainda.
                      </p>
                      <p className="font-body text-xs text-slate-400 mt-1">
                        Após gerar e aprovar uma petição, ela fica disponível
                        como referência.
                      </p>
                    </div>
                  )}
                  {peticoesBanco.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-body text-sm font-semibold text-fg">
                            {p.titulo}
                          </p>
                          <p className="font-body text-xs text-muted">
                            {p.tipo_peticao}
                          </p>
                        </div>
                        <span className="text-xs text-muted flex-shrink-0">
                          Usado {p.vezes_usada}x
                        </span>
                      </div>
                      {p.resumo && (
                        <p className="font-body text-xs text-muted line-clamp-2">
                          {p.resumo}
                        </p>
                      )}
                      <button
                        onClick={() => usarDoBanco(p)}
                        className="font-body text-xs text-primary hover:underline font-semibold"
                      >
                        ↗ Usar como base para nova petição
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Barra de ações ── */}
            {(texto || textoCorrigido) && aba !== "banco" && (
              <div className="border-t border-border px-5 py-3 flex flex-wrap gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  {/* Copiar */}
                  <button
                    onClick={() => copiar(textoAtual)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg hover:border-primary hover:text-primary transition-colors"
                  >
                    {copiado ? "✓ Copiado!" : "📋 Copiar"}
                  </button>

                  {/* Baixar PDF */}
                  <button
                    onClick={() => baixarPdf(textoAtual)}
                    disabled={baixandoPdf || !textoAtual.trim()}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 font-body text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {baixandoPdf ? (
                      <>
                        <Spinner />
                        &nbsp;Gerando PDF...
                      </>
                    ) : (
                      "📄 Baixar PDF"
                    )}
                  </button>

                  {/* Revisar (só na aba gerar) */}
                  {aba === "gerar" && texto && (
                    <button
                      onClick={revisar}
                      disabled={revisando}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 font-body text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      {revisando ? "Revisando..." : "🔍 Revisar com IA"}
                    </button>
                  )}

                  {/* Aplicar correções (só na aba revisao) */}
                  {aba === "revisao" && revisao && (
                    <button
                      onClick={aplicarCorrecoes}
                      disabled={corrigindo}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {corrigindo ? (
                        <>
                          <Spinner />
                          &nbsp;Corrigindo...
                        </>
                      ) : (
                        "✅ Aplicar correções"
                      )}
                    </button>
                  )}

                  {/* Salvar no banco / Aprovar */}
                  {(aba === "gerar" || aba === "corrigido") &&
                    textoAtual.trim() && (
                      <button
                        onClick={() => salvarNoBanco(textoAtual)}
                        disabled={salvando || !!salvou}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 font-body text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                      >
                        {salvou
                          ? "✓ Salvo no banco"
                          : salvando
                            ? "Salvando..."
                            : "💾 Salvar no banco"}
                      </button>
                    )}
                </div>

                {/* Regerar */}
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

function AbaBtn({
  aba,
  atual,
  onClick,
  children,
}: {
  aba: Aba;
  atual: Aba;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 pb-2 font-body text-sm font-semibold border-b-2 transition-colors ${
        aba === atual
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
