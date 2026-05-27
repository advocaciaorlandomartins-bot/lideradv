"use client";

import { useState } from "react";
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  SpinnerIcon,
} from "@/components/icons";

type TemplateKey =
  | "procuracao"
  | "contrato_honorarios"
  | "declaracao_hipossuficiencia"
  | "notificacao_extrajudicial";

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
];

interface Props {
  clientId: string;
  clientName: string;
}

export default function GerarDocumentoButton({ clientId, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TemplateKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setSelected(null);
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
  }

  async function handleGenerate() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/clientes/${clientId}/gerar-documento?template=${selected}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao gerar documento.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const templateLabel =
        TEMPLATES.find((t) => t.key === selected)?.label ?? "Documento";
      const safeName = clientName
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      a.href = url;
      a.download = `${templateLabel.replace(/\s+/g, "_")}_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar documento.");
    } finally {
      setLoading(false);
    }
  }

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
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
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
            <div className="px-6 py-5">
              <p className="mb-4 font-body text-sm text-muted">
                Selecione o modelo. Os dados de{" "}
                <span className="font-semibold text-fg">{clientName}</span>{" "}
                serão preenchidos automaticamente.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setSelected(t.key)}
                    disabled={loading}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                      selected === t.key
                        ? "border-primary bg-blue-50 shadow-sm"
                        : "border-border hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-body text-xs font-bold ${t.color}`}
                    >
                      <DocumentTextIcon className="h-3.5 w-3.5" />
                      PDF
                    </div>
                    <span className="font-body text-sm font-semibold text-fg leading-snug">
                      {t.label}
                    </span>
                    <span className="font-body text-xs text-muted leading-relaxed">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors duration-150 hover:border-slate-400 disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={!selected || loading}
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
                    Baixar PDF
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
