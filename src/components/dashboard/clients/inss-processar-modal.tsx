"use client";

import { useRef, useState } from "react";
import type { Processo } from "@/lib/processos-db";
import type { DocumentoInssExtraido } from "@/app/api/ia/processar-inss/route";

interface Props {
  clienteId: string;
  clienteNome: string;
  telefoneCliente?: string | null;
  processos?: Processo[];
  onClose: () => void;
  onSuccess?: () => void;
}

type Etapa = "upload" | "revisao" | "sucesso";

interface DocRevisao extends DocumentoInssExtraido {
  arquivo_nome: string;
  processoId?: string;
  nomeResponsavel?: string;
  telefoneResponsavel?: string;
  confirmar: boolean;
}

const TIPOS_AGENDAMENTO = new Set([
  "agendamento_avaliacao_social",
  "agendamento_pericia_medica",
  "agendamento_generico",
]);

const TIPOS_PROCESSAVEIS = new Set([
  "agendamento_avaliacao_social",
  "agendamento_pericia_medica",
  "agendamento_generico",
  "rpv",
  "comprovante_pagamento",
  "resultado_pericia",
]);

function ehAgendamento(tipo: DocumentoInssExtraido["tipo_documento"]) {
  return TIPOS_AGENDAMENTO.has(tipo);
}

function ehProcessavel(tipo: DocumentoInssExtraido["tipo_documento"]) {
  return TIPOS_PROCESSAVEIS.has(tipo);
}

function dataEvento(doc: DocumentoInssExtraido): string {
  return (
    doc.data_agendamento ??
    doc.data_pagamento ??
    new Date().toISOString().split("T")[0]
  );
}

function labelTipo(tipo: DocumentoInssExtraido["tipo_documento"]): string {
  const map: Record<string, string> = {
    agendamento_avaliacao_social: "Agendamento — Avaliação Social",
    agendamento_pericia_medica: "Agendamento — Perícia Médica",
    agendamento_generico: "Agendamento INSS",
    comprovante_pagamento: "Comprovante de Pagamento",
    rpv: "RPV",
    resultado_pericia: "Resultado de Perícia",
    outro: "Outro documento",
  };
  return map[tipo] ?? tipo;
}

function confiancaColor(c: DocumentoInssExtraido["confianca"]) {
  if (c === "alta") return "text-emerald-600";
  if (c === "media") return "text-amber-600";
  return "text-red-500";
}

