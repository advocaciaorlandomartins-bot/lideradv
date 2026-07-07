"use client";

import { useState, useRef, useEffect } from "react";
import { complementarClienteAction } from "@/lib/client-actions";

interface DocExistente {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  created_at_formatted: string;
}

interface DadosPrevidenciarios {
  cid_principal?: string | null;
  tipo_incapacidade?: string | null;
  data_diagnostico?: string | null;
  data_afastamento?: string | null;
  atividade_anterior?: string | null;
  nis?: string | null;
  num_beneficio?: string | null;
  status_beneficio?: string | null;
  tipo_beneficio?: string | null;
  data_inicio_beneficio?: string | null;
  valor_beneficio?: number | null;
  filiacao_mae?: string | null;
  filiacao_pai?: string | null;
}

interface ResultadoAnalise {
  nome: string;
  resultado: string;
  dadosExtraidos: DadosPrevidenciarios | null;
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

const LABELS: Record<keyof DadosPrevidenciarios, string> = {
  cid_principal: "CID Principal",
  tipo_incapacidade: "Tipo de Incapacidade",
  data_diagnostico: "Data do Diagnóstico",
  data_afastamento: "Data de Afastamento",
  atividade_anterior: "Atividade Anterior",
  nis: "NIS/PIS",
  num_beneficio: "Número do Benefício",
  status_beneficio: "Status do Benefício",
  tipo_beneficio: "Tipo de Benefício",
  data_inicio_beneficio: "Início do Benefício",
  valor_beneficio: "Valor do Benefício",
  filiacao_mae: "Filiação (Mãe)",
  filiacao_pai: "Filiação (Pai)",
};

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

function formatFieldValue(
  key: keyof DadosPrevidenciarios,
  value: unknown
): string {
  if (value === null || value === undefined) return "";
  if (key === "valor_beneficio") {
    const n = Number(value);
    return isNaN(n) ? String(value) : `R$ ${n.toFixed(2).replace(".", ",")}`;
  }
  if (
    key === "data_diagnostico" ||
    key === "data_afastamento" ||
    key === "data_inicio_beneficio"
  ) {
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }
  }
  return String(value);
}

