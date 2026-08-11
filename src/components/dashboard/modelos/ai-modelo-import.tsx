"use client";

import { useState, useRef, useCallback } from "react";
import {
  DocumentArrowUpIcon,
  SpinnerIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  UploadIcon,
  SparklesIcon,
} from "@/components/icons";
import type { Block } from "@/lib/modelo-blocks";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_SIZE_MB = 10;

export interface AiModeloResult {
  titulo: string;
  categoria: string | null;
  blocks: Block[];
}

interface Props {
  onGenerated: (result: AiModeloResult) => void;
  onClose: () => void;
}

export default function AiModeloImport({ onGenerated, onClose }: Props) {
  const [mode, setMode] = useState<"file" | "texto">("file");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(f: File): string | null {
    const normalized = f.type === "image/jpg" ? "image/jpeg" : f.type;
    if (!ACCEPTED_TYPES.includes(normalized)) {
      return `Formato não suportado: ${f.type || "desconhecido"}. Use PDF, JPEG, PNG, WebP ou GIF — ou cole o texto.`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    if (!file && !texto.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("texto", texto.trim());

      const res = await fetch("/api/modelos/gerar-com-ia", {
        method: "POST",
        body: fd,
      });
      const result: { data?: AiModeloResult; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || result.error || !result.data) {
        setError(result.error ?? `Erro ao gerar modelo (HTTP ${res.status}).`);
        return;
      }
      onGenerated(result.data);
    } catch {
      setError("Erro inesperado ao gerar modelo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        className="flex w-full max-w-xl flex-col rounded-2xl border border-border bg-white shadow-xl"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold text-fg">
              Gerar modelo com IA
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg disabled:opacity-40 cursor-pointer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <p className="font-body text-sm text-muted">
            Envie um documento de exemplo (PDF ou imagem) ou cole o texto — a IA
            identifica os dados do cliente e monta o modelo já com as variáveis
            e a formatação.
          </p>

          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`rounded-md py-1.5 font-body text-xs font-semibold transition-colors cursor-pointer ${
                mode === "file"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              Enviar arquivo
            </button>
            <button
              type="button"
              onClick={() => setMode("texto")}
              className={`rounded-md py-1.5 font-body text-xs font-semibold transition-colors cursor-pointer ${
                mode === "texto"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              Colar texto
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
              <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === "file" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-border bg-slate-50 hover:border-primary/40 hover:bg-slate-100"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = "";
                }}
              />
              {file ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <DocumentArrowUpIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      {file.name}
                    </p>
                    <p className="mt-0.5 font-body text-xs text-muted">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 font-body text-xs font-semibold text-muted transition-colors hover:text-red-600"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <UploadIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      Arraste o documento aqui
                    </p>
                    <p className="mt-1 font-body text-xs text-muted">
                      ou clique para selecionar
                    </p>
                    <p className="mt-2 font-body text-xs text-slate-400">
                      PDF, JPEG, PNG, WebP · máx. {MAX_SIZE_MB} MB · Word ainda
                      não suportado, cole o texto
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={10}
              placeholder="Cole aqui o texto do documento de exemplo…"
              className="w-full resize-y rounded-lg border border-border bg-white p-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-slate-400 disabled:opacity-40 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || (!file && !texto.trim())}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            {loading ? "Gerando…" : "Gerar modelo"}
          </button>
        </div>
      </div>
    </div>
  );
}
