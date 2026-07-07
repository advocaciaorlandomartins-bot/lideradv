"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocumentoAction } from "@/lib/document-actions";
import type { Documento } from "@/lib/documents-db";
import { PlusIcon, SpinnerIcon } from "@/components/icons";

const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ── Helpers ────────────────────────────────────────────────

function fileColor(tipo: string | null) {
  if (!tipo) return "bg-slate-100 text-slate-500";
  if (tipo.includes("pdf")) return "bg-red-50 text-red-500";
  if (tipo.includes("word") || tipo.includes("document"))
    return "bg-blue-50 text-blue-500";
  if (
    tipo.includes("sheet") ||
    tipo.includes("excel") ||
    tipo.includes("spreadsheet")
  )
    return "bg-emerald-50 text-emerald-500";
  if (tipo.startsWith("image/")) return "bg-violet-50 text-violet-500";
  return "bg-slate-100 text-slate-500";
}

function fileLabel(tipo: string | null) {
  if (!tipo) return "ARQ";
  if (tipo.includes("pdf")) return "PDF";
  if (tipo.includes("word") || tipo.includes("document")) return "DOC";
  if (
    tipo.includes("sheet") ||
    tipo.includes("excel") ||
    tipo.includes("spreadsheet")
  )
    return "XLS";
  if (tipo.startsWith("image/")) return "IMG";
  const ext = tipo.split("/")[1]?.toUpperCase().slice(0, 4);
  return ext ?? "ARQ";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ──────────────────────────────────────────────

interface Props {
  entityType: "processo" | "cliente" | "pericia";
  entityId: string;
  documents: Documento[];
}

export default function DocumentsSection({
  entityType,
  entityId,
  documents,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setUploadError(
          `"${file.name}" é muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_FILE_MB} MB.`
        );
        continue;
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", entityType);
      fd.append("entityId", entityId);

      try {
        const res = await fetch("/api/documentos/upload", {
          method: "POST",
          body: fd,
        });
        const data: { id?: string; url?: string; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (!res.ok || data.error) {
          setUploadError(
            `Erro ao enviar "${file.name}": ${data.error ?? `HTTP ${res.status}`}`
          );
        }
      } catch {
        setUploadError(
          `Erro ao enviar "${file.name}": sem conexão com o servidor.`
        );
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function handleDelete(doc: Documento) {
    if (!confirm(`Excluir "${doc.nome}"?\nEsta ação não pode ser desfeita.`))
      return;
    setDeletingId(doc.id);

    startTransition(async () => {
      await deleteDocumentoAction(doc.id, doc.url);
      setDeletingId(null);
      router.refresh();
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const totalBytes = documents.reduce((s, d) => s + (d.tamanho ?? 0), 0);
  const totalMB = totalBytes / (1024 * 1024);
  const totalLabel =
    totalBytes === 0
      ? "0 B"
      : totalBytes < 1024 * 1024
        ? `${(totalBytes / 1024).toFixed(0)} KB`
        : `${totalMB.toFixed(1)} MB`;

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-base font-semibold text-fg">
            Documentos ({documents.length})
          </h2>
          {documents.length > 0 && (
            <p className="mt-0.5 font-body text-xs text-muted">
              {totalLabel} usados · limite por arquivo: {MAX_FILE_MB} MB
            </p>
          )}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg bg-cta px-3 py-2 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {uploading ? (
            <>
              <SpinnerIcon className="h-3.5 w-3.5" />
              Enviando…
            </>
          ) : (
            <>
              <PlusIcon className="h-3.5 w-3.5" />
              Adicionar
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Error */}
      {uploadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {uploadError}
        </div>
      )}

      {/* Empty state / drop zone */}
      {documents.length === 0 && !uploading ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 text-center transition-colors duration-150 ${
            isDragging
              ? "border-primary bg-blue-50"
              : "border-border hover:border-primary hover:bg-slate-50"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <PlusIcon className="h-5 w-5 text-muted" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-muted">
              {isDragging ? "Solte para enviar" : "Nenhum documento anexado"}
            </p>
            <p className="mt-0.5 font-body text-xs text-slate-400">
              Clique ou arraste arquivos aqui
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-lg transition-colors duration-150 ${
            isDragging
              ? "outline outline-2 outline-dashed outline-primary bg-blue-50"
              : ""
          }`}
        >
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
              >
                {/* File type badge */}
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-body text-[11px] font-bold ${fileColor(doc.tipo)}`}
                >
                  {fileLabel(doc.tipo)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm font-semibold text-fg">
                    {doc.nome}
                  </p>
                  <p className="font-body text-xs text-muted">
                    {doc.tamanho ? formatBytes(doc.tamanho) : "—"} ·{" "}
                    {doc.created_at_formatted}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center gap-3">
                  <a
                    href={`/api/documentos/download?id=${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-xs font-semibold text-primary transition-colors duration-150 hover:text-primary-dark"
                  >
                    Abrir
                  </a>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="font-body text-xs font-semibold text-red-500 transition-colors duration-150 hover:text-red-700 disabled:opacity-40 cursor-pointer"
                  >
                    {deletingId === doc.id ? "Excluindo…" : "Excluir"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {isDragging && (
            <p className="pt-3 pb-1 text-center font-body text-xs font-semibold text-primary">
              Solte para adicionar
            </p>
          )}
        </div>
      )}
    </div>
  );
}
