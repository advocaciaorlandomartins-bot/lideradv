"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClientAction, type ClientFormState } from "@/lib/client-actions";
import { SpinnerIcon } from "@/components/icons";
import type { Colaborador } from "@/lib/colaboradores-db";

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

function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11;
  if (r >= 10) r = 0;
  return r === +d[10];
}

const todayISO = new Date().toISOString().split("T")[0];

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

function formatMoneyInput(raw: string): string {
  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx !== -1) {
    const intDigits = raw.slice(0, commaIdx).replace(/\D/g, "");
    const decDigits = raw
      .slice(commaIdx + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    const intNum = intDigits ? parseInt(intDigits, 10) : 0;
    return `${intNum.toLocaleString("pt-BR")},${decDigits}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("pt-BR");
}

function normalizeMoneyBlur(v: string): string {
  if (!v) return "";
  const commaIdx = v.indexOf(",");
  if (commaIdx === -1) return v + ",00";
  const dec = v
    .slice(commaIdx + 1)
    .padEnd(2, "0")
    .slice(0, 2);
  return v.slice(0, commaIdx + 1) + dec;
}

function parseMoney(display: string): string {
  if (!display) return "";
  return display.replace(/\./g, "").replace(",", ".");
}

const CARGO_LABELS: Record<string, string> = {
  advogado: "Advogado(a)",
  advogado_associado: "Advogado(a) Assoc.",
  estagiario: "Estagiário(a)",
  recepcao: "Recepção",
  agente: "Agente",
  comercial: "Comercial",
};

const ADVOGADO_CARGOS = new Set(["advogado", "advogado_associado"]);

export default function NewClientForm({
  colaboradores,
}: {
  colaboradores: Colaborador[];
}) {
  const [state, formAction, isPending] = useActionState<
    ClientFormState,
    FormData
  >(createClientAction, null);

  // Etapa 1
  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [nameValue, setNameValue] = useState("");
  const [tradeNameValue, setTradeNameValue] = useState("");
  const [docValue, setDocValue] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [emailValue, setEmailValue] = useState("");

  // Etapa 2 (PF)
  const [birthDate, setBirthDate] = useState("");
  const [menorIncapaz, setMenorIncapaz] = useState(false);
  const [respCpfValue, setRespCpfValue] = useState("");

  // Etapa 3 — Origem
  const [origemTipo, setOrigemTipo] = useState("");
  const [origemTexto, setOrigemTexto] = useState("");
  const [indicadorId, setIndicadorId] = useState("");
  const [indicadorCargo, setIndicadorCargo] = useState("");
  const [indicadorTipoTrabalho, setIndicadorTipoTrabalho] = useState("");
  const [comissaoTipo, setComissaoTipo] = useState("");
  const [comissaoValor, setComissaoValor] = useState("");

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
    setCpfError("");
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
      setCpfError("");
    } else {
      const digits = raw.replace(/\D/g, "").slice(0, 14);
      setDocValue(maskCNPJ(raw));
      if (digits.length === 14) fetchCnpj(digits);
    }
  }

  function handleDocBlur() {
    if (type === "PF" && docValue.replace(/\D/g, "").length === 11) {
      if (!validarCPF(docValue))
        setCpfError("CPF inválido. Verifique os dígitos.");
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
                onBlur={handleDocBlur}
                disabled={isPending}
                className={`${inputClass} pr-10 ${cpfError ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {cnpjLoading && (
                <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              )}
            </div>
            {cpfError && (
              <p className="mt-1 font-body text-xs text-red-600">{cpfError}</p>
            )}
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
            <Field label="E-mail do cliente para contato">
              <input
                name="email"
                type="email"
                autoComplete="email"
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
                max={todayISO}
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

        {/* Hidden fields for new structured origin */}
        <input type="hidden" name="origem_tipo" value={origemTipo} />
        <input type="hidden" name="origem_texto" value={origemTexto} />
        <input type="hidden" name="indicador_id" value={indicadorId} />
        <input
          type="hidden"
          name="indicador_tipo_trabalho"
          value={indicadorTipoTrabalho}
        />
        <input type="hidden" name="comissao_tipo" value={comissaoTipo} />
        <input
          type="hidden"
          name="comissao_valor"
          value={
            comissaoTipo === "valor"
              ? parseMoney(comissaoValor)
              : comissaoValor.replace(",", ".")
          }
        />

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

          <Field label="Origem / Parceria">
            <select
              value={origemTipo}
              onChange={(e) => {
                setOrigemTipo(e.target.value);
                setOrigemTexto("");
                setIndicadorId("");
                setIndicadorCargo("");
                setIndicadorTipoTrabalho("");
                setComissaoTipo("");
                setComissaoValor("");
              }}
              disabled={isPending}
              className={selectClass}
            >
              <option value="">— Selecione a origem —</option>
              <option value="escritorio">Escritório</option>
              <option value="rede_social">Rede Social</option>
              <option value="indicacao">Indicação</option>
              <option value="trafego_pago">Tráfego Pago</option>
              <option value="outros">Outros</option>
            </select>
          </Field>

          {origemTipo === "outros" && (
            <div className="sm:col-span-2">
              <Field label="Descreva a origem">
                <input
                  type="text"
                  value={origemTexto}
                  onChange={(e) => setOrigemTexto(e.target.value)}
                  placeholder="Ex.: Indicação de parceiro externo, panfleto…"
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {origemTipo === "indicacao" && (
            <>
              <div className="sm:col-span-2">
                <Field label="Colaborador indicador">
                  <select
                    value={indicadorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setIndicadorId(id);
                      const col = colaboradores.find((c) => c.id === id);
                      setIndicadorCargo(col?.cargo ?? "");
                      setIndicadorTipoTrabalho("");
                    }}
                    disabled={isPending}
                    className={selectClass}
                  >
                    <option value="">— Selecione o colaborador —</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} — {CARGO_LABELS[c.cargo] ?? c.cargo}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {indicadorId && ADVOGADO_CARGOS.has(indicadorCargo) && (
                <div className="sm:col-span-2">
                  <Field label="Tipo de trabalho do indicador">
                    <select
                      value={indicadorTipoTrabalho}
                      onChange={(e) => setIndicadorTipoTrabalho(e.target.value)}
                      disabled={isPending}
                      className={selectClass}
                    >
                      <option value="">— Selecione —</option>
                      <option value="administrativo">Administrativo</option>
                      <option value="judicial">Judicial</option>
                      <option value="ambos">
                        Ambos (Administrativo + Judicial)
                      </option>
                    </select>
                  </Field>
                </div>
              )}

              <Field label="Tipo de comissão">
                <select
                  value={comissaoTipo}
                  onChange={(e) => {
                    setComissaoTipo(e.target.value);
                    setComissaoValor("");
                  }}
                  disabled={isPending}
                  className={selectClass}
                >
                  <option value="">— Selecione —</option>
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor">Valor fixo (R$)</option>
                </select>
              </Field>

              {comissaoTipo === "percentual" && (
                <Field label="Percentual (%)">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={comissaoValor}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9,]/g, "");
                        setComissaoValor(v);
                      }}
                      placeholder="10,00"
                      disabled={isPending}
                      className={`${inputClass} pr-9`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted">
                      %
                    </span>
                  </div>
                </Field>
              )}

              {comissaoTipo === "valor" && (
                <Field label="Valor da comissão (R$)">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={comissaoValor}
                      onChange={(e) =>
                        setComissaoValor(formatMoneyInput(e.target.value))
                      }
                      onBlur={(e) =>
                        setComissaoValor(normalizeMoneyBlur(e.target.value))
                      }
                      placeholder="0,00"
                      disabled={isPending}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>
              )}
            </>
          )}
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
