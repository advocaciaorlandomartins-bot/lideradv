"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClientAction, type ClientFormState } from "@/lib/client-actions";
import { SpinnerIcon } from "@/components/icons";

const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Separado(a) de fato",
  "Viúvo(a)",
  "União Estável",
];

const GENEROS = [
  "Feminino",
  "Masculino",
  "Homem trans",
  "Mulher trans",
  "Não binário",
];

const PARENTESCOS = [
  "Pai",
  "Mãe",
  "Avô / Avó",
  "Tutor Legal",
  "Curador",
  "Representante Legal",
];

function calcAge(dateStr: string): number {
  const birth = new Date(dateStr + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function maskCPFSimple(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

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

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-white px-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectClass =
  "h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
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

function EtapaTitle({
  num,
  children,
}: {
  num: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary font-body text-xs font-bold text-white">
        {num}
      </span>
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

  // Etapa 1
  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [nameValue, setNameValue] = useState("");
  const [tradeNameValue, setTradeNameValue] = useState("");
  const [docValue, setDocValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [emailValue, setEmailValue] = useState("");

  // Etapa 2 (PF)
  const [birthDate, setBirthDate] = useState("");
  const [menorIncapaz, setMenorIncapaz] = useState(false);
  const [respCpfValue, setRespCpfValue] = useState("");

  // Etapa 4
  const [cepValue, setCepValue] = useState("");
  const [street, setStreet] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [complementValue, setComplementValue] = useState("");
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
      // silently fail
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
      // silently fail
    } finally {
      setCepLoading(false);
    }
  }

  const disabled = isPending || cnpjLoading;

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

      {/* ── Etapa 1 — Dados principais ── */}
      <div className="space-y-4">
        <EtapaTitle num={1}>Dados principais</EtapaTitle>

        {/* Tipo de pessoa */}
        <div className="flex gap-3">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nome / Razão social */}
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
                  type === "PF" ? "Nome completo do cliente" : "Razão social"
                }
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Nome fantasia (PJ only) */}
          {type === "PJ" && (
            <div className="sm:col-span-2">
              <Field label="Nome fantasia">
                <input
                  name="trade_name"
                  type="text"
                  placeholder="Nome fantasia"
                  value={tradeNameValue}
                  onChange={(e) => setTradeNameValue(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {/* CPF / CNPJ */}
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

          {/* Telefone */}
          <Field label="Telefone principal" required>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="(82) 9 0000-0000"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              disabled={disabled}
              className={inputClass}
            />
          </Field>

          {/* E-mail */}
          <div className="sm:col-span-2">
            <Field label="E-mail do cliente para contato" required>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="email@exemplo.com.br"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Etapa 2 — Dados complementares (PF only) ── */}
      {type === "PF" && (
        <div className="space-y-4">
          <EtapaTitle num={2}>Dados complementares de pessoa física</EtapaTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="RG">
              <input
                name="rg"
                type="text"
                placeholder="0000000"
                disabled={isPending}
                className={inputClass}
              />
            </Field>

            <Field label="Órgão Expedidor">
              <input
                name="rg_orgao"
                type="text"
                placeholder="SSP/AL"
                disabled={isPending}
                className={inputClass}
              />
            </Field>

            <Field label="Data de Nascimento">
              <input
                name="birth_date"
                type="date"
                value={birthDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setBirthDate(val);
                  if (val && calcAge(val) < 18) setMenorIncapaz(true);
                }}
                disabled={isPending}
                className={inputClass}
              />
            </Field>

            <Field label="Estado Civil">
              <select
                name="estado_civil"
                defaultValue=""
                disabled={isPending}
                className={selectClass}
              >
                <option value="">— Selecione —</option>
                {ESTADOS_CIVIS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Gênero">
              <select
                name="genero"
                defaultValue=""
                disabled={isPending}
                className={selectClass}
              >
                <option value="">— Selecione —</option>
                {GENEROS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Profissão">
              <input
                name="profissao"
                type="text"
                placeholder="Ex.: Enfermeiro(a), Agricultor(a)…"
                disabled={isPending}
                className={inputClass}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Nacionalidade">
                <input
                  name="nacionalidade"
                  type="text"
                  placeholder="Brasileira"
                  defaultValue="Brasileira"
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Responsável Legal (PF, menor/incapaz) ── */}
      {type === "PF" && (
        <div className="space-y-4">
          <input
            type="hidden"
            name="menor_incapaz"
            value={menorIncapaz ? "true" : "false"}
          />

          {/* Toggle */}
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors duration-150 ${
              menorIncapaz
                ? "border-amber-400 bg-amber-50"
                : "border-border hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              checked={menorIncapaz}
              onChange={(e) => setMenorIncapaz(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 cursor-pointer rounded accent-amber-500"
            />
            <div>
              <p className="font-body text-sm font-semibold text-fg">
                Menor de idade ou incapaz
              </p>
              <p className="font-body text-xs text-muted">
                Preencha os dados do responsável legal — endereço não precisa
                ser repetido
              </p>
            </div>
          </label>

          {menorIncapaz && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading text-sm font-semibold text-amber-800">
                  Responsável Legal
                </span>
                <div className="flex-1 border-t border-amber-200" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nome completo do responsável" required>
                    <input
                      name="responsavel_nome"
                      type="text"
                      placeholder="Nome completo"
                      disabled={isPending}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="CPF do responsável">
                  <input
                    name="responsavel_cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={respCpfValue}
                    onChange={(e) =>
                      setRespCpfValue(maskCPFSimple(e.target.value))
                    }
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                <Field label="Parentesco / Relação">
                  <select
                    name="responsavel_parentesco"
                    defaultValue=""
                    disabled={isPending}
                    className={selectClass}
                  >
                    <option value="">— Selecione —</option>
                    {PARENTESCOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="RG do responsável">
                  <input
                    name="responsavel_rg"
                    type="text"
                    placeholder="0000000"
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                <Field label="Órgão Expedidor">
                  <input
                    name="responsavel_rg_orgao"
                    type="text"
                    placeholder="SSP/AL"
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                <Field label="Telefone do responsável">
                  <input
                    name="responsavel_telefone"
                    type="tel"
                    placeholder="(82) 9 0000-0000"
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                <Field label="E-mail do responsável">
                  <input
                    name="responsavel_email"
                    type="email"
                    placeholder="email@exemplo.com.br"
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3 — Acesso e parceria ── */}
      <div className="space-y-4">
        <EtapaTitle num={type === "PF" ? 3 : 2}>Acesso e parceria</EtapaTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Senha do cliente">
            <input
              name="senha_cliente"
              type="text"
              placeholder="Código de acesso do cliente"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Parceria / Origem">
            <input
              name="parceria"
              type="text"
              placeholder="Ex.: Indicação, Google, INSS…"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Etapa 4 — Endereço ── */}
      <div className="space-y-4">
        <EtapaTitle num={type === "PF" ? 4 : 3}>Endereço</EtapaTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
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
                  disabled={disabled}
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
                placeholder="Rua, Av., Travessa…"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={disabled}
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
                placeholder="123"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-4">
            <Field label="Complemento">
              <input
                name="complement"
                type="text"
                placeholder="Apto, Sala, Bloco…"
                value={complementValue}
                onChange={(e) => setComplementValue(e.target.value)}
                disabled={disabled}
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
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={disabled}
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
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={disabled}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-1">
            <Field label="Estado" required>
              <select
                name="state"
                required
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                disabled={disabled}
                className={selectClass}
              >
                <option value="">UF</option>
                {ESTADOS_UF.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-heading text-base font-semibold text-fg">
            Observações
          </h2>
          <div className="flex-1 border-t border-border" />
        </div>
        <textarea
          name="notes"
          rows={3}
          placeholder="Anotações internas sobre o cliente…"
          disabled={isPending}
          className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
        />
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
          disabled={disabled}
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
