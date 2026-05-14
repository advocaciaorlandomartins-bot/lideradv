"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateClientAction, type ClientFormState } from "@/lib/client-actions";
import type { ClientFull } from "@/lib/clients-db";
import { SpinnerIcon } from "@/components/icons";

const ESTADOS = [
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

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-white px-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

const labelClass = "block font-body text-sm font-semibold text-fg mb-1.5";

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
      <label className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-heading text-base font-semibold text-fg">
        {children}
      </h2>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export default function EditClientForm({ client }: { client: ClientFull }) {
  const boundAction = updateClientAction.bind(null, client.id);
  const [state, formAction, isPending] = useActionState<
    ClientFormState,
    FormData
  >(boundAction, null);

  const [type, setType] = useState<"PF" | "PJ">(client.type);
  const [docValue, setDocValue] = useState(client.doc);
  const [nameValue, setNameValue] = useState(client.name);
  const [tradeNameValue, setTradeNameValue] = useState(client.trade_name ?? "");
  const [emailValue, setEmailValue] = useState(client.email);
  const [phoneValue, setPhoneValue] = useState(client.phone);
  const [cepValue, setCepValue] = useState(client.cep);
  const [numberValue, setNumberValue] = useState(client.addr_number);
  const [complementValue, setComplementValue] = useState(
    client.complement ?? ""
  );
  const [street, setStreet] = useState(client.street);
  const [neighborhood, setNeighborhood] = useState(client.neighborhood);
  const [city, setCity] = useState(client.city);
  const [uf, setUf] = useState(client.state);
  const [status, setStatus] = useState<"ativo" | "inativo">(client.status);
  const [cepLoading, setCepLoading] = useState(false);

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDocValue(
      type === "PF" ? maskCPF(e.target.value) : maskCNPJ(e.target.value)
    );
  }

  async function handleCepBlur(e: React.FocusEvent<HTMLInputElement>) {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setUf(data.uf ?? "");
      }
    } catch {
      // silently fail
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* ── Tipo de pessoa ── */}
      <div>
        <SectionTitle>Tipo de pessoa</SectionTitle>
        <div className="mt-4 flex gap-3">
          {(["PF", "PJ"] as const).map((t) => (
            <label
              key={t}
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors duration-150 ${
                type === t
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-primary"
              />
              <div>
                <p className="font-body text-sm font-semibold text-fg">
                  {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                </p>
                <p className="font-body text-xs text-muted">
                  {t === "PF" ? "CPF" : "CNPJ"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Status ── */}
      <div>
        <SectionTitle>Status</SectionTitle>
        <div className="mt-4 flex gap-3">
          {(["ativo", "inativo"] as const).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors duration-150 ${
                status === s
                  ? s === "ativo"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-400 bg-slate-50"
                  : "border-border hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="accent-primary"
              />
              <span className="font-body text-sm font-semibold text-fg capitalize">
                {s === "ativo" ? "Ativo" : "Inativo"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Identificação ── */}
      <div className="space-y-4">
        <SectionTitle>Identificação</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label={type === "PF" ? "Nome completo" : "Razão social"}
              required
            >
              <input
                name="name"
                type="text"
                required
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={type === "PF" ? "CPF" : "CNPJ"} required>
            <input
              name="doc"
              type="text"
              inputMode="numeric"
              required
              value={docValue}
              onChange={handleDocChange}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          {type === "PF" ? (
            <Field label="Data de nascimento">
              <input
                name="birth_date"
                type="date"
                defaultValue={client.birth_date ?? ""}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Nome fantasia">
              <input
                name="trade_name"
                type="text"
                value={tradeNameValue}
                onChange={(e) => setTradeNameValue(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </div>

      {/* ── Contato ── */}
      <div className="space-y-4">
        <SectionTitle>Contato</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail" required>
            <input
              name="email"
              type="email"
              required
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Telefone / WhatsApp" required>
            <input
              name="phone"
              type="tel"
              required
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="space-y-4">
        <SectionTitle>Endereço</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Field label="CEP" required>
              <div className="relative">
                <input
                  name="cep"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={9}
                  value={cepValue}
                  onChange={(e) => setCepValue(maskCEP(e.target.value))}
                  onBlur={handleCepBlur}
                  disabled={isPending || cepLoading}
                  className={`${inputClass} pr-10`}
                />
                {cepLoading && (
                  <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                )}
              </div>
            </Field>
          </div>

          <div className="sm:col-span-4">
            <Field label="Logradouro" required>
              <input
                name="street"
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Número" required>
              <input
                name="number"
                type="text"
                required
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-4">
            <Field label="Complemento">
              <input
                name="complement"
                type="text"
                value={complementValue}
                onChange={(e) => setComplementValue(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-3">
            <Field label="Bairro" required>
              <input
                name="neighborhood"
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Cidade" required>
              <input
                name="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-1">
            <Field label="UF" required>
              <select
                name="state"
                required
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                disabled={isPending}
                className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="">UF</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="notes"
            rows={3}
            defaultValue={client.notes ?? ""}
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href={`/dashboard/clientes/${client.id}`}
          className="flex h-11 items-center rounded-lg border border-border px-5 font-body text-sm font-semibold text-muted transition-colors duration-150 hover:border-slate-300 hover:text-fg"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 items-center gap-2 rounded-lg bg-cta px-6 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isPending ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Salvando…
            </>
          ) : (
            "Salvar alterações"
          )}
        </button>
      </div>
    </form>
  );
}