export default function IaAnalisarModal({
  clienteId,
  processoId,
  onClose,
}: Props) {
  const [modo, setModo] = useState<"existente" | "novo">("existente");
  const [docsExistentes, setDocsExistentes] = useState<DocExistente[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  const [docsSelecionados, setDocsSelecionados] = useState<Set<string>>(
    new Set()
  );
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [tipoAnalise, setTipoAnalise] = useState("completa");
  const [resultados, setResultados] = useState<ResultadoAnalise[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState<{
    atual: number;
    total: number;
    nome: string;
  } | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvoMsg, setSalvoMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const toggleDoc = (id: string) => {
    setDocsSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTodos = () => {
    if (docsSelecionados.size === docsExistentes.length) {
      setDocsSelecionados(new Set());
    } else {
      setDocsSelecionados(new Set(docsExistentes.map((d) => d.id)));
    }
  };

  const analisar = async () => {
    const targets: {
      nome: string;
      tipo: "existente" | "arquivo";
      data: DocExistente | File;
    }[] = [];

    if (modo === "existente" && docsSelecionados.size > 0) {
      docsExistentes
        .filter((d) => docsSelecionados.has(d.id))
        .forEach((d) =>
          targets.push({ nome: d.nome, tipo: "existente", data: d })
        );
    } else if (modo === "novo" && arquivos.length > 0) {
      arquivos.forEach((f) =>
        targets.push({ nome: f.name, tipo: "arquivo", data: f })
      );
    }

    if (targets.length === 0) return;

    setCarregando(true);
    setProgresso(null);
    setErros([]);
    setResultados([]);
    setSalvoMsg(null);

    const novosResultados: ResultadoAnalise[] = [];
    const novosErros: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setProgresso({ atual: i + 1, total: targets.length, nome: target.nome });
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
            dadosExtraidos: data.dadosExtraidos ?? null,
          });
          setResultados([...novosResultados]);
        }
      } catch {
        novosErros.push(`${target.nome}: Erro de conexão.`);
      }
    }

    setErros(novosErros);
    setCarregando(false);
    setProgresso(null);
  };

  // Agrega dadosExtraidos de todos os resultados (campos não-nulos)
  const dadosCombinados: DadosPrevidenciarios | null = (() => {
    if (!clienteId) return null;
    const combined: DadosPrevidenciarios = {};
    for (const r of resultados) {
      if (!r.dadosExtraidos) continue;
      for (const [k, v] of Object.entries(r.dadosExtraidos)) {
        const key = k as keyof DadosPrevidenciarios;
        if (v !== null && v !== undefined && !(key in combined)) {
          (combined as Record<string, unknown>)[key] = v;
        }
      }
    }
    return Object.keys(combined).length > 0 ? combined : null;
  })();

  const salvarDados = async () => {
    if (!clienteId || !dadosCombinados) return;
    setSalvando(true);
    setSalvoMsg(null);
    try {
      const result = await complementarClienteAction(
        clienteId,
        dadosCombinados
      );
      if (result.error) {
        setSalvoMsg(`Erro: ${result.error}`);
      } else if (result.camposAtualizados.length === 0) {
        setSalvoMsg("Todos os campos já estavam preenchidos no cadastro.");
      } else {
        const labels = result.camposAtualizados
          .map((c) => LABELS[c as keyof DadosPrevidenciarios] ?? c)
          .join(", ");
        setSalvoMsg(`Salvo com sucesso: ${labels}`);
      }
    } catch {
      setSalvoMsg("Erro ao salvar dados.");
    } finally {
      setSalvando(false);
    }
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
            <div className="space-y-2">
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
                <>
                  <div className="flex items-center justify-between">
                    <p className="font-body text-xs text-muted">
                      {docsSelecionados.size > 0
                        ? `${docsSelecionados.size} de ${docsExistentes.length} selecionado(s)`
                        : "Selecione um ou mais documentos"}
                    </p>
                    <button
                      onClick={selecionarTodos}
                      className="font-body text-xs font-semibold text-primary hover:underline"
                    >
                      {docsSelecionados.size === docsExistentes.length
                        ? "Desmarcar todos"
                        : "Selecionar todos"}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {docsExistentes.map((doc) => {
                      const selecionado = docsSelecionados.has(doc.id);
                      return (
                        <button
                          key={doc.id}
                          onClick={() => toggleDoc(doc.id)}
                          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                            selecionado
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                              selecionado
                                ? "border-primary bg-primary"
                                : "border-slate-300"
                            }`}
                          >
                            {selecionado && (
                              <svg
                                className="h-3 w-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="text-xl flex-shrink-0">
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
                        </button>
                      );
                    })}
                  </div>
                </>
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

          {/* Complementar cadastro — só aparece se há clienteId e dados extraídos */}
          {dadosCombinados && clienteId && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧬</span>
                <div>
                  <p className="font-body text-sm font-semibold text-indigo-900">
                    Dados identificados no documento
                  </p>
                  <p className="font-body text-xs text-indigo-600">
                    O Dr. Lex encontrou informações previdenciárias. Deseja
                    complementar o cadastro do cliente?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  Object.entries(dadosCombinados) as [
                    keyof DadosPrevidenciarios,
                    unknown,
                  ][]
                )
                  .filter(([, v]) => v !== null && v !== undefined)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg bg-white border border-indigo-100 px-3 py-2"
                    >
                      <p className="font-body text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                        {LABELS[k]}
                      </p>
                      <p className="font-body text-sm text-fg font-semibold mt-0.5">
                        {formatFieldValue(k, v)}
                      </p>
                    </div>
                  ))}
              </div>

              {salvoMsg && (
                <p
                  className={`font-body text-xs font-semibold ${
                    salvoMsg.startsWith("Erro")
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {salvoMsg.startsWith("Erro") ? "⚠️ " : "✅ "}
                  {salvoMsg}
                </p>
              )}

              {!salvoMsg && (
                <button
                  onClick={salvarDados}
                  disabled={salvando}
                  className="flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-body text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {salvando ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Salvando...
                    </>
                  ) : (
                    "💾 Complementar cadastro"
                  )}
                </button>
              )}
            </div>
          )}

          {/* Progresso */}
          {progresso && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs font-semibold text-blue-700">
                  Analisando {progresso.atual}/{progresso.total}
                </p>
                <p className="font-body text-xs text-blue-500">
                  {Math.round((progresso.atual / progresso.total) * 100)}%
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-100">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${(progresso.atual / progresso.total) * 100}%`,
                  }}
                />
              </div>
              <p className="font-body text-xs text-blue-600 truncate">
                {progresso.nome}
              </p>
            </div>
          )}

          {/* Ações */}
          <button
            onClick={analisar}
            disabled={
              carregando ||
              (modo === "existente"
                ? docsSelecionados.size === 0
                : arquivos.length === 0)
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary font-body text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {carregando ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {progresso
                  ? `Analisando ${progresso.atual}/${progresso.total}...`
                  : "Analisando..."}
              </>
            ) : resultados.length > 0 ? (
              `🔄 Reanalisar${docsSelecionados.size > 1 ? ` (${docsSelecionados.size})` : ""}`
            ) : (
              `🔍 Analisar com Dr. Lex${docsSelecionados.size > 1 ? ` (${docsSelecionados.size} docs)` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
