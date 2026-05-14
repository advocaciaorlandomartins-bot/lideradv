"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClientAction, type ClientFormState } from "@/lib/client-actions";
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

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return raw;
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  return `(${ddd}) ${num.slice(0, num.length - 4)}-${num.slice(-4)}`;
}

export default function NewClientForm() {
  const [state, formAction, isPending] = useActionState<
    ClientFormState,
    FormData
  >(createClientAction, null);

  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [docValue, setDocValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [tradeNameValue, setTradeNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [cepValue, setCepValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [complementValue, setComplementValue] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  function handleTypeChange(t: "PF" | "PJ") {
    setType(t);
    setDocValue("");
  }

  async function fetchCnpj(digits: string) {
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.razao_social) setNameValue(data.razao_social);
      if (data.nome_fantasia) setTradeNameValue(data.nome_fantasia);
      if (data.email) setEmailValue(data.email.toLowerCase());
      if (data.ddd_telefone_1) setPhoneValue(formatPhone(data.ddd_telefone_1));
      const rawCep = (data.cep ?? "").replace(/\D/g, "");
      if (rawCep) setCepValue(maskCEP(rawCep));
      if (data.logradouro) setStreet(data.logradouro);
      if (data.numero) setNumberValue(data.numero);
      if (data.complemento) setComplementValue(data.complemento);
      if (data.bairro) setNeighborhood(data.bairro);
      if (data.municipio) setCity(data.municipio);
      if (data.uf) setUf(data.uf);
    } catch {
      // silently fail — user fills manually
    } finally {
      setCnpjLoading(false);
    }
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (type === "PF") {
      setDocValue(maskCPF(raw));
    } else {
      const digits = raw.replace(/\D/g, "").slice(0, 14);
      setDocValue(maskCNPJ(raw));
      if (digits.length === 14) fetchCnpj(digits);
    }
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
      // silently fail — user fills manually
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Error */}
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
                onChange={() => handleTypeChange(t)}
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
                autoComplete="name"
                required
                placeholder={
                  type === "PF" ? "Dr. João Roberto Silva" : "Empresa Ltda"
                }
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={type === "PF" ? "CPF" : "CNPJ"} required>
            <div className="relative">
              <input
                name="doc"
                type="text"
                inputMode="numeric"
                required
                placeholder={
                  type === "PF" ? "000.000.000-00" : "00.000.000/0001-00"
                }
                value={docValue}
                onChange={handleDocChange}
                disabled={isPending}
                className={`${inputClass} pr-10`}
              />
              {cnpjLoading && (
                <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              )}
            </div>
          </Field>

          {type === "PF" ? (
            <Field label="Data de nascimento">
              <input
                name="birth_date"
                type="date"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Nome fantasia">
              <input
                name="trade_name"
                type="text"
                placeholder="Nome fantasia"
                value={tradeNameValue}
                onChange={(e) => setTradeNameValue(e.target.value)}
                disabled={isPending || cnpjLoading}
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
              autoComplete="email"
              required
              placeholder="email@exemplo.com.br"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              disabled={isPending || cnpjLoading}
              className={inputClass}
            />
          </Field>
          <Field label="Telefone / WhatsApp" required>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="(11) 9 0000-0000"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              disabled={isPending || cnpjLoading}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="space-y-4">
        <SectionTitle>Endereço</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
          {/* CEP */}
          <div className="sm:col-span-2">
            <Field label="CEP" required>
              <div className="relative">
                <input
                  name="cep"
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="00000-000"
                  maxLength={9}
                  value={cepValue}
                  onChange={(e) => setCepValue(maskCEP(e.target.value))}
                  onBlur={handleCepBlur}
                  disabled={isPending || cnpjLoading}
                  className={`${inputClass} pr-10`}
                />
                {cepLoading && (
                  <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                )}
              </div>
            </Field>
          </div>

          {/* Logradouro */}
          <div className="sm:col-span-4">
            <Field label="Logradouro" required>
              <input
                name="street"
                type="text"
                required
                placeholder="Rua, Av., Travessa…"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Número */}
          <div className="sm:col-span-2">
            <Field label="Número" required>
              <input
                name="number"
                type="text"
                required
                placeholder="123"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Complemento */}
          <div className="sm:col-span-4">
            <Field label="Complemento">
              <input
                name="complement"
                type="text"
                placeholder="Apto, Sala, Bloco…"
                value={complementValue}
                onChange={(e) => setComplementValue(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Bairro */}
          <div className="sm:col-span-3">
            <Field label="Bairro" required>
              <input
                name="neighborhood"
                type="text"
                required
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Cidade */}
          <div className="sm:col-span-2">
            <Field label="Cidade" required>
              <input
                name="city"
                type="text"
                required
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isPending || cnpjLoading}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Estado */}
          <div className="sm:col-span-1">
            <Field label="UF" required>
              <select
                name="state"
                required
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                disabled={isPending || cnpjLoading}
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
            placeholder="Anotações internas sobre o cliente…"
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/clientes"
          className="flex h-11 items-center rounded-lg border border-border px-5 font-body text-sm font-semibold text-muted transition-colors duration-150 hover:border-slate-300 hover:text-fg"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending || cnpjLoading}
          className="flex h-11 items-center gap-2 rounded-lg bg-cta px-6 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isPending ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Salvando…
            </>
          ) : (
            "Salvar cliente"
          )}
        </button>
      </div>
    </form>
  );
}
