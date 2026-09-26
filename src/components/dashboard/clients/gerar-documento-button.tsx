"use client";

import { useRef, useState, useEffect } from "react";
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  SpinnerIcon,
} from "@/components/icons";
import type { ModeloDocumento, PerguntaExtra } from "@/lib/modelos-db";

type TemplateKey =
  | "procuracao"
  | "contrato_honorarios"
  | "declaracao_hipossuficiencia"
  | "notificacao_extrajudicial"
  | "comunicado_honorarios";

interface Template {
  key: TemplateKey;
  label: string;
  description: string;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    key: "procuracao",
    label: "Procuração Ad Judicia",
    description:
      "Outorga de poderes para representação judicial e extrajudicial",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "contrato_honorarios",
    label: "Contrato de Honorários",
    description:
      "Prestação de serviços advocatícios com cláusulas e honorários",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    key: "declaracao_hipossuficiencia",
    label: "Declaração de Hipossuficiência",
    description: "Declaração para concessão dos benefícios da justiça gratuita",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    key: "notificacao_extrajudicial",
    label: "Notificação Extrajudicial",
    description: "Notificação formal para cumprimento de obrigação ou direito",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "comunicado_honorarios",
    label: "Comunicado de Honorários",
    description:
      "Detalha o plano de pagamento dos honorários pendentes do cliente",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

interface Props {
  clientId: string;
  clientName: string;
  modelos: ModeloDocumento[];
  respostasSalvas: Record<string, string> | null;
}

// Seleção mistura os 5 modelos padrão (TemplateKey) com os modelos
// próprios do escritório (id UUID) — os dois cabem no mesmo Set<string>
// porque as chaves fixas nunca colidem com um UUID.
export default function GerarDocumentoButton({
  clientId,
  clientName,
  modelos,
  respostasSalvas,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "responder">("select");
  // Chave = tag da pergunta (ex: "pergunta_b1") — pré-preenchida com o que
  // já foi respondido antes (guardado no cliente), editável a qualquer
  // momento; o que for digitado aqui sobrescreve ao gerar.
  const [respostas, setRespostas] = useState<Record<string, string>>(
    respostasSalvas ?? {}
  );
  const selectAllRef = useRef<HTMLInputElement>(null);

  const totalItens = TEMPLATES.length + modelos.length;
  const allChecked = selected.size === totalItens;
  const someChecked = selected.size > 0 && !allChecked;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  function handleOpen() {
    setSelected(new Set());
    setError(null);
    setStep("select");
    setRespostas(respostasSalvas ?? {});
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
  }

  function toggleTemplate(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set([
          ...TEMPLATES.map((t): string => t.key),
          ...modelos.map((m) => m.id),
        ])
      );
    }
  }

  // Modelos selecionados que têm perguntas de texto livre (ex: Formulário
  // LOAS) — precisam de uma etapa de resposta antes de gerar, já que esse
  // valor não vem do cadastro do cliente nem de documento nenhum.
  function modelosComPerguntas(): ModeloDocumento[] {
    return modelos.filter(
      (m) => selected.has(m.id) && (m.perguntas_extras?.length ?? 0) > 0
    );
  }

  function handleAvancar() {
    if (selected.size === 0) return;
    if (modelosComPerguntas().length > 0) {
      setStep("responder");
      return;
    }
    handleGenerate();
  }

