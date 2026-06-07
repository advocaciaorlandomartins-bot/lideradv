"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface PageImage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Estilos compartilhados ────────────────────────────────────────────────────

const iconBoxStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background:
    "linear-gradient(to bottom right,#faf5ff,#fff,rgba(243,232,255,0.7))",
  border: "1px solid rgba(192,132,252,0.35)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6),0 1px 3px rgba(0,0,0,0.08)",
};

// ── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      const f = list?.[0];
      if (f && f.type === "application/pdf") onFile(f);
    },
    [onFile]
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
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files)}
      />
      {file ? (
        <div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#2d2d2d",
              margin: "0 0 4px",
            }}
          >
            {file.name}
          </p>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
            {fmtBytes(file.size)} · clique para trocar
          </p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#2d2d2d",
              margin: "0 0 6px",
            }}
          >
            Arraste o PDF aqui
          </p>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
            ou clique para selecionar · .pdf
          </p>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PdfParaImagensPage() {
  const [file, setFile] = useState<File | null>(null);
  const [formato, setFormato] = useState<"jpeg" | "png">("jpeg");
  const [dpi, setDpi] = useState(150);
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [paginas, setPaginas] = useState<PageImage[]>([]);
  const [erro, setErro] = useState("");

  async function handleConverter() {
    if (!file) return;
    setErro("");
    setPaginas([]);
    setLoading(true);

    try {
      // Carrega pdfjs-dist dinamicamente
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      setProgresso({ atual: 0, total: numPages });

      const scale = dpi / 96;
      const results: PageImage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;

        // Fundo branco para JPEG (PNG suporta transparência)
        if (formato === "jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: ctx, canvas, viewport }).promise;

        const mimeType = formato === "png" ? "image/png" : "image/jpeg";
        const quality = formato === "jpeg" ? 0.92 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        results.push({
          pageNum: i,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
        });
        setProgresso({ atual: i, total: numPages });
        setPaginas([...results]);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPagina(p: PageImage) {
    const ext = formato === "png" ? "png" : "jpg";
    const baseName = file?.name.replace(/\.pdf$/i, "") ?? "pagina";
    const blob = dataUrlToBlob(p.dataUrl);
    downloadBlob(blob, `${baseName}_pagina${p.pageNum}.${ext}`);
  }

  async function downloadTodas() {
    const { default: JSZip } = await import("jszip").catch(() => ({
      default: null,
    }));
    const ext = formato === "png" ? "png" : "jpg";
    const baseName = file?.name.replace(/\.pdf$/i, "") ?? "paginas";

    if (JSZip) {
      const zip = new JSZip();
      for (const p of paginas) {
        const blob = dataUrlToBlob(p.dataUrl);
        zip.file(`${baseName}_pagina${p.pageNum}.${ext}`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${baseName}_imagens.zip`);
    } else {
      // Fallback: baixa uma a uma
      for (const p of paginas) downloadPagina(p);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
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
        <span style={{ color: "#2d2d2d" }}>Converter PDF em imagens</span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={iconBoxStyle}>
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
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <circle cx="10" cy="14" r="2" />
              <path d="m20 17-1.296-1.296a2 2 0 0 0-2.828 0L10 22" />
            </svg>
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
              Converter PDF em imagens
            </h1>
            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
              Converta cada página do PDF em JPG ou PNG — processado direto no
              seu navegador
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
          marginBottom: 32,
        }}
      >
        <DropZone file={file} onFile={setFile} />

        {/* Opções */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 6,
              }}
            >
              Formato de saída
            </label>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value as "jpeg" | "png")}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 10,
                border: "1px solid #e8e4df",
                padding: "0 12px",
                fontSize: 14,
                color: "#2d2d2d",
                background: "white",
                cursor: "pointer",
              }}
            >
              <option value="jpeg">JPG (menor tamanho)</option>
              <option value="png">PNG (maior qualidade)</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 6,
              }}
            >
              Resolução (DPI)
            </label>
            <select
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 10,
                border: "1px solid #e8e4df",
                padding: "0 12px",
                fontSize: 14,
                color: "#2d2d2d",
                background: "white",
                cursor: "pointer",
              }}
            >
              <option value={72}>72 DPI (tela / web)</option>
              <option value={150}>150 DPI (padrão)</option>
              <option value={300}>300 DPI (impressão)</option>
            </select>
          </div>
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

        {/* Progresso */}
        {loading && progresso.total > 0 && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: 14,
                color: "#9333ea",
                fontWeight: 600,
                margin: "0 0 8px",
              }}
            >
              Convertendo página {progresso.atual} de {progresso.total}…
            </p>
            <div
              style={{
                height: 6,
                borderRadius: 99,
                background: "#f3e8ff",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: "#9333ea",
                  width: `${(progresso.atual / progresso.total) * 100}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Botão converter */}
        <button
          onClick={handleConverter}
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
          {loading
            ? `⏳ Convertendo… (${progresso.atual}/${progresso.total})`
            : "Converter"}
        </button>
      </div>

      {/* Resultado: galeria de páginas */}
      {paginas.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#2d2d2d",
                margin: 0,
              }}
            >
              {paginas.length} página{paginas.length !== 1 ? "s" : ""}{" "}
              convertida{paginas.length !== 1 ? "s" : ""}
            </h2>
            {paginas.length > 1 && (
              <button
                onClick={downloadTodas}
                style={{
                  background: "#9333ea",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ⬇️ Baixar todas (ZIP)
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {paginas.map((p) => (
              <div
                key={p.pageNum}
                style={{
                  background: "white",
                  border: "1px solid rgba(232,228,223,0.8)",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                {/* Preview */}
                <div style={{ background: "#f8f8f8", padding: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={`Página ${p.pageNum}`}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      borderRadius: 6,
                    }}
                  />
                </div>
                {/* Footer */}
                <div
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{ fontSize: 12, color: "#666", fontWeight: 500 }}
                  >
                    Página {p.pageNum}
                    <span
                      style={{ display: "block", fontSize: 11, color: "#999" }}
                    >
                      {Math.round(p.width)}×{Math.round(p.height)}px
                    </span>
                  </span>
                  <button
                    onClick={() => downloadPagina(p)}
                    style={{
                      background: "rgba(147,51,234,0.08)",
                      color: "#7c3aed",
                      border: "1px solid rgba(147,51,234,0.2)",
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ⬇️ Baixar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
