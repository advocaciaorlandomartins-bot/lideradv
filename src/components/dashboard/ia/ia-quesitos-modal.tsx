"use client";

import { useState, useEffect } from "react";

interface DocExistente {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  created_at_formatted: string;
}

interface Props {
  clienteId?: string;
  processoId: string;
  onClose: () => void;
}

interface Resultado {
  quesitos: string[];
  briefingAdvogado: string;
  resumoCliente: string;
}

const MIME_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_DOCS = 6;

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IaQuesitosModal({
  clienteId,
  processoId,
  onClose,
}: Props) {
  const [docs, setDocs] = useState<DocExistente[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(true);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const urls = [
          `/api/documentos?entityType=processo&entityId=${processoId}`,
        ];
        if (clienteId)
          urls.push(`/api/documentos?entityType=cliente&entityId=${clienteId}`);
        const respostas = await Promise.all(urls.map((u) => fetch(u)));
        const listas = await Promise.all(respostas.map((r) => r.json()));
        const todos: DocExistente[] = listas.flatMap((l) =>
          Array.isArray(l) ? l : []
        );
        const vistos = new Set<string>();
        const unicos = todos.filter((d) => {
          if (vistos.has(d.id)) return false;
          vistos.add(d.id);
          return true;
        });
        setDocs(unicos.filter((d) => MIME_SUPORTADOS.has(d.tipo ?? "")));
      } catch {
        setErro("Erro ao carregar documentos.");
      } finally {
        setCarregandoDocs(false);
      }
    })();
  }, [processoId, clienteId]);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_DOCS) next.add(id);
      return next;
    });
  }

  async function gerar() {
    if (selecionados.size === 0) return;
    setCarregando(true);
    setErro("");
    setResultado(null);
    try {
      const res = await fetch("/api/ia/quesitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processoId,
          documentoIds: Array.from(selecionados),
        }),
      });
      const data = await res.json();
      if (!res.ok) setErro(data.error ?? "Erro ao gerar os quesitos.");
      else setResultado(data);
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  function copiar(texto: string, chave: string) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-heading text-base font-bold text-fg">
              🩺 Quesitos Médicos
            </h2>
            <p className="font-body text-xs text-muted">
              Selecione petição inicial, laudo do INSS e exames — a IA gera
              quesitos complementares, um briefing pra você e um resumo pro
              cliente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!resultado && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Documentos ({docs.length})
                  </p>
                  {selecionados.size > 0 && (
                    <p className="font-body text-xs text-primary">
                      {selecionados.size} de {MAX_DOCS} selecionado(s)
                    </p>
                  )}
                </div>

                {carregandoDocs ? (
                  <p className="font-body text-sm text-muted">Carregando…</p>
                ) : docs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-center font-body text-sm text-muted">
                    Nenhum documento PDF/imagem anexado ainda — envie a petição,
                    o laudo do INSS ou exames na aba Documentos antes de gerar
                    os quesitos.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                    {docs.map((d) => (
                      <label
                        key={d.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50 ${
                          selecionados.has(d.id) ? "bg-primary/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(d.id)}
                          onChange={() => toggle(d.id)}
                          disabled={
                            !selecionados.has(d.id) &&
                            selecionados.size >= MAX_DOCS
                          }
                          className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body text-sm text-fg">
                            {d.nome}
                          </p>
                          <p className="font-body text-[11px] text-muted">
                            {d.tamanho ? formatBytes(d.tamanho) : "—"} ·{" "}
                            {d.created_at_formatted}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {erro && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-body text-sm text-red-700">
                  {erro}
                </p>
              )}
            </>
          )}

          {resultado && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-body text-xs font-bold uppercase tracking-wide text-teal-700">
                    Quesitos complementares ({resultado.quesitos.length})
                  </h3>
                  <button
                    onClick={() =>
                      copiar(
                        resultado.quesitos
                          .map((q, i) => `${i + 1}. ${q}`)
                          .join("\n"),
                        "quesitos"
                      )
                    }
                    className="font-body text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    {copiado === "quesitos" ? "Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <ol className="space-y-1.5">
                  {resultado.quesitos.map((q, i) => (
                    <li
                      key={i}
                      className="flex gap-2 font-body text-sm text-teal-900"
                    >
                      <span className="flex-shrink-0 font-semibold">
                        {i + 1}.
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-body text-xs font-bold uppercase tracking-wide text-blue-700">
                    Briefing pro advogado
                  </h3>
                  <button
                    onClick={() =>
                      copiar(resultado.briefingAdvogado, "briefing")
                    }
                    className="font-body text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    {copiado === "briefing" ? "Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <p className="whitespace-pre-line font-body text-sm text-blue-900 leading-relaxed">
                  {resultado.briefingAdvogado}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-body text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Resumo pro cliente
                  </h3>
                  <button
                    onClick={() => copiar(resultado.resumoCliente, "resumo")}
                    className="font-body text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    {copiado === "resumo" ? "Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <p className="whitespace-pre-line font-body text-sm text-emerald-900 leading-relaxed">
                  {resultado.resumoCliente}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted hover:border-slate-300 hover:text-fg"
          >
            Fechar
          </button>
          <button
            onClick={gerar}
            disabled={carregando || selecionados.size === 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Gerando…
              </>
            ) : resultado ? (
              "🔄 Gerar de novo"
            ) : (
              "🩺 Gerar quesitos"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
