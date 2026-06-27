"use client";

import { useState, useEffect, useCallback } from "react";
import { SKILLS, type SkillId } from "@/lib/ai-juridico-skills";

interface Peticao {
  id: string;
  area: string;
  tipo_peticao: string;
  titulo: string;
  resumo: string | null;
  texto?: string;
  aprovada: boolean;
  vezes_usada: number;
  created_at: string;
}

interface Props {
  processoId: string;
  clienteId?: string;
  areaProcesso?: string;
}

const SKILL_AREA_MAP: Record<string, SkillId> = {
  Previdenciário: "previdenciario",
  Trabalhista: "trabalhista",
  Cível: "civel",
  "Direito do Consumidor": "consumidor",
  Família: "familia",
};

export default function IaPeticoesProcesso({
  processoId,
  clienteId,
  areaProcesso,
}: Props) {
  const [peticoes, setPeticoes] = useState<Peticao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Peticao | null>(null);
  const [textoEditor, setTextoEditor] = useState("");
  const [tituloEditor, setTituloEditor] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [instrucaoModif, setInstrucaoModif] = useState("");
  const [modificando, setModificando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [salvoOk, setSalvoOk] = useState(false);

  const defaultSkill: SkillId =
    (areaProcesso ? SKILL_AREA_MAP[areaProcesso] : undefined) ??
    "previdenciario";

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/ia/banco?processoId=${processoId}&limit=50`);
      if (r.ok) setPeticoes(await r.json());
    } catch {
      /* silencia */
    } finally {
      setCarregando(false);
    }
  }, [processoId]);

  useEffect(() => {
    const t = setTimeout(() => {
      carregar();
    }, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // Abre editor carregando o texto completo
  const abrirEditor = async (p: Peticao) => {
    const r = await fetch(`/api/ia/banco/${p.id}`);
    if (!r.ok) return;
    const data = await r.json();
    setEditando(data);
    setTextoEditor(data.texto ?? "");
    setTituloEditor(data.titulo ?? "");
    setInstrucaoModif("");
    setSalvoOk(false);
  };

  // Salva edição manual
  const salvarEdicao = async () => {
    if (!editando) return;
    setSalvandoEdicao(true);
    try {
      await fetch(`/api/ia/banco/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoEditor, titulo: tituloEditor }),
      });
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 3000);
      setPeticoes((prev) =>
        prev.map((p) =>
          p.id === editando.id
            ? {
                ...p,
                titulo: tituloEditor,
                resumo: textoEditor.replace(/\n+/g, " ").trim().slice(0, 200),
              }
            : p
        )
      );
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Modificar com IA — incorpora nova instrução / prova / fato
  const modificarComIA = async () => {
    if (!editando || !instrucaoModif.trim()) return;
    setModificando(true);
    try {
      const skill =
        (editando.area as SkillId) in SKILLS
          ? (editando.area as SkillId)
          : defaultSkill;

      const res = await fetch("/api/ia/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoPeticao: textoEditor,
          revisao: `MODIFICAÇÃO SOLICITADA PELO ADVOGADO:\n${instrucaoModif}\n\nAplique esta modificação na petição. Mantenha toda a estrutura, dados e fundamentos existentes. Incorpore apenas o que foi solicitado acima, sem inventar dados.`,
          tipoPeticao: editando.tipo_peticao,
          skill,
          processoId,
          clienteId,
        }),
      });
      const data = await res.json();
      if (data.resultado) {
        setTextoEditor(data.resultado);
        setInstrucaoModif("");
      }
    } finally {
      setModificando(false);
    }
  };

  // Baixar PDF
  const baixarPdf = async () => {
    if (!editando || !textoEditor.trim()) return;
    setBaixandoPdf(true);
    try {
      const res = await fetch("/api/ia/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: textoEditor,
          tipoPeticao: editando.tipo_peticao,
          titulo: tituloEditor,
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
      a.download = `${tituloEditor
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 80)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Aprovar petição
  const aprovar = async (id: string) => {
    await fetch(`/api/ia/banco/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprovada: true }),
    });
    setPeticoes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, aprovada: true } : p))
    );
  };

  // Excluir
  const excluir = async (id: string) => {
    await fetch(`/api/ia/banco/${id}`, { method: "DELETE" });
    setPeticoes((prev) => prev.filter((p) => p.id !== id));
    setConfirmExcluir(null);
    if (editando?.id === id) setEditando(null);
  };

  if (carregando) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted font-body text-sm">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Carregando petições...
        </div>
      </div>
    );
  }

  if (peticoes.length === 0) return null;

  return (
    <>
      {/* Editor modal */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl mb-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex-1 min-w-0">
                <input
                  value={tituloEditor}
                  onChange={(e) => setTituloEditor(e.target.value)}
                  className="w-full font-heading text-base font-semibold text-fg bg-transparent focus:outline-none border-b border-transparent hover:border-border focus:border-primary pb-0.5"
                />
                <p className="font-body text-xs text-muted mt-0.5">
                  {editando.tipo_peticao} ·{" "}
                  {new Date(editando.created_at).toLocaleDateString("pt-BR")}
                  {editando.aprovada && (
                    <span className="ml-2 text-emerald-600 font-semibold">
                      ✓ Aprovada
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setEditando(null)}
                className="ml-4 rounded-lg p-2 text-muted hover:bg-slate-100 flex-shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Modificar com IA */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <h3 className="font-body text-sm font-semibold text-amber-800 flex items-center gap-2">
                  🤖 Modificar com Dr. Lex
                </h3>
                <p className="font-body text-xs text-amber-700">
                  Descreva o que precisa alterar: nova prova, novo fato, mudança
                  de pedido, atualização de jurisprudência... A IA incorpora sem
                  inventar dados.
                </p>
                <textarea
                  value={instrucaoModif}
                  onChange={(e) => setInstrucaoModif(e.target.value)}
                  placeholder="Ex: O cliente obteve um atestado médico do Dr. João Silva (CRM 12345) confirmando incapacidade total desde 15/01/2024. CID M51.1. Inclua este documento como nova prova e reforce o pedido de tutela de urgência."
                  rows={3}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 focus:border-amber-500 focus:outline-none resize-none"
                />
                <button
                  onClick={modificarComIA}
                  disabled={modificando || !instrucaoModif.trim()}
                  className="flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-4 font-body text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {modificando ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Dr. Lex incorporando...
                    </>
                  ) : (
                    "⚡ Incorporar modificação"
                  )}
                </button>
              </div>

              {/* Editor de texto */}
              <div>
                <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Texto da petição — editável
                </label>
                <textarea
                  value={textoEditor}
                  onChange={(e) => setTextoEditor(e.target.value)}
                  rows={20}
                  className="w-full rounded-lg border border-border px-4 py-3 font-mono text-sm text-fg focus:border-primary focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={salvarEdicao}
                    disabled={salvandoEdicao}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {salvoOk
                      ? "✓ Salvo!"
                      : salvandoEdicao
                        ? "Salvando..."
                        : "💾 Salvar alterações"}
                  </button>

                  <button
                    onClick={baixarPdf}
                    disabled={baixandoPdf || !textoEditor.trim()}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-4 font-body text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {baixandoPdf ? "Gerando..." : "📄 Baixar PDF"}
                  </button>

                  <button
                    onClick={() => navigator.clipboard.writeText(textoEditor)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg hover:border-primary hover:text-primary transition-colors"
                  >
                    📋 Copiar
                  </button>

                  {!editando.aprovada && (
                    <button
                      onClick={() => aprovar(editando.id)}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 font-body text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      ✅ Aprovar petição
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setConfirmExcluir(editando.id)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 font-body text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  🗑 Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm excluir */}
      {confirmExcluir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h3 className="font-heading text-base font-semibold text-fg">
              Excluir petição?
            </h3>
            <p className="font-body text-sm text-muted">
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => excluir(confirmExcluir)}
                className="flex-1 rounded-lg bg-red-600 py-2 font-body text-sm font-semibold text-white hover:bg-red-700"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmExcluir(null)}
                className="flex-1 rounded-lg border border-border py-2 font-body text-sm font-semibold text-fg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de petições */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-heading text-sm font-semibold text-fg flex items-center gap-2">
              📁 Petições Salvas
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-body text-xs font-semibold text-primary">
                {peticoes.length}
              </span>
            </h3>
            <p className="font-body text-xs text-muted mt-0.5">
              Clique em uma petição para editar, modificar com IA ou baixar o
              PDF
            </p>
          </div>
          <button
            onClick={carregar}
            className="font-body text-xs text-muted hover:text-primary"
          >
            🔄
          </button>
        </div>

        <div className="divide-y divide-border">
          {peticoes.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              {/* Ícone de status */}
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-xl">{p.aprovada ? "✅" : "📝"}</span>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-fg truncate">
                      {p.titulo}
                    </p>
                    <p className="font-body text-xs text-muted mt-0.5">
                      {p.tipo_peticao} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {p.aprovada && (
                        <span className="ml-2 text-emerald-600 font-semibold">
                          · Aprovada
                        </span>
                      )}
                    </p>
                    {p.resumo && (
                      <p className="font-body text-xs text-muted mt-1.5 line-clamp-2">
                        {p.resumo}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex-shrink-0 flex flex-col gap-1.5">
                <button
                  onClick={() => abrirEditor(p)}
                  className="flex h-7 items-center gap-1 rounded-lg bg-primary px-3 font-body text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={async () => {
                    const r = await fetch(`/api/ia/banco/${p.id}`);
                    const data = await r.json();
                    if (!data.texto) return;
                    setBaixandoPdf(true);
                    const res = await fetch("/api/ia/pdf", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        texto: data.texto,
                        tipoPeticao: p.tipo_peticao,
                        titulo: p.titulo,
                      }),
                    });
                    if (res.ok) {
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${p.titulo
                        .replace(/[^a-zA-Z0-9\s]/g, "")
                        .trim()
                        .replace(/\s+/g, "_")
                        .slice(0, 80)}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                    setBaixandoPdf(false);
                  }}
                  disabled={baixandoPdf}
                  className="flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 font-body text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  📄 PDF
                </button>
                <button
                  onClick={() => setConfirmExcluir(p.id)}
                  className="flex h-7 items-center gap-1 rounded-lg border border-border px-3 font-body text-xs text-muted hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
