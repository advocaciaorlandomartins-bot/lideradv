"use client";

import { useRef, useState } from "react";
import type { Processo } from "@/lib/processos-db";
import type { DocumentoJudicialExtraido } from "@/app/api/ia/processar-judicial/route";

interface Props {
  clienteId: string;
  clienteNome: string;
  processos: Processo[];
  onClose: () => void;
}

type Etapa = "upload" | "revisao" | "sucesso";

const TIPO_LABEL: Record<string, string> = {
  citacao: "Citação",
  intimacao: "Intimação",
  decisao: "Decisão",
  sentenca: "Sentença",
  audiencia: "Audiência",
  despacho: "Despacho",
  peticao: "Petição",
  alvara: "Alvará",
  precatorio: "Precatório / RPV",
  outro: "Outro",
};

export default function JudicialProcessarModal({
  clienteNome,
  processos,
  onClose,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<DocumentoJudicialExtraido[]>([]);
  const [processoSelecionado, setProcessoSelecionado] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionarArquivos(files: FileList | null) {
    if (!files) return;
    const novos = Array.from(files).filter((f) =>
      [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ].includes(f.type)
    );
    setArquivos((prev) => [...prev, ...novos].slice(0, 10));
  }

  async function processar() {
    if (!arquivos.length) return;
    setProcessando(true);
    setErro(null);
    try {
      const form = new FormData();
      for (const f of arquivos) form.append("arquivos", f);
      const res = await fetch("/api/ia/processar-judicial", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar");
      setResultados(data.resultados);
      setEtapa("revisao");
    } catch (e) {
      setErro(String(e));
    } finally {
      setProcessando(false);
    }
  }

  function formatarData(iso: string | null) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="font-heading text-base font-semibold text-slate-900">
              Processar Documento Judicial
            </p>
            <p className="font-body text-xs text-muted">{clienteNome}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: "65vh" }}>
          {/* ── Etapa 1: Upload ── */}
          {etapa === "upload" && (
            <div className="space-y-4">
              <p className="font-body text-sm text-slate-600">
                Envie citações, intimações, decisões, sentenças ou outros
                documentos judiciais. A IA extrai automaticamente datas, prazos
                e dados do processo.
              </p>

              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  adicionarArquivos(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  arrastando
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="mx-auto mb-2 h-8 w-8 text-slate-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <p className="font-body text-sm text-slate-600">
                  Arraste documentos aqui ou{" "}
                  <span className="font-medium text-blue-600">
                    clique para selecionar
                  </span>
                </p>
                <p className="mt-1 font-body text-xs text-muted">
                  PDF, JPG, PNG, WEBP — máx. 10MB por arquivo
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => adicionarArquivos(e.target.files)}
              />

              {/* Lista de arquivos */}
              {arquivos.length > 0 && (
                <ul className="space-y-1">
                  {arquivos.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 font-body text-xs text-slate-700"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        onClick={() =>
                          setArquivos((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="ml-2 shrink-0 text-slate-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {erro && (
                <p className="rounded-lg bg-red-50 px-3 py-2 font-body text-xs text-red-600">
                  {erro}
                </p>
              )}
            </div>
          )}

          {/* ── Etapa 2: Revisão ── */}
          {etapa === "revisao" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="font-body text-xs text-blue-700">
                  Revise os dados extraídos pela IA. Vincule ao processo
                  correspondente se necessário.
                </p>
              </div>

              {/* Vincular processo */}
              {processos.length > 0 && (
                <div>
                  <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                    Vincular ao processo (opcional)
                  </label>
                  <select
                    value={processoSelecionado}
                    onChange={(e) => setProcessoSelecionado(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-xs text-slate-900"
                  >
                    <option value="">— Sem vínculo —</option>
                    {processos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.numero || p.tipo_acao || "Processo"}
                        {p.tipo_acao ? ` — ${p.tipo_acao}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cards por documento */}
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 font-body text-xs font-medium text-blue-700">
                        {TIPO_LABEL[r.tipo_documento] ?? r.tipo_documento}
                      </span>
                      <span
                        className={`ml-2 inline-block rounded-full px-2 py-0.5 font-body text-xs font-medium ${
                          r.confianca === "alta"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.confianca === "media"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.confianca === "alta"
                          ? "Alta"
                          : r.confianca === "media"
                            ? "Média"
                            : "Baixa"}{" "}
                        confiança
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted">
                      Arquivo {i + 1}/{resultados.length}
                    </p>
                  </div>

                  <p className="font-body text-sm text-slate-700">{r.resumo}</p>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-body text-xs">
                    {r.numero_processo && (
                      <>
                        <dt className="text-muted">Processo</dt>
                        <dd className="font-medium text-slate-800">
                          {r.numero_processo}
                        </dd>
                      </>
                    )}
                    {r.vara_tribunal && (
                      <>
                        <dt className="text-muted">Vara / Tribunal</dt>
                        <dd className="font-medium text-slate-800">
                          {r.vara_tribunal}
                        </dd>
                      </>
                    )}
                    {r.partes && (
                      <>
                        <dt className="text-muted">Partes</dt>
                        <dd className="font-medium text-slate-800">
                          {r.partes}
                        </dd>
                      </>
                    )}
                    {r.data_audiencia && (
                      <>
                        <dt className="text-muted">Data audiência</dt>
                        <dd className="font-medium text-slate-800">
                          {formatarData(r.data_audiencia)}
                          {r.hora_audiencia ? ` às ${r.hora_audiencia}` : ""}
                        </dd>
                      </>
                    )}
                    {r.local_audiencia && (
                      <>
                        <dt className="text-muted">Local</dt>
                        <dd className="font-medium text-slate-800">
                          {r.local_audiencia}
                        </dd>
                      </>
                    )}
                    {r.data_prazo && (
                      <>
                        <dt className="text-muted">Prazo</dt>
                        <dd className="font-medium text-red-700">
                          {formatarData(r.data_prazo)}
                          {r.prazo_descricao ? ` — ${r.prazo_descricao}` : ""}
                        </dd>
                      </>
                    )}
                    {r.valor != null && (
                      <>
                        <dt className="text-muted">Valor</dt>
                        <dd className="font-medium text-slate-800">
                          {r.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {/* ── Etapa 3: Sucesso ── */}
          {etapa === "sucesso" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-7 w-7 text-blue-600"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="font-heading text-base font-semibold text-slate-900">
                  Documentos processados!
                </p>
                <p className="mt-1 font-body text-sm text-muted">
                  Os dados foram extraídos. Adicione os compromissos ao
                  calendário manualmente conforme necessário.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-medium text-white hover:bg-primary/90"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {etapa !== "sucesso" && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              onClick={etapa === "upload" ? onClose : () => setEtapa("upload")}
              className="rounded-lg border border-slate-200 px-4 py-2 font-body text-sm text-slate-600 hover:bg-slate-50"
            >
              {etapa === "upload" ? "Cancelar" : "Voltar"}
            </button>
            {etapa === "upload" && (
              <button
                onClick={processar}
                disabled={!arquivos.length || processando}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-body text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {processando && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {processando ? "Processando..." : "Processar com IA"}
              </button>
            )}
            {etapa === "revisao" && (
              <button
                onClick={() => setEtapa("sucesso")}
                className="rounded-lg bg-blue-600 px-4 py-2 font-body text-sm font-medium text-white hover:bg-blue-700"
              >
                Concluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
