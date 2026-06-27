"use client";

import { useState, useRef } from "react";

interface Props {
  clienteId?: string;
  processoId?: string;
  onClose: () => void;
}

const TIPOS: { value: string; label: string; desc: string }[] = [
  {
    value: "completa",
    label: "Análise completa",
    desc: "Resumo, linha do tempo, pontos de atenção e próximas ações",
  },
  {
    value: "resumo",
    label: "Resumo rápido",
    desc: "Síntese objetiva em 5 parágrafos",
  },
  {
    value: "riscos",
    label: "Análise de riscos",
    desc: "Foco em cláusulas problemáticas, prazos críticos e irregularidades",
  },
];

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export default function IaAnalisarModal({
  clienteId,
  processoId,
  onClose,
}: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipoAnalise, setTipoAnalise] = useState("completa");
  const [resultado, setResultado] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const analisar = async () => {
    if (!arquivo) return;
    setCarregando(true);
    setErro("");
    setResultado("");

    const form = new FormData();
    form.append("arquivo", arquivo);
    form.append("tipoAnalise", tipoAnalise);
    if (clienteId) form.append("clienteId", clienteId);
    if (processoId) form.append("processoId", processoId);

    try {
      const res = await fetch("/api/ia/analisar", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao analisar.");
      } else {
        setResultado(data.resultado);
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  };

  const dropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setArquivo(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-fg">
              🔍 Analisar Documento com IA
            </h2>
            <p className="font-body text-sm text-muted">
              PDF ou imagem — análise jurídica completa pelo Dr. Lex
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropHandler}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-slate-50"
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo ? (
              <div>
                <p className="font-body text-sm font-semibold text-fg">
                  {arquivo.name}
                </p>
                <p className="font-body text-xs text-muted mt-1">
                  {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setArquivo(null);
                    setResultado("");
                  }}
                  className="mt-2 font-body text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                <p className="text-3xl mb-2">📄</p>
                <p className="font-body text-sm text-fg font-semibold">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="font-body text-xs text-muted mt-1">
                  PDF, JPG, PNG, WebP — até 8MB
                </p>
              </>
            )}
          </div>

          {/* Tipo de análise */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Tipo de análise
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTipoAnalise(t.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    tipoAnalise === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-slate-300"
                  }`}
                >
                  <p
                    className={`font-body text-sm font-semibold ${
                      tipoAnalise === t.value ? "text-primary" : "text-fg"
                    }`}
                  >
                    {t.label}
                  </p>
                  <p className="font-body text-xs text-muted mt-0.5">
                    {t.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <p className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700">
              {erro}
            </p>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="rounded-xl border border-border bg-slate-50 p-5 max-h-96 overflow-y-auto">
              <div
                className="font-body text-sm text-fg leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: resultado
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(
                      /^#{1,3}\s(.+)/gm,
                      '<p class="font-semibold text-base mt-4 mb-1">$1</p>'
                    )
                    .replace(/^- (.+)/gm, '<li class="ml-4">• $1</li>')
                    .replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={analisar}
              disabled={!arquivo || carregando}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-body text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {carregando ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Analisando...
                </>
              ) : resultado ? (
                "🔄 Reanalisar"
              ) : (
                "🔍 Analisar documento"
              )}
            </button>
            {resultado && (
              <button
                onClick={() => navigator.clipboard.writeText(resultado)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 font-body text-sm font-semibold text-fg hover:border-primary hover:text-primary transition-colors"
              >
                📋 Copiar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
