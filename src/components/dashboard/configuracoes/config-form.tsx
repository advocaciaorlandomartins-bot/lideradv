"use client";

import { useState, useRef, useActionState, useCallback } from "react";
import {
  saveEscritorioConfigAction,
  type ConfigFormState,
} from "@/lib/escritorio-actions";
import type { EscritorioConfig } from "@/lib/escritorio-db";
import { SpinnerIcon } from "@/components/icons";

// ── Constants ────────────────────────────────────────────────────

const A4_W = 794;
const A4_H = 1123;
const MM_TO_PX = A4_W / 210;
const PREVIEW_SCALE = 0.84;
const PREVIEW_W = Math.round(A4_W * PREVIEW_SCALE);
const PREVIEW_H = Math.round(A4_H * PREVIEW_SCALE * 0.52);

const CSS_FONTS: Record<string, string> = {
  Times: "'Times New Roman', Times, serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Courier: "'Courier New', Courier, monospace",
};

const SAMPLE_PARAS = [
  "Venho, por meio deste instrumento, apresentar ao cliente os termos acordados entre as partes, conforme documentação em anexo. O presente documento tem como objetivo formalizar a relação jurídica estabelecida, garantindo os direitos e obrigações de cada parte envolvida.",
  "Nos termos do artigo 421 do Código Civil Brasileiro, a liberdade contratual será exercida nos limites da função social do contrato. Assim, as partes acordam em respeitar todos os dispositivos legais aplicáveis ao caso em tela.",
  "Por fim, declaro que todas as informações prestadas neste documento são verídicas e estou ciente das responsabilidades legais decorrentes de eventual falsidade.",
];

const TEMPLATES = [
  {
    id: "classico",
    label: "Clássico",
    sub: "Logo à esquerda",
    preview: (
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, height: 44 }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 3,
            background: "#1E3A8A",
            flexShrink: 0,
          }}
        />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div style={{ height: 5, background: "#1E3A8A", borderRadius: 2 }} />
          <div
            style={{
              height: 3,
              background: "#94a3b8",
              borderRadius: 2,
              width: "80%",
            }}
          />
          <div
            style={{
              height: 3,
              background: "#94a3b8",
              borderRadius: 2,
              width: "55%",
            }}
          />
        </div>
      </div>
    ),
  },
  {
    id: "centralizado",
    label: "Centralizado",
    sub: "Logo e texto no centro",
    preview: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          height: 44,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: "#1E3A8A",
          }}
        />
        <div
          style={{
            height: 4,
            background: "#1E3A8A",
            borderRadius: 2,
            width: "65%",
          }}
        />
        <div
          style={{
            height: 3,
            background: "#94a3b8",
            borderRadius: 2,
            width: "45%",
          }}
        />
      </div>
    ),
  },
  {
    id: "executivo",
    label: "Executivo",
    sub: "Nome em destaque, logo à direita",
    preview: (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          height: 44,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingTop: 2,
          }}
        >
          <div style={{ height: 6, background: "#1E3A8A", borderRadius: 2 }} />
          <div
            style={{
              height: 3,
              background: "#94a3b8",
              borderRadius: 2,
              width: "70%",
            }}
          />
          <div
            style={{
              height: 3,
              background: "#cbd5e1",
              borderRadius: 2,
              width: "50%",
            }}
          />
        </div>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: "#1E3A8A",
            flexShrink: 0,
          }}
        />
      </div>
    ),
  },
  {
    id: "compacto",
    label: "Compacto",
    sub: "Faixa única com logo e dados",
    preview: (
      <div
        style={{ display: "flex", alignItems: "center", gap: 5, height: 44 }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 2,
            background: "#1E3A8A",
            flexShrink: 0,
          }}
        />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}
        >
          <div
            style={{
              height: 4,
              background: "#1E3A8A",
              borderRadius: 2,
              width: "55%",
            }}
          />
          <div
            style={{
              height: 3,
              background: "#94a3b8",
              borderRadius: 2,
              width: "35%",
            }}
          />
        </div>
        <div
          style={{
            height: 3,
            background: "#94a3b8",
            borderRadius: 2,
            width: "28%",
            flexShrink: 0,
          }}
        />
      </div>
    ),
  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────

function formatCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function formatCnpj(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const ESTADOS_BR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

// ── Component ────────────────────────────────────────────────────

interface Props {
  config: EscritorioConfig;
}

export default function ConfigForm({ config }: Props) {
  const [state, formAction, pending] = useActionState<
    ConfigFormState,
    FormData
  >(saveEscritorioConfigAction, null);

  // Logo
  const [logoUrl, setLogoUrl] = useState(config.logo_url ?? "");
  const [previewUrl, setPreviewUrl] = useState(config.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Letterhead model
  const [modeloTimbrado, setModeloTimbrado] = useState(
    config.modelo_timbrado ?? "classico"
  );

  // Background letterhead
  const [fundoData, setFundoData] = useState(config.fundo_timbrado ?? "");
  const [fundoUploading, setFundoUploading] = useState(false);
  const [fundoError, setFundoError] = useState<string | null>(null);
  const fundoFileRef = useRef<HTMLInputElement>(null);

  // Identification
  const [nome, setNome] = useState(config.nome);
  const [oab, setOab] = useState(config.oab ?? "");
  const [cnpj, setCnpj] = useState(config.cnpj ?? "");

  // Address
  const [cep, setCep] = useState(config.cep ?? "");
  const [logradouro, setLogradouro] = useState(config.endereco ?? "");
  const [numero, setNumero] = useState("");
  const [cidade, setCidade] = useState(config.cidade ?? "");
  const [estado, setEstado] = useState(config.estado ?? "");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const enderecoCompleto = [logradouro, numero].filter(Boolean).join(", ");

  // Typography & margins
  const [fontPadrao, setFontPadrao] = useState(config.font_padrao ?? "Times");
  const [tamanhoPadrao, setTamanhoPadrao] = useState(
    config.tamanho_padrao ?? 12
  );
  const [lineHeightVal, setLineHeightVal] = useState(config.line_height ?? 1.8);
  const [margens, setMargens] = useState({
    topo: config.margem_topo ?? 25,
    direita: config.margem_direita ?? 25,
    inferior: config.margem_inferior ?? 28,
    esquerda: config.margem_esquerda ?? 25,
  });

  function setMargem(key: keyof typeof margens) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setMargens((m) => ({ ...m, [key]: isNaN(val) ? 0 : val }));
    };
  }

  // CEP lookup
  const buscarCep = useCallback(async (digits: string) => {
    setBuscandoCep(true);
    setCepError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error("Falha");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      if (data.logradouro) setLogradouro(data.logradouro);
      if (data.localidade) setCidade(data.localidade);
      if (data.uf) setEstado(data.uf);
    } catch {
      setCepError("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setBuscandoCep(false);
    }
  }, []);

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setCepError(null);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) buscarCep(digits);
  }

  // Logo upload — converte para base64 data URI e salva diretamente no banco
  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Selecione um arquivo de imagem (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });
      setLogoUrl(dataUrl);
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error("logo read error:", err);
      setUploadError("Erro ao processar imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    setLogoUrl("");
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Background letterhead upload
  // SVG → converted to PNG in browser via canvas; PDF → stored as data URI
  async function handleFundoUpload(file: File) {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "application/pdf",
    ];
    if (!allowed.includes(file.type)) {
      setFundoError("Formatos aceitos: PDF, PNG, JPG ou SVG.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFundoError("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    setFundoUploading(true);
    setFundoError(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });

      if (file.type === "image/svg+xml") {
        // Convert SVG → PNG so pdf-lib can embed it
        const png = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = A4_W;
            canvas.height = A4_H;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas indisponível."));
              return;
            }
            ctx.drawImage(img, 0, 0, A4_W, A4_H);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => reject(new Error("SVG inválido."));
          img.src = raw;
        });
        setFundoData(png);
      } else {
        setFundoData(raw);
      }
    } catch (err) {
      console.error("fundo upload error:", err);
      setFundoError("Erro ao processar arquivo. Tente novamente.");
    } finally {
      setFundoUploading(false);
    }
  }

  function removeFundo() {
    setFundoData("");
    if (fundoFileRef.current) fundoFileRef.current.value = "";
  }

  // ── Preview computed values ────────────────────────────────────
  const cssFontFamily = CSS_FONTS[fontPadrao] ?? CSS_FONTS.Times;
  const fontPx = tamanhoPadrao * (96 / 72);

  function renderPreviewHeader() {
    const nameSt: React.CSSProperties = {
      fontFamily: cssFontFamily,
      fontWeight: "bold",
      fontSize: (tamanhoPadrao + 3) * (96 / 72),
      color: "#1E3A8A",
      letterSpacing: 0.4,
    };
    const oabSt: React.CSSProperties = {
      fontFamily: cssFontFamily,
      fontSize: Math.max(fontPx - 3, 9),
      color: "#374151",
      marginTop: 3,
    };
    const infoSt: React.CSSProperties = {
      fontFamily: cssFontFamily,
      fontSize: Math.max(fontPx - 4, 8),
      color: "#6B7280",
      marginTop: 2,
    };
    const nomeTxt = nome || "ADVOCACIA ORLANDO MARTINS";

    if (modeloTimbrado === "centralizado") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              style={{
                width: 60,
                height: 60,
                objectFit: "contain",
                marginBottom: 8,
              }}
            />
          )}
          <div style={{ ...nameSt, textAlign: "center" }}>
            {nomeTxt.toUpperCase()}
          </div>
          {oab && <div style={{ ...oabSt, textAlign: "center" }}>{oab}</div>}
        </div>
      );
    }

    if (modeloTimbrado === "executivo") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{ ...nameSt, fontSize: (tamanhoPadrao + 5) * (96 / 72) }}
            >
              {nomeTxt.toUpperCase()}
            </div>
            {oab && <div style={oabSt}>{oab}</div>}
          </div>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              style={{
                width: 52,
                height: 52,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      );
    }

    if (modeloTimbrado === "compacto") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                style={{ width: 40, height: 40, objectFit: "contain" }}
              />
            )}
            <div>
              <div
                style={{ ...nameSt, fontSize: (tamanhoPadrao + 1) * (96 / 72) }}
              >
                {nomeTxt.toUpperCase()}
              </div>
              {oab && <div style={infoSt}>{oab}</div>}
            </div>
          </div>
          <div style={{ ...infoSt, textAlign: "right" }}>Tel · E-mail</div>
        </div>
      );
    }

    // classico (default)
    return (
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            style={{
              width: 76,
              height: 76,
              objectFit: "contain",
              marginRight: 16,
              flexShrink: 0,
            }}
          />
        ) : null}
        <div>
          <div style={nameSt}>{nomeTxt.toUpperCase()}</div>
          {oab && <div style={oabSt}>{oab}</div>}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Feedback */}
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-body text-sm text-emerald-700">
          Configurações salvas com sucesso.
        </div>
      )}

      {/* ── Logo e Modelo de Timbrado ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-4">
          Logo marca
        </h2>
        <div className="flex items-start gap-5">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-slate-50 overflow-hidden">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Logo do escritório"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span className="font-body text-xs text-muted text-center px-2">
                Sem logo
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex h-9 items-center gap-2 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary disabled:opacity-60 cursor-pointer"
            >
              {uploading && <SpinnerIcon className="h-4 w-4" />}
              {uploading
                ? "Enviando…"
                : previewUrl
                  ? "Alterar logo"
                  : "Enviar logo"}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={removeLogo}
                className="h-9 rounded-lg border border-red-200 px-4 font-body text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
              >
                Remover logo
              </button>
            )}
            <p className="font-body text-xs text-muted">
              PNG, JPG ou SVG. Recomendado: fundo transparente, proporção
              quadrada.
            </p>
            {uploadError && (
              <p className="font-body text-xs text-red-600">{uploadError}</p>
            )}
          </div>
        </div>
        <input type="hidden" name="logo_url" value={logoUrl} />

        {/* ── Modelo do papel timbrado ── */}
        <div className="mt-5 pt-5 border-t border-border">
          <h3 className="font-heading text-sm font-semibold text-fg mb-1">
            Modelo do papel timbrado
          </h3>
          <p className="font-body text-xs text-muted mb-4">
            Define como o cabeçalho é organizado em todos os documentos gerados.
          </p>
          <input type="hidden" name="modelo_timbrado" value={modeloTimbrado} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setModeloTimbrado(t.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                  modeloTimbrado === t.id
                    ? "border-primary bg-blue-50 shadow-sm"
                    : "border-border bg-white hover:border-slate-300"
                }`}
              >
                {/* Mini visual */}
                <div className="mb-2.5">{t.preview}</div>
                {/* Divider rep */}
                {t.id === "compacto" ? (
                  <div
                    style={{ borderTop: "2px solid #1E3A8A", marginBottom: 8 }}
                  />
                ) : (
                  <>
                    <div
                      style={{
                        borderTop: "3px solid #1E3A8A",
                        marginBottom: 2,
                      }}
                    />
                    <div
                      style={{
                        borderTop: "0.5px solid #B45309",
                        marginBottom: 8,
                      }}
                    />
                  </>
                )}
                <p className="font-heading text-xs font-semibold text-fg leading-tight">
                  {t.label}
                </p>
                <p className="font-body text-[10px] text-muted leading-tight mt-0.5">
                  {t.sub}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fundo do documento ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-1">
          Fundo do papel timbrado
        </h2>
        <p className="font-body text-xs text-muted mb-4">
          Imagem ou PDF aplicado como fundo em cada página de todos os
          documentos gerados. Suporte: PDF, PNG, JPG e SVG (SVG é convertido
          para PNG automaticamente).
        </p>

        <input type="hidden" name="fundo_timbrado" value={fundoData} />
        <input
          ref={fundoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFundoUpload(f);
          }}
        />

        <div className="flex items-start gap-5">
          {/* Thumbnail / preview */}
          <div className="flex h-28 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-slate-50 overflow-hidden relative">
            {fundoData && !fundoData.startsWith("data:application/pdf") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fundoData}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : fundoData ? (
              <div className="flex flex-col items-center gap-1 p-2">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-body text-[10px] text-muted text-center leading-tight">
                  PDF
                </span>
              </div>
            ) : (
              <span className="font-body text-[10px] text-muted text-center px-2 leading-tight">
                Sem fundo
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={fundoUploading}
              onClick={() => fundoFileRef.current?.click()}
              className="flex h-9 items-center gap-2 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary disabled:opacity-60 cursor-pointer"
            >
              {fundoUploading && <SpinnerIcon className="h-4 w-4" />}
              {fundoUploading
                ? "Processando…"
                : fundoData
                  ? "Alterar fundo"
                  : "Enviar fundo"}
            </button>
            {fundoData && (
              <button
                type="button"
                onClick={removeFundo}
                className="h-9 rounded-lg border border-red-200 px-4 font-body text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
              >
                Remover fundo
              </button>
            )}
            <p className="font-body text-xs text-muted">
              Tamanho máximo: 10 MB. Use uma imagem em tamanho A4 para melhor
              resultado.
            </p>
            {fundoError && (
              <p className="font-body text-xs text-red-600">{fundoError}</p>
            )}
            {fundoData && (
              <p className="font-body text-xs text-emerald-600">
                ✓ Fundo ativo — será aplicado a todos os PDFs gerados.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Identificação ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-4">
          Identificação do escritório
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Nome / Razão social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Advocacia Orlando Martins"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>OAB (número e seccional)</label>
            <input
              type="text"
              name="oab"
              value={oab}
              onChange={(e) => setOab(e.target.value)}
              placeholder="Ex: OAB/SP 123.456"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>CNPJ</label>
            <input
              type="text"
              name="cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              type="text"
              name="telefone"
              defaultValue={config.telefone ?? ""}
              placeholder="(11) 99999-9999"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input
              type="email"
              name="email"
              defaultValue={config.email ?? ""}
              placeholder="contato@escritorio.com.br"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Site</label>
            <input
              type="text"
              name="site"
              defaultValue={config.site ?? ""}
              placeholder="www.escritorio.com.br"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-4">
          Endereço
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>CEP</label>
            <div className="relative">
              <input
                type="text"
                name="cep"
                value={cep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
                className={`${inputCls} ${buscandoCep ? "pr-9" : ""}`}
              />
              {buscandoCep && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <SpinnerIcon className="h-4 w-4 text-muted" />
                </span>
              )}
            </div>
            {cepError ? (
              <p className="mt-1 font-body text-xs text-red-600">{cepError}</p>
            ) : (
              <p className="mt-1 font-body text-xs text-muted">
                Digite 8 dígitos para preencher automaticamente.
              </p>
            )}
          </div>
          <div className="hidden sm:block" />

          <input type="hidden" name="endereco" value={enderecoCompleto} />

          <div className="sm:col-span-2">
            <label className={labelCls}>Logradouro</label>
            <input
              type="text"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Rua / Avenida / Alameda"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Número</label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 123"
              className={inputCls}
            />
          </div>
          <div className="hidden sm:block" />
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              type="text"
              name="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="São Paulo"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select
              name="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={selectCls}
            >
              <option value="">— UF —</option>
              {ESTADOS_BR.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tipografia e Margens ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-1">
          Tipografia e margens dos documentos
        </h2>
        <p className="font-body text-xs text-muted mb-5">
          Padrão aplicado a todos os PDFs gerados pelo sistema.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Fonte padrão</label>
            <select
              name="font_padrao"
              value={fontPadrao}
              onChange={(e) => setFontPadrao(e.target.value)}
              className={selectCls}
            >
              <option value="Times">Times (clássico jurídico)</option>
              <option value="Helvetica">Helvetica / Arial (moderno)</option>
              <option value="Courier">Courier (máquina de escrever)</option>
            </select>
            <p className="mt-1 font-body text-xs text-muted">
              Arial é mapeado para Helvetica no PDF.
            </p>
          </div>
          <div>
            <label className={labelCls}>Tamanho da fonte (pt)</label>
            <input
              type="number"
              name="tamanho_padrao"
              value={tamanhoPadrao}
              onChange={(e) =>
                setTamanhoPadrao(parseFloat(e.target.value) || 12)
              }
              min={8}
              max={20}
              step={0.5}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Espaçamento de linha</label>
            <input
              type="number"
              name="line_height"
              value={lineHeightVal}
              onChange={(e) =>
                setLineHeightVal(parseFloat(e.target.value) || 1.8)
              }
              min={1.0}
              max={5.0}
              step={0.1}
              className={inputCls}
            />
            <p className="mt-1 font-body text-xs text-muted">
              1.0 = simples · 1.5 = ABNT · 2.0 = duplo
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Margens (mm)</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["topo", "margem_topo", "Superior"],
                ["direita", "margem_direita", "Direita"],
                ["inferior", "margem_inferior", "Inferior"],
                ["esquerda", "margem_esquerda", "Esquerda"],
              ] as [keyof typeof margens, string, string][]
            ).map(([key, name, label]) => (
              <div key={key}>
                <label className="block font-body text-xs text-muted mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  name={name}
                  value={margens[key]}
                  onChange={setMargem(key)}
                  min={5}
                  max={60}
                  step={1}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Prévia do documento ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-fg mb-1">
          Prévia do documento
        </h2>
        <p className="font-body text-xs text-muted mb-4">
          Atualiza em tempo real conforme você edita logo, modelo, fonte e
          margens.
        </p>

        <div className="w-full overflow-x-auto rounded-lg bg-slate-200 p-4">
          <div
            style={{
              position: "relative",
              width: PREVIEW_W,
              height: PREVIEW_H,
              overflow: "hidden",
              margin: "0 auto",
              boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: A4_W,
                height: A4_H,
                transform: `scale(${PREVIEW_SCALE})`,
                transformOrigin: "top left",
                backgroundColor: "white",
                backgroundImage:
                  fundoData && !fundoData.startsWith("data:application/pdf")
                    ? `url("${fundoData}")`
                    : undefined,
                backgroundSize: "cover",
                backgroundPosition: "top center",
                paddingTop: margens.topo * MM_TO_PX,
                paddingRight: margens.direita * MM_TO_PX,
                paddingBottom: margens.inferior * MM_TO_PX,
                paddingLeft: margens.esquerda * MM_TO_PX,
              }}
            >
              {/* ── Letterhead header (matches selected modelo) ── */}
              {renderPreviewHeader()}

              {/* Dividers */}
              {modeloTimbrado === "compacto" ? (
                <div
                  style={{
                    borderBottom: "2px solid #1E3A8A",
                    marginBottom: 20,
                  }}
                />
              ) : (
                <>
                  <div
                    style={{
                      borderBottom: "3px solid #1E3A8A",
                      marginTop: 10,
                      marginBottom: 4,
                    }}
                  />
                  <div
                    style={{
                      borderBottom: "0.5px solid #B45309",
                      marginBottom: 24,
                    }}
                  />
                </>
              )}

              {/* ── Document title ── */}
              <div
                style={{
                  fontFamily: cssFontFamily,
                  fontWeight: "bold",
                  fontSize: (tamanhoPadrao + 2) * (96 / 72),
                  textAlign: "center",
                  textDecoration: "underline",
                  letterSpacing: 0.5,
                  marginBottom: 28,
                  color: "#1a1a1a",
                }}
              >
                TÍTULO DO DOCUMENTO
              </div>

              {/* ── Body paragraphs ── */}
              {SAMPLE_PARAS.map((para, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: cssFontFamily,
                    fontSize: fontPx,
                    lineHeight: lineHeightVal,
                    textAlign: "justify",
                    marginBottom: 12,
                    color: "#1a1a1a",
                    textIndent: 36,
                  }}
                >
                  {para}
                </div>
              ))}

              {/* Margin guides */}
              <div
                style={{
                  position: "absolute",
                  top: margens.topo * MM_TO_PX - 1,
                  right: margens.direita * MM_TO_PX - 1,
                  bottom: margens.inferior * MM_TO_PX - 1,
                  left: margens.esquerda * MM_TO_PX - 1,
                  border: "1px dashed rgba(59,130,246,0.25)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 font-body text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 border border-dashed border-blue-400 opacity-70" />
            Área de texto (margens)
          </span>
          <span>
            Fonte: <strong>{fontPadrao}</strong> · {tamanhoPadrao} pt · linha ×
            {lineHeightVal}
          </span>
          <span>
            Margens: ↑{margens.topo} ↓{margens.inferior} ←{margens.esquerda} →
            {margens.direita} mm
          </span>
          <span>
            Modelo:{" "}
            <strong>
              {TEMPLATES.find((t) => t.id === modeloTimbrado)?.label ??
                modeloTimbrado}
            </strong>
          </span>
          {fundoData && (
            <span className="text-emerald-600">
              Fundo:{" "}
              <strong>
                {fundoData.startsWith("data:application/pdf")
                  ? "PDF ativo"
                  : "imagem ativa"}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || uploading}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {pending && <SpinnerIcon className="h-4 w-4" />}
          Salvar configurações
        </button>
      </div>
    </form>
  );
}
