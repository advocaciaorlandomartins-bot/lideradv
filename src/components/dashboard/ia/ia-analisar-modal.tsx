"use client";

import { useState, useRef, useEffect } from "react";

interface DocExistente {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  created_at_formatted: string;
}

interface Props {
  clienteId?: string;
  processoId?: string;
  onClose: () => void;
}

const TIPOS: { value: string; label: string; desc: string; icon: string }[] = [
  {
    value: "completa",
    label: "Análise completa",
    icon: "🔬",
    desc: "Resumo executivo, linha do tempo, pontos de atenção e próximas ações",
  },
  {
    value: "resumo",
    label: "Resumo rápido",
    icon: "⚡",
    desc: "Síntese objetiva em 5 parágrafos — ideal para triagem rápida",
  },
  {
    value: "riscos",
    label: "Análise de riscos",
    icon: "⚠️",
    desc: "Cláusulas problemáticas, prazos críticos e irregularidades",
  },
];

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const MIME_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function docIcon(tipo: string | null) {
  if (!tipo) return "📄";
  if (tipo.includes("pdf")) return "📕";
  if (tipo.includes("image")) return "🖼️";
  if (tipo.includes("word") || tipo.includes("document")) return "📘";
  if (tipo.includes("excel") || tipo.includes("sheet")) return "📗";
  return "📄";
}

