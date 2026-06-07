"use client";

import { useState, useEffect } from "react";
import {
  XMarkIcon,
  CogIcon,
  ClockIcon,
  ActivityIcon,
  PauseCircleIcon,
  CheckIcon,
} from "@/components/icons";

export interface ProcessosSettings {
  diasMovimentado: number;
  diasParado: number;
  carteiraObrigatoria: boolean;
}

export const DEFAULT_SETTINGS: ProcessosSettings = {
  diasMovimentado: 7,
  diasParado: 60,
  carteiraObrigatoria: false,
};

const STORAGE_KEY = "advmartins:processos:settings";

export function useProcessosSettings() {
  const [settings, setSettings] = useState<ProcessosSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as ProcessosSettings) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  function save(next: ProcessosSettings) {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return { settings, save };
}

type Tab = "atividade" | "peticiona" | "segmentacao";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ProcessosSettings;
  onSave: (s: ProcessosSettings) => void;
}

export default function ProcessosSettingsModal({
  open,
  onClose,
  settings,
  onSave,
}: Props) {
  const [tab, setTab] = useState<Tab>("atividade");
  const [local, setLocal] = useState<ProcessosSettings>(settings);

  // Sync local copy when modal reopens
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setLocal(settings);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  function handleSave() {
    onSave(local);
    onClose();
  }

  const inputCls =
    "h-10 w-24 rounded-lg border border-border bg-white px-3 font-mono text-sm text-fg text-center outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CogIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-fg">
                Configurações de Processos
              </h2>
              <p className="font-body text-xs text-muted">
                Personalize o comportamento do módulo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-6 pt-3">
          {(
            [
              { key: "atividade", label: "Período de atividade" },
              { key: "peticiona", label: "Peticiona" },
              { key: "segmentacao", label: "Segmentação" },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`cursor-pointer rounded-t-lg px-4 py-2 font-body text-sm font-semibold transition-colors ${
                tab === key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === "atividade" && (
            <div className="space-y-6">
              <p className="font-body text-sm text-muted">
                Define os critérios para classificar processos como{" "}
                <span className="font-semibold text-amber-600">
                  Movimentados
                </span>{" "}
                ou <span className="font-semibold text-red-600">Parados</span>{" "}
                nos indicadores.
              </p>

              <div className="rounded-xl border border-border bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      <ActivityIcon className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-semibold text-fg">
                        Processos movimentados
                      </p>
                      <p className="font-body text-xs text-muted">
                        Com andamento nos últimos X dias
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={local.diasMovimentado}
                      onChange={(e) =>
                        setLocal((prev) => ({
                          ...prev,
                          diasMovimentado: Math.max(
                            1,
                            parseInt(e.target.value) || 7
                          ),
                        }))
                      }
                      className={inputCls}
                    />
                    <span className="font-body text-sm text-muted">dias</span>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
                      <PauseCircleIcon className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-semibold text-fg">
                        Processos parados
                      </p>
                      <p className="font-body text-xs text-muted">
                        Sem andamento há mais de X dias
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={local.diasParado}
                      onChange={(e) =>
                        setLocal((prev) => ({
                          ...prev,
                          diasParado: Math.max(
                            1,
                            parseInt(e.target.value) || 60
                          ),
                        }))
                      }
                      className={inputCls}
                    />
                    <span className="font-body text-sm text-muted">dias</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "peticiona" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-slate-50 p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <ClockIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-fg">
                  Projuris Peticiona
                </h3>
                <p className="mt-1 font-body text-sm text-muted">
                  Integração com a plataforma de peticionamento{" "}
                  <strong>Softplan</strong>. Configure o token de acesso para
                  habilitar o protocolo eletrônico de documentos diretamente do
                  sistema.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block font-body text-sm font-semibold text-fg">
                  Token de integração
                </label>
                <input
                  type="text"
                  placeholder="Insira o token fornecido pela Softplan…"
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-border bg-slate-100 px-3 font-body text-sm text-muted outline-none"
                />
                <p className="mt-1 font-body text-xs text-muted">
                  Recurso disponível em breve.
                </p>
              </div>
            </div>
          )}

          {tab === "segmentacao" && (
            <div className="space-y-4">
              <p className="font-body text-sm text-muted">
                Configure campos obrigatórios no cadastro de processos para
                garantir a segmentação correta da carteira.
              </p>
              <div className="rounded-xl border border-border bg-slate-50 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={local.carteiraObrigatoria}
                      onChange={(e) =>
                        setLocal((prev) => ({
                          ...prev,
                          carteiraObrigatoria: e.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                        local.carteiraObrigatoria
                          ? "border-primary bg-primary"
                          : "border-border bg-white"
                      }`}
                    >
                      {local.carteiraObrigatoria && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      Campo &quot;Carteira&quot; obrigatório
                    </p>
                    <p className="font-body text-xs text-muted">
                      Exige preenchimento da carteira no cadastro de novos
                      processos
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <CheckIcon className="h-4 w-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
