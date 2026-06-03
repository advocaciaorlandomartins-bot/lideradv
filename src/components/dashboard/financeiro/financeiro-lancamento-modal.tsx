"use client";

import { useState, useTransition, useEffect } from "react";
import {
  XMarkIcon,
  PlusIcon,
  SpinnerIcon,
  BanknotesIcon,
  TrendUpIcon,
  TrendDownIcon,
  CalendarIcon,
  CheckIcon,
} from "@/components/icons";
import {
  createLancamentoAction,
  type LancamentoFormState,
} from "@/lib/lancamento-actions";

const CATEGORIAS: Record<string, string[]> = {
  entrada: ["Honorários", "Reembolso de Despesas", "Adiantamento", "Outros"],
  saida: [
    "Custas Processuais",
    "Despesas Operacionais",
    "Salário",
    "Aluguel",
    "Impostos",
    "Material de Escritório",
    "Outros",
  ],
};

function todayISO() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

function formatMoney(raw: string): string {
  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx !== -1) {
    const intPart = raw.slice(0, commaIdx).replace(/\D/g, "");
    const decPart = raw
      .slice(commaIdx + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    const intNum = intPart ? parseInt(intPart, 10) : 0;
    return `${intNum.toLocaleString("pt-BR")},${decPart}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("pt-BR");
}

function normalizeMoney(v: string): string {
  if (!v) return "";
  const ci = v.indexOf(",");
  if (ci === -1) return v + ",00";
  return (
    v.slice(0, ci + 1) +
    v
      .slice(ci + 1)
      .padEnd(2, "0")
      .slice(0, 2)
  );
}

function parseMoney(display: string): string {
  if (!display) return "";
  const [int, dec = "00"] = display.split(",");
  const clean = int.replace(/\D/g, "");
  if (!clean) return "";
  return `${clean}.${dec.padEnd(2, "0").slice(0, 2)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTipo?: "entrada" | "saida";
  onSuccess?: () => void;
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectCls =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelCls =
  "block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function FinanceiroLancamentoModal({
  open,
  onClose,
  defaultTipo = "entrada",
  onSuccess,
}: Props) {
  const [tipo, setTipo] = useState<"entrada" | "saida">(defaultTipo);
  const [valorDisplay, setValorDisplay] = useState("");
  const [criarOutro, setCriarOutro] = useState(false);
  const [isParcelado, setIsParcelado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTipo(defaultTipo);
    setValorDisplay("");
    setError(null);
    setIsParcelado(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setValorDisplay("");
    setError(null);
    setIsParcelado(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("tipo", tipo);
    data.set("valor", parseMoney(valorDisplay));
    data.set("payment_mode", isParcelado ? "parcelado" : "avista");

    startTransition(async () => {
      const result = await createLancamentoAction(
        null as LancamentoFormState,
        data
      );
      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        if (criarOutro) {
          resetForm(form);
        } else {
          onClose();
        }
      }
    });
  }

  const isReceita = tipo === "entrada";
  const headerColor = isReceita ? "bg-emerald-600" : "bg-red-600";
  const accentColor = isReceita ? "text-emerald-700" : "text-red-600";
  const borderAccent = isReceita ? "border-emerald-300" : "border-red-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`${headerColor} px-6 py-4 flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            {isReceita ? (
              <TrendUpIcon className="h-5 w-5 text-white" />
            ) : (
              <TrendDownIcon className="h-5 w-5 text-white" />
            )}
            <div>
              <h2 className="font-heading text-base font-bold text-white">
                Lançamento rápido
              </h2>
              <p className="font-body text-xs text-white/70">
                {isReceita ? "Entrada / Receita" : "Saída / Despesa"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Tipo toggle */}
        <div className="flex border-b border-border bg-slate-50">
          {(["entrada", "saida"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-2.5 font-body text-sm font-semibold transition-colors ${
                tipo === t
                  ? t === "entrada"
                    ? "bg-white text-emerald-700 shadow-sm border-b-2 border-emerald-500"
                    : "bg-white text-red-600 shadow-sm border-b-2 border-red-500"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t === "entrada" ? (
                <>
                  <TrendUpIcon className="h-4 w-4" /> Receita
                </>
              ) : (
                <>
                  <TrendDownIcon className="h-4 w-4" /> Despesa
                </>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Valor — destaque */}
            <div
              className={`rounded-xl border-2 ${borderAccent} bg-slate-50 px-4 py-3`}
            >
              <label className="block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorDisplay}
                onChange={(e) => setValorDisplay(formatMoney(e.target.value))}
                onBlur={(e) => setValorDisplay(normalizeMoney(e.target.value))}
                disabled={isPending}
                className={`h-12 w-full rounded-lg border-0 bg-white px-4 font-heading text-2xl font-bold ${accentColor} placeholder:text-slate-300 outline-none ring-2 ring-transparent focus:ring-primary`}
              />
            </div>

            <Field label="Descrição" required>
              <input
                name="descricao"
                type="text"
                required
                placeholder={
                  isReceita
                    ? "Ex: Honorários — Maria da Silva…"
                    : "Ex: Custas processuais…"
                }
                disabled={isPending}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <select
                  name="categoria"
                  disabled={isPending}
                  className={selectCls}
                  defaultValue=""
                >
                  <option value="">Sem categoria</option>
                  {CATEGORIAS[tipo].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vencimento" required>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    name="data_vencimento"
                    type="date"
                    required
                    defaultValue={todayISO()}
                    disabled={isPending}
                    className={inputCls + " pl-9"}
                  />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  name="status"
                  defaultValue="pendente"
                  disabled={isPending}
                  className={selectCls}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">
                    {isReceita ? "Recebido" : "Pago"}
                  </option>
                </select>
              </Field>
              <div>
                <label className={labelCls}>Data de pagamento</label>
                <input
                  name="data_pagamento"
                  type="date"
                  disabled={isPending}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Parcelamento */}
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <div
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    isParcelado
                      ? "border-primary bg-primary"
                      : "border-border bg-white"
                  }`}
                  onClick={() => setIsParcelado((p) => !p)}
                >
                  {isParcelado && (
                    <CheckIcon className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <span className="font-body text-sm font-semibold text-fg">
                  Parcelamento
                </span>
              </label>
              {isParcelado && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nº de parcelas</label>
                    <input
                      name="total_parcelas"
                      type="number"
                      min={2}
                      max={60}
                      defaultValue={3}
                      disabled={isPending}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Periodicidade</label>
                    <select
                      name="periodicidade"
                      defaultValue="mensal"
                      disabled={isPending}
                      className={selectCls}
                    >
                      <option value="mensal">Mensal</option>
                      <option value="semanal">Semanal</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <Field label="Observações">
              <textarea
                name="observacoes"
                rows={2}
                placeholder="Anotações internas…"
                disabled={isPending}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <label className="flex cursor-pointer items-center gap-2">
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  criarOutro
                    ? "border-primary bg-primary"
                    : "border-border bg-white"
                }`}
                onClick={() => setCriarOutro((p) => !p)}
              >
                {criarOutro && <CheckIcon className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="font-body text-sm text-muted">Criar outro</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:text-fg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !valorDisplay}
                className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-5 font-body text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReceita
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    {isReceita ? "Salvar Receita" : "Salvar Despesa"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