  function setResposta(tag: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [tag]: valor }));
  }

  async function handleGenerate() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);

    const safeName = clientName
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    try {
      for (const key of selected) {
        const modelo = modelos.find((m) => m.id === key);
        const temPerguntas = (modelo?.perguntas_extras?.length ?? 0) > 0;

        const res =
          modelo && temPerguntas
            ? await fetch("/api/gerar-modelo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  modeloId: modelo.id,
                  clienteId: clientId,
                  respostas,
                }),
              })
            : await fetch(
                modelo
                  ? `/api/gerar-modelo?modeloId=${modelo.id}&clienteId=${clientId}`
                  : `/api/clientes/${clientId}/gerar-documento?template=${key}`
              );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Erro ao gerar documento.");
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const label =
          modelo?.titulo ??
          TEMPLATES.find((t) => t.key === key)?.label ??
          "Documento";
        a.href = objectUrl;
        a.download = `${label.replace(/\s+/g, "_")}_${safeName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar documento.");
    } finally {
      setLoading(false);
    }
  }

  const btnLabel =
    step === "responder"
      ? selected.size === 1
        ? "Gerar PDF"
        : `Gerar ${selected.size} PDFs`
      : modelosComPerguntas().length > 0
        ? "Continuar"
        : selected.size === 0 || selected.size === 1
          ? "Baixar PDF"
          : `Baixar ${selected.size} PDFs`;

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-primary hover:text-primary cursor-pointer"
      >
        <DocumentTextIcon className="h-4 w-4" />
        Gerar Documento
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div
            className="flex w-full max-w-lg flex-col rounded-2xl border border-border bg-white shadow-xl"
            style={{ maxHeight: "calc(100vh - 2rem)" }}
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg font-semibold text-fg">
                  Gerar Documento
                </h2>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg disabled:opacity-40 cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5">
              {step === "responder" ? (
                <div className="space-y-5">
                  <p className="font-body text-sm text-muted">
                    Essas respostas entram direto no documento e ficam salvas —
                    da próxima vez já vêm preenchidas, só edite o que mudou.
                  </p>
                  {modelosComPerguntas().map((m) => (
                    <div key={m.id}>
                      <p className="mb-2 font-body text-sm font-semibold text-fg">
                        {m.titulo}
                      </p>
                      <div className="space-y-3">
                        {(m.perguntas_extras ?? []).map((p: PerguntaExtra) => (
                          <div key={p.tag}>
                            <label className="mb-1 block font-body text-xs font-semibold text-fg">
                              {p.label}
                            </label>
                            <textarea
                              value={respostas[p.tag] ?? ""}
                              onChange={(e) =>
                                setResposta(p.tag, e.target.value)
                              }
                              disabled={loading}
                              rows={2}
                              className="w-full rounded-lg border border-border px-3 py-2 font-body text-sm text-fg outline-none transition-colors focus:border-primary disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className="mb-4 font-body text-sm text-muted">
                    Selecione os modelos. Os dados de{" "}
                    <span className="font-semibold text-fg">{clientName}</span>{" "}
                    serão preenchidos automaticamente.
                  </p>

                  {/* Marcar todos */}
                  <label className="mb-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 transition-colors hover:bg-slate-50">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      disabled={loading}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary disabled:opacity-50"
                    />
                    <span className="font-body text-sm font-semibold text-fg">
                      {allChecked ? "Desmarcar todos" : "Marcar todos"}
                    </span>
                    {selected.size > 0 && (
                      <span className="ml-auto font-body text-xs text-muted">
                        {selected.size} de {totalItens} selecionados
                      </span>
                    )}
                  </label>

                  {modelos.length > 0 && (
                    <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Modelos do sistema
                    </p>
                  )}

                  {/* Template cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {TEMPLATES.map((t) => {
                      const isSelected = selected.has(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggleTemplate(t.key)}
                          disabled={loading}
                          className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                            isSelected
                              ? "border-primary bg-blue-50 shadow-sm"
                              : "border-border hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <div
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-body text-xs font-bold ${t.color}`}
                            >
                              <DocumentTextIcon className="h-3.5 w-3.5" />
                              PDF
                            </div>
                            <span
                              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                isSelected
                                  ? "border-primary bg-primary text-white"
                                  : "border-border bg-white"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="h-3 w-3"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <path
                                    d="M2 6l3 3 5-5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                          </div>
                          <span className="font-body text-sm font-semibold text-fg leading-snug">
                            {t.label}
                          </span>
                          <span className="font-body text-xs text-muted leading-relaxed">
                            {t.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {modelos.length > 0 && (
                    <>
                      <p className="mb-2 mt-5 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        Meus Modelos
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {modelos.map((m) => {
                          const isSelected = selected.has(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleTemplate(m.id)}
                              disabled={loading}
                              className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                                isSelected
                                  ? "border-primary bg-blue-50 shadow-sm"
                                  : "border-border hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex w-full items-start justify-between gap-2">
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-body text-xs font-bold text-slate-600">
                                  <DocumentTextIcon className="h-3.5 w-3.5" />
                                  PDF
                                </div>
                                <span
                                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                    isSelected
                                      ? "border-primary bg-primary text-white"
                                      : "border-border bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="h-3 w-3"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                    >
                                      <path
                                        d="M2 6l3 3 5-5"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </span>
                              </div>
                              <span className="font-body text-sm font-semibold text-fg leading-snug">
                                {m.titulo}
                              </span>
                              {m.descricao && (
                                <span className="font-body text-xs text-muted leading-relaxed">
                                  {m.descricao}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
              {step === "responder" ? (
                <button
                  onClick={() => setStep("select")}
                  disabled={loading}
                  className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-slate-400 disabled:opacity-40 cursor-pointer"
                >
                  Voltar
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-slate-400 disabled:opacity-40 cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={step === "responder" ? handleGenerate : handleAvancar}
                disabled={selected.size === 0 || loading}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    Gerando…
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {btnLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
