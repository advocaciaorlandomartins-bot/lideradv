"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

// Re-encode JPEG in the browser using Canvas API (no jpeg-js needed)
async function recompressJpeg(
  data: Uint8Array,
  quality: number
): Promise<Uint8Array | null> {
  try {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    return await new Promise<Uint8Array | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (resultBlob) => {
            URL.revokeObjectURL(url);
            if (!resultBlob) {
              resolve(null);
              return;
            }
            resultBlob
              .arrayBuffer()
              .then((buf) => resolve(new Uint8Array(buf)));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

async function comprimirPdf(
  file: File
): Promise<{ bytes: Uint8Array; reducao: number; imagens: number }> {
  // Dynamically import pdf-lib to keep the initial bundle small
  const { PDFDocument, PDFRawStream, PDFName, PDFNumber } =
    await import("pdf-lib");

  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const context = doc.context;

  let imagens = 0;
  const QUALITY = 0.75; // 75% JPEG quality

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;

    const subtype = dict.get(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Image") continue;

    const filterRaw = dict.get(PDFName.of("Filter"));
    if (filterRaw?.toString() !== "/DCTDecode") continue;

    const originalData = obj.asUint8Array();
    const compressed = await recompressJpeg(originalData, QUALITY);
    if (compressed && compressed.length < originalData.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any).contents = compressed;
      dict.set(PDFName.of("Length"), PDFNumber.of(compressed.length));
      imagens++;
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  const original = buf.byteLength;
  const resultado = bytes.byteLength;

  const finalBytes =
    resultado < original ? new Uint8Array(bytes) : new Uint8Array(buf);
  const finalSize = Math.min(resultado, original);
  const reducao = Math.max(0, Math.round((1 - finalSize / original) * 100));

  return { bytes: finalBytes, reducao, imagens };
}

function Icone() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9333ea"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </svg>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(232,228,223,0.8)",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

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

export default function ComprimirPage() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{
    url: string;
    reducao: number;
    imagens: number;
    originalSize: number;
    finalSize: number;
  } | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setErro("Selecione um arquivo PDF.");
      return;
    }
    setFile(f);
    setErro("");
    setResultado(null);
  }, []);

  async function handleProcessar() {
    if (!file) return;
    setErro("");
    setResultado(null);
    setLoading(true);
    setProgress("Carregando PDF...");

    try {
      setProgress("Analisando imagens...");
      const { bytes, reducao, imagens } = await comprimirPdf(file);

      setProgress("Gerando download...");
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      setResultado({
        url,
        reducao,
        imagens,
        originalSize: file.size,
        finalSize: bytes.length,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar o PDF.");
    } finally {
      setLoading(false);
      setProgress("");
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
        <span style={{ color: "#2d2d2d" }}>Comprimir PDFs</span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={iconBoxStyle}>
            <Icone />
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
              Comprimir PDFs
            </h1>
            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
              Compressão local no navegador — sem limite de tamanho, sem upload
            </p>
          </div>
        </div>
      </header>

      <div style={cardStyle}>
        {/* Drop zone */}
        <div
          onClick={() =>
            (document.getElementById("pdf-input") as HTMLInputElement)?.click()
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(e.dataTransfer.files);
          }}
          style={{
            border: `2px dashed ${drag ? "#9333ea" : "rgba(192,132,252,0.4)"}`,
            borderRadius: 16,
            background: drag
              ? "rgba(243,232,255,0.25)"
              : "rgba(255,255,255,0.6)",
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <input
            id="pdf-input"
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          {!file ? (
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
                Arraste o arquivo aqui
              </p>
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                ou clique para selecionar · .pdf · qualquer tamanho
              </p>
            </>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>📄</span>
                <span
                  style={{ fontSize: 14, fontWeight: 600, color: "#2d2d2d" }}
                >
                  {file.name}
                </span>
                <span style={{ fontSize: 12, color: "#666" }}>
                  ({fmtBytes(file.size)})
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "#9333ea",
                  margin: "8px 0 0",
                  fontWeight: 500,
                }}
              >
                Clique para trocar o arquivo
              </p>
            </div>
          )}
        </div>

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

        {/* Progress */}
        {loading && progress && (
          <div
            style={{
              borderRadius: 10,
              background: "#faf5ff",
              border: "1px solid rgba(192,132,252,0.4)",
              padding: "10px 14px",
              fontSize: 13,
              color: "#7c3aed",
            }}
          >
            ⏳ {progress}
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
              ✅ Compressão concluída!
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#166534" }}>
              {resultado.reducao > 2 ? (
                <>
                  {fmtBytes(resultado.originalSize)} →{" "}
                  {fmtBytes(resultado.finalSize)} ({resultado.reducao}% menor) ·{" "}
                  {resultado.imagens} imagem
                  {resultado.imagens !== 1 ? "s" : ""} recomprimida
                  {resultado.imagens !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  PDF já otimizado — redução mínima ({resultado.reducao}%). O
                  arquivo retornado é o original.
                </>
              )}
            </p>
            <a
              href={resultado.url}
              download={`comprimido-${file?.name ?? "resultado.pdf"}`}
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
              ⬇️ Baixar PDF comprimido
            </a>
          </div>
        )}

        {/* Botão */}
        <button
          onClick={handleProcessar}
          disabled={loading || !file}
          style={{
            background: loading ? "rgba(147,51,234,0.6)" : "#9333ea",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "13px 24px",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !file ? "not-allowed" : "pointer",
            opacity: !file ? 0.5 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {loading ? `⏳ ${progress || "Processando…"}` : "Processar"}
        </button>
      </div>
    </div>
  );
}