export default function IaAnalisarModal({
  clienteId,
  processoId,
  onClose,
}: Props) {
  const [modo, setModo] = useState<"existente" | "novo">("existente");
  const [docsExistentes, setDocsExistentes] = useState<DocExistente[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  const [docSelecionado, setDocSelecionado] = useState<DocExistente | null>(
    null
  );
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [tipoAnalise, setTipoAnalise] = useState("completa");
  const [resultados, setResultados] = useState<
    { nome: string; resultado: string }[]
  >([]);
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca documentos já existentes
  useEffect(() => {
    async function carregarDocs() {
      if (!processoId && !clienteId) return;
      setCarregandoDocs(true);
      const docs: DocExistente[] = [];
      try {
        if (processoId) {
          const r = await fetch(
            `/api/documentos?entityType=processo&entityId=${processoId}`
          );
          if (r.ok) docs.push(...(await r.json()));
        }
        if (clienteId) {
          const r = await fetch(
            `/api/documentos?entityType=cliente&entityId=${clienteId}`
          );
          if (r.ok) {
            const clienteDocs: DocExistente[] = await r.json();
            // Evitar duplicatas
            const ids = new Set(docs.map((d) => d.id));
            docs.push(...clienteDocs.filter((d) => !ids.has(d.id)));
          }
        }
        setDocsExistentes(
          docs.filter((d) => MIME_SUPORTADOS.has(d.tipo ?? ""))
        );
        if (docs.length === 0) setModo("novo");
      } catch {
        setModo("novo");
      } finally {
        setCarregandoDocs(false);
      }
    }
    carregarDocs();
  }, [processoId, clienteId]);

  const adicionarArquivos = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista).filter((f) => MIME_SUPORTADOS.has(f.type));
    setArquivos((prev) => {
      const existentes = new Set(prev.map((f) => f.name + f.size));
      return [
        ...prev,
        ...novos.filter((f) => !existentes.has(f.name + f.size)),
      ];
    });
  };

  const removerArquivo = (idx: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
  };

  const analisar = async () => {
    const targets: {
      nome: string;
      tipo: "existente" | "arquivo";
      data: DocExistente | File;
    }[] = [];

    if (modo === "existente" && docSelecionado) {
      targets.push({
        nome: docSelecionado.nome,
        tipo: "existente",
        data: docSelecionado,
      });
    } else if (modo === "novo" && arquivos.length > 0) {
      arquivos.forEach((f) =>
        targets.push({ nome: f.name, tipo: "arquivo", data: f })
      );
    }

    if (targets.length === 0) return;

    setCarregando(true);
    setErros([]);
    setResultados([]);

    const novosResultados: { nome: string; resultado: string }[] = [];
    const novosErros: string[] = [];

    for (const target of targets) {
      try {
        let res: Response;
        if (target.tipo === "existente") {
          const doc = target.data as DocExistente;
          res = await fetch("/api/ia/analisar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentoUrl: doc.url,
              nomeArquivo: doc.nome,
              mimeType: doc.tipo ?? "application/pdf",
              tipoAnalise,
              clienteId,
              processoId,
            }),
          });
        } else {
          const form = new FormData();
          form.append("arquivo", target.data as File);
          form.append("tipoAnalise", tipoAnalise);
          if (clienteId) form.append("clienteId", clienteId);
          if (processoId) form.append("processoId", processoId);
          res = await fetch("/api/ia/analisar", { method: "POST", body: form });
        }
        const data = await res.json();
        if (!res.ok) {
          novosErros.push(`${target.nome}: ${data.error ?? "Erro"}`);
        } else {
          novosResultados.push({
            nome: target.nome,
            resultado: data.resultado,
          });
        }
      } catch {
        novosErros.push(`${target.nome}: Erro de conexão.`);
      }
    }

    setResultados(novosResultados);
    setErros(novosErros);
    setCarregando(false);
  };

  const renderMarkdown = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /^#{1,3}\s(.+)/gm,
        '<p class="font-semibold text-base mt-4 mb-1">$1</p>'
      )
      .replace(/^- (.+)/gm, '<li class="ml-4">• $1</li>')
      .replace(/\n/g, "<br/>");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-fg">
              🔍 Analisar Documento com Dr. Lex
            </h2>
            <p className="font-body text-sm text-muted">
              PDF ou imagem — análise jurídica profissional
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
          {/* Seletor de modo */}
          {docsExistentes.length > 0 && (
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setModo("existente")}
                className={`flex-1 py-2.5 font-body text-sm font-semibold transition-colors ${
                  modo === "existente"
                    ? "bg-primary text-white"
                    : "bg-white text-muted hover:bg-slate-50"
                }`}
              >
                📎 Documentos do processo ({docsExistentes.length})
              </button>
              <button
                onClick={() => setModo("novo")}
                className={`flex-1 py-2.5 font-body text-sm font-semibold transition-colors ${
                  modo === "novo"
                    ? "bg-primary text-white"
                    : "bg-white text-muted hover:bg-slate-50"
                }`}
              >
                📤 Enviar novo arquivo
              </button>
            </div>
          )}

          {/* Docs existentes */}
          {modo === "existente" && (
            <div>
              {carregandoDocs ? (
                <div className="flex items-center justify-center h-24 text-muted font-body text-sm">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Carregando documentos...
                </div>
              ) : docsExistentes.length === 0 ? (
                <p className="text-center font-body text-sm text-muted py-8">
                  Nenhum documento suportado encontrado no processo.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {docsExistentes.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() =>
                        setDocSelecionado(
                          docSelecionado?.id === doc.id ? null : doc
                        )
                      }
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        docSelecionado?.id === doc.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">
                        {docIcon(doc.tipo)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-fg truncate">
                          {doc.nome}
                        </p>
                        <p className="font-body text-xs text-muted">
                          {doc.tamanho ? formatBytes(doc.tamanho) : ""} ·{" "}
                          {doc.created_at_formatted}
                        </p>
                      </div>
                      {docSelecionado?.id === doc.id && (
                        <span className="text-primary font-bold text-lg flex-shrink-0">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload de novos arquivos */}
          {modo === "novo" && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  adicionarArquivos(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-slate-50"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => adicionarArquivos(e.target.files)}
                />
                <p className="text-3xl mb-2">📄</p>
                <p className="font-body text-sm text-fg font-semibold">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="font-body text-xs text-muted mt-1">
                  PDF, JPG, PNG, WebP — múltiplos arquivos aceitos
                </p>
              </div>

              {arquivos.length > 0 && (
                <div className="space-y-1.5">
                  {arquivos.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2"
                    >
                      <span className="text-lg">{docIcon(f.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-xs font-semibold text-fg truncate">
                          {f.name}
                        </p>
                        <p className="font-body text-xs text-muted">
                          {formatBytes(f.size)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removerArquivo(i);
                        }}
                        className="text-muted hover:text-red-500 text-sm font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    className={`font-body text-sm font-semibold ${tipoAnalise === t.value ? "text-primary" : "text-fg"}`}
                  >
                    {t.icon} {t.label}
                  </p>
                  <p className="font-body text-xs text-muted mt-0.5">
                    {t.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Erros */}
          {erros.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
              {erros.map((e, i) => (
                <p key={i} className="font-body text-sm text-red-700">
                  {e}
                </p>
              ))}
            </div>
          )}

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="space-y-4">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-slate-50"
                >
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                    <p className="font-body text-sm font-semibold text-fg truncate">
                      {r.nome}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(r.resultado)}
                      className="flex-shrink-0 font-body text-xs text-muted hover:text-primary ml-3"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <div className="p-4 max-h-72 overflow-y-auto">
                    <div
                      className="font-body text-sm text-fg leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(r.resultado),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <button
            onClick={analisar}
            disabled={
              carregando ||
              (modo === "existente" ? !docSelecionado : arquivos.length === 0)
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary font-body text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {carregando ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analisando...
              </>
            ) : resultados.length > 0 ? (
              "🔄 Reanalisar"
            ) : (
              "🔍 Analisar com Dr. Lex"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
