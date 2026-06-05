"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfToolPageProps {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  multiplos?: boolean;
  accept?: string;
  extraFields?: React.ReactNode;
  endpoint: string;
  buildFormData: (files: File[], extra: Record<string, string>) => FormData;
  badge?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const iconBoxStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background:
    "linear-gradient(to bottom right, #faf5ff, #fff, rgba(243,232,255,0.7))",
  border: "1px solid rgba(192,132,252,0.35)",
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.08)",
};

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  files,
  onFiles,
  multiplos,
  accept,
}: {
  files: File[];
  onFiles: (f: File[]) => void;
  multiplos: boolean;
  accept: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const arr = Array.from(incoming);
      onFiles(multiplos ? arr : [arr[0]]);
    },
    [multiplos, onFiles]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files);
      }}
      style={{
        border: `2px dashed ${drag ? "#9333ea" : "rgba(192,132,252,0.4)"}`,
        borderRadius: 16,
        background: drag ? "rgba(243,232,255,0.25)" : "rgba(255,255,255,0.6)",
        padding: "40px 24px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiplos}
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files)}
      />

      {files.length === 0 ? (
        <>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#2d2d2d",
              margin: "0 0 6px",
            }}
          >
            Arraste {multiplos ? "os arquivos" : "o arquivo"} aqui
          </p>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
            ou clique para selecionar · {accept.replace(/,/g, ", ")}
          </p>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📄</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#2d2d2d" }}>
                {f.name}
              </span>
              <span style={{ fontSize: 12, color: "#666" }}>
                ({fmtBytes(f.size)})
              </span>
            </div>
          ))}
          <p
            style={{
              fontSize: 12,
              color: "#9333ea",
              margin: "8px 0 0",
              fontWeight: 500,
            }}
          >
            Clique para trocar {multiplos ? "os arquivos" : "o arquivo"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PdfToolPage({
  titulo,
  descricao,
  icone,
  badge,
  multiplos = false,
  accept = ".pdf",
  extraFields,
  endpoint,
  buildFormData,
}: PdfToolPageProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{
    url: string;
    nome: string;
    info?: string;
  } | null>(null);

  const extrasRef = useRef<HTMLDivElement>(null);

  function getExtras(): Record<string, string> {
    if (!extrasRef.current) return {};
    const out: Record<string, string> = {};
    extrasRef.current
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")
      .forEach((el) => {
        if (el.name) out[el.name] = el.value;
      });
    return out;
  }

  async function handleProcessar() {
    if (!files.length) {
      setErro("Selecione pelo menos um arquivo.");
      return;
    }
    setErro("");
    setResultado(null);
    setLoading(true);

    try {
      const fd = buildFormData(files, getExtras());
      const res = await fetch(endpoint, { method: "POST", body: fd });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao processar.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const nome = match?.[1] ?? "resultado.pdf";

      const origSize = res.headers.get("X-Original-Size");
      const resSize = res.headers.get("X-Result-Size");
      const reducao = res.headers.get("X-Reducao-Pct");
      let info = "";
      if (origSize && resSize) {
        info = `${fmtBytes(Number(origSize))} → ${fmtBytes(Number(resSize))}${reducao ? ` (${reducao}% menor)` : ""}`;
      }

      setResultado({ url, nome, info });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        <Link
          href="/dashboard"
          style={{ color: "#666", textDecoration: "none" }}
        >
          Início
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link
          href="/dashboard/ferramentas-pdf"
          style={{ color: "#666", textDecoration: "none" }}
        >
          Ferramentas de PDFs
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "#2d2d2d" }}>{titulo}</span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...iconBoxStyle, position: "relative" }}>
            {icone}
            {badge && (
              <span
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  background: "linear-gradient(to bottom right,#faf5ff,#fff)",
                  border: "1px solid rgba(192,132,252,0.35)",
                  borderRadius: 9999,
                  padding: "1px 5px",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#7c3aed",
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#2d2d2d",
                margin: "0 0 4px",
              }}
            >
              {titulo}
            </h1>
            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
              {descricao}
            </p>
          </div>
        </div>
      </header>

      {/* Card principal */}
      <div
        style={{
          background: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(232,228,223,0.8)",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <DropZone
          files={files}
          onFiles={setFiles}
          multiplos={multiplos}
          accept={accept}
        />

        {/* Campos extras (senha, páginas, etc.) */}
        {extraFields && <div ref={extrasRef}>{extraFields}</div>}

        {/* Erro */}
        {erro && (
          <div
            style={{
              borderRadius: 10,
              background: "#fff1f0",
              border: "1px solid #ffd6d6",
              padding: "10px 14px",
              fontSize: 13,
              color: "#c0392b",
            }}
          >
            ⚠️ {erro}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div
            style={{
              borderRadius: 10,
              background: "#f0fff4",
              border: "1px solid #b7f0cc",
              padding: "14px 18px",
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 14,
                fontWeight: 600,
                color: "#166534",
              }}
            >
              ✅ Pronto!
            </p>
            {resultado.info && (
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#166534" }}>
                {resultado.info}
              </p>
            )}
            <a
              href={resultado.url}
              download={resultado.nome}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#166534",
                color: "white",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ⬇️ Baixar {resultado.nome}
            </a>
          </div>
        )}

        {/* Botão processar */}
        <button
          onClick={handleProcessar}
          disabled={loading || !files.length}
          style={{
            background: loading ? "rgba(147,51,234,0.6)" : "#9333ea",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "13px 24px",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !files.length ? "not-allowed" : "pointer",
            opacity: !files.length ? 0.5 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {loading ? "⏳ Processando…" : "Processar"}
        </button>
      </div>
    </div>
  );
}