export default function InssProcessarModal({
  clienteId,
  clienteNome,
  telefoneCliente,
  processos = [],
  onClose,
  onSuccess,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocRevisao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sucessoCount, setSucessoCount] = useState(0);

  function handleArquivos(files: FileList | null) {
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
    setCarregando(true);
    setErro(null);
    try {
      const form = new FormData();
      for (const f of arquivos) form.append("arquivos", f);
      const res = await fetch("/api/ia/processar-inss", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as {
        resultados: DocumentoInssExtraido[];
      };
      const revisao: DocRevisao[] = data.resultados.map((r, i) => ({
        ...r,
        arquivo_nome: arquivos[i]?.name ?? `Arquivo ${i + 1}`,
        confirmar: ehProcessavel(r.tipo_documento),
      }));
      setDocs(revisao);
      setEtapa("revisao");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar documentos.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    const paraConfirmar = docs.filter(
      (d) => d.confirmar && ehProcessavel(d.tipo_documento)
    );
    if (!paraConfirmar.length) {
      onClose();
      return;
    }
    setSalvando(true);
    setErro(null);
    let count = 0;
    for (const doc of paraConfirmar) {
      try {
        const body = {
          clienteId,
          clienteNome,
          telefoneCliente: telefoneCliente ?? null,
          telefoneResponsavel: doc.telefoneResponsavel || null,
          nomeResponsavel: doc.nomeResponsavel || null,
          tipoDocumento: doc.tipo_documento,
          tipoServico: doc.tipo_servico ?? labelTipo(doc.tipo_documento),
          dataAgendamento: doc.data_agendamento ?? null,
          dataEvento: dataEvento(doc),
          horaAgendamento: doc.hora_agendamento ?? "09:00",
          localNome: doc.local_nome ?? "INSS",
          localEndereco: doc.local_endereco ?? null,
          protocolo: doc.protocolo ?? null,
          processoId: doc.processoId ?? null,
          valor: doc.valor ?? null,
          nomeRequerente: doc.nome_requerente ?? null,
        };
        const res = await fetch("/api/inss/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) count++;
      } catch {
        // continue with next doc
      }
    }
    setSalvando(false);
    setSucessoCount(count);
    setEtapa("sucesso");
    onSuccess?.();
  }

  function updateDoc(i: number, patch: Partial<DocRevisao>) {
    setDocs((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d))
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900">
              Processar Documento INSS
            </h2>
            <p className="font-body text-sm text-muted">{clienteNome}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-slate-100 hover:text-slate-700"
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

        <div className="px-6 py-5">
          {/* ETAPA: UPLOAD */}
          {etapa === "upload" && (
            <div className="space-y-4">
              <p className="font-body text-sm text-slate-600">
                Envie um ou mais documentos do INSS (PDF, JPG, PNG). A IA irá
                extrair os dados automaticamente.
              </p>

              {/* Drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleArquivos(e.dataTransfer.files);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-12 w-12 text-slate-300"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.923 11.094M12 16.5V9.75"
                  />
                </svg>
                <div className="text-center">
                  <p className="font-body text-sm font-medium text-slate-700">
                    Clique ou arraste os arquivos aqui
                  </p>
                  <p className="font-body text-xs text-muted">
                    PDF, JPG, PNG, WEBP · máx. 10MB cada · até 10 arquivos
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => handleArquivos(e.target.files)}
                />
              </div>

              {/* File list */}
              {arquivos.length > 0 && (
                <ul className="space-y-1.5">
                  {arquivos.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4 flex-shrink-0 text-primary"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="truncate font-body text-sm text-slate-700">
                          {f.name}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setArquivos((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        className="ml-2 flex-shrink-0 text-muted hover:text-red-500"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {erro && <p className="font-body text-sm text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-body text-sm text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={processar}
                  disabled={!arquivos.length || carregando}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {carregando ? (
                    <>
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
                      Processando IA...
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Extrair com IA
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA: REVISÃO */}
          {etapa === "revisao" && (
            <div className="space-y-4">
              <p className="font-body text-sm text-slate-600">
                Revise os dados extraídos. Selecione quais agendamentos deseja
                cadastrar na agenda e configurar os lembretes.
              </p>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {docs.map((doc, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 ${doc.confirmar ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-body text-xs text-muted">
                          {doc.arquivo_nome}
                        </p>
                        <p className="font-heading text-sm font-semibold text-slate-900">
                          {labelTipo(doc.tipo_documento)}
                        </p>
                        <p className="font-body text-xs text-slate-500">
                          {doc.resumo}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 font-body text-xs font-medium ${confiancaColor(doc.confianca)}`}
                      >
                        {doc.confianca === "alta"
                          ? "Alta confiança"
                          : doc.confianca === "media"
                            ? "Confiança média"
                            : "Baixa confiança"}
                      </span>
                    </div>

                    {/* Agendamentos: campos completos */}
                    {ehAgendamento(doc.tipo_documento) &&
                      doc.data_agendamento && (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <Field
                              label="Data"
                              value={doc.data_agendamento ?? ""}
                              type="date"
                              onChange={(v) =>
                                updateDoc(i, { data_agendamento: v })
                              }
                            />
                            <Field
                              label="Hora"
                              value={doc.hora_agendamento ?? ""}
                              type="time"
                              onChange={(v) =>
                                updateDoc(i, { hora_agendamento: v })
                              }
                            />
                            <Field
                              label="Local"
                              value={doc.local_nome ?? ""}
                              onChange={(v) => updateDoc(i, { local_nome: v })}
                            />
                            <Field
                              label="Protocolo"
                              value={doc.protocolo ?? ""}
                              onChange={(v) => updateDoc(i, { protocolo: v })}
                            />
                            <Field
                              label="Tel. responsável"
                              value={doc.telefoneResponsavel ?? ""}
                              placeholder="(82) 99999-9999"
                              onChange={(v) =>
                                updateDoc(i, { telefoneResponsavel: v })
                              }
                            />
                            <Field
                              label="Nome responsável"
                              value={doc.nomeResponsavel ?? ""}
                              onChange={(v) =>
                                updateDoc(i, { nomeResponsavel: v })
                              }
                            />
                          </div>

                          {processos.length > 0 && (
                            <div className="mt-2">
                              <label className="mb-1 block font-body text-xs text-muted">
                                Vincular ao processo
                              </label>
                              <select
                                value={doc.processoId ?? ""}
                                onChange={(e) =>
                                  updateDoc(i, {
                                    processoId: e.target.value || undefined,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value="">Nenhum processo</option>
                                {processos.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.tipo_acao}{" "}
                                    {p.numero ? `— ${p.numero}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <label className="mt-3 flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={doc.confirmar}
                              onChange={(e) =>
                                updateDoc(i, { confirmar: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="font-body text-sm text-slate-700">
                              Cadastrar na agenda e agendar lembretes por
                              WhatsApp
                            </span>
                          </label>
                        </>
                      )}

                    {/* RPV, comprovante, resultado: registra em Controles */}
                    {!ehAgendamento(doc.tipo_documento) &&
                      ehProcessavel(doc.tipo_documento) && (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {doc.tipo_documento === "rpv" &&
                              "Será registrado em Controles → Alvarás"}
                            {doc.tipo_documento === "comprovante_pagamento" &&
                              "Será registrado em Controles → Implantados"}
                            {doc.tipo_documento === "resultado_pericia" &&
                              "Será registrado em Controles → Perícias"}
                          </div>

                          {doc.valor && (
                            <div className="font-body text-xs text-slate-600">
                              Valor extraído:{" "}
                              <span className="font-medium text-slate-900">
                                R$ {doc.valor}
                              </span>
                            </div>
                          )}

                          {processos.length > 0 && (
                            <div>
                              <label className="mb-1 block font-body text-xs text-muted">
                                Vincular ao processo
                              </label>
                              <select
                                value={doc.processoId ?? ""}
                                onChange={(e) =>
                                  updateDoc(i, {
                                    processoId: e.target.value || undefined,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value="">Nenhum processo</option>
                                {processos.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.tipo_acao}{" "}
                                    {p.numero ? `— ${p.numero}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={doc.confirmar}
                              onChange={(e) =>
                                updateDoc(i, { confirmar: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="font-body text-sm text-slate-700">
                              Registrar nos Controles
                            </span>
                          </label>
                        </div>
                      )}

                    {!ehAgendamento(doc.tipo_documento) &&
                      !ehProcessavel(doc.tipo_documento) && (
                        <p className="font-body text-xs text-muted">
                          Este tipo de documento não gera registro automático.
                        </p>
                      )}
                  </div>
                ))}
              </div>

              {erro && <p className="font-body text-sm text-red-600">{erro}</p>}

              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => setEtapa("upload")}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-body text-sm text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmar}
                  disabled={salvando}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {salvando ? (
                    <>
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
                      Salvando...
                    </>
                  ) : (
                    `Confirmar ${docs.filter((d) => d.confirmar).length > 0 ? `(${docs.filter((d) => d.confirmar).length} documento${docs.filter((d) => d.confirmar).length !== 1 ? "s" : ""})` : "e fechar"}`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA: SUCESSO */}
          {etapa === "sucesso" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-8 w-8 text-emerald-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-heading text-lg font-semibold text-slate-900">
                  {sucessoCount > 0
                    ? `${sucessoCount} documento${sucessoCount !== 1 ? "s" : ""} registrado${sucessoCount !== 1 ? "s" : ""}!`
                    : "Documentos processados!"}
                </p>
                <p className="font-body text-sm text-muted">
                  Os dados foram salvos nos Controles e na Agenda.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-primary px-6 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block font-body text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
