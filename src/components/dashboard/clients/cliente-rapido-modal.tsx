"use client";

import { useState, useTransition } from "react";
import {
  XMarkIcon,
  UserPlusIcon,
  SpinnerIcon,
  CheckIcon,
  UsersIcon,
} from "@/components/icons";
import { createClientAction, type ClientFormState } from "@/lib/client-actions";

const ESTADOS_UF = [
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

interface Props {
  open: boolean;
  onClose: () => void;
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

function maskDoc(v: string, isPF: boolean) {
  const d = v.replace(/\D/g, "");
  if (isPF) {
    return d
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export default function ClienteRapidoModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [criarOutro, setCriarOutro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function resetForm() {
    setDoc("");
    setPhone("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    // Inject required fields with defaults for quick create
    if (!data.get("cep")) data.set("cep", "00000-000");
    if (!data.get("street")) data.set("street", "—");
    if (!data.get("number")) data.set("number", "S/N");
    if (!data.get("neighborhood")) data.set("neighborhood", "—");
    if (!data.get("city")) data.set("city", "—");
    if (!data.get("state")) data.set("state", "SP");

    startTransition(async () => {
      const result = await createClientAction(null as ClientFormState, data);
      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        if (criarOutro) {
          resetForm();
          form.reset();
        } else {
          onClose();
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UserPlusIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-fg">
                Novo Cliente
              </h2>
              <p className="font-body text-xs text-muted">Cadastro rápido</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-1 border-b border-border px-6 pt-3">
          {(["PF", "PJ"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                setDoc("");
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-t-lg px-5 py-2 font-body text-sm font-semibold transition-colors ${
                tipo === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-fg"
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="type" value={tipo} />

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
                {error}
              </div>
            )}

            <Field
              label={tipo === "PF" ? "Nome completo" : "Razão social"}
              required
            >
              <input
                name="name"
                type="text"
                required
                placeholder={tipo === "PF" ? "Nome completo…" : "Razão social…"}
                disabled={isPending}
                className={inputCls}
              />
            </Field>

            {tipo === "PJ" && (
              <Field label="Nome fantasia">
                <input
                  name="trade_name"
                  type="text"
                  placeholder="Nome fantasia…"
                  disabled={isPending}
                  className={inputCls}
                />
              </Field>
            )}

            <Field label={tipo === "PF" ? "CPF" : "CNPJ"} required>
              <input
                name="doc"
                type="text"
                required
                value={doc}
                onChange={(e) => setDoc(maskDoc(e.target.value, tipo === "PF"))}
                placeholder={
                  tipo === "PF" ? "000.000.000-00" : "00.000.000/0001-00"
                }
                disabled={isPending}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail" required>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="email@exemplo.com"
                  disabled={isPending}
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone" required>
                <input
                  name="phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  disabled={isPending}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <input
                  name="city"
                  type="text"
                  placeholder="Cidade…"
                  disabled={isPending}
                  className={inputCls}
                />
              </Field>
              <Field label="UF">
                <select
                  name="state"
                  defaultValue="SP"
                  disabled={isPending}
                  className={selectCls}
                >
                  {ESTADOS_UF.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Observações">
              <textarea
                name="notes"
                rows={2}
                placeholder="Anotações rápidas…"
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
                className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-cta px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-4 w-4" />
                    Salvar
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
