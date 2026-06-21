"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createProcessoAction,
  type ProcessoFormState,
} from "@/lib/processo-actions";
import { SpinnerIcon } from "@/components/icons";

const TIPOS_ACAO = [
  "B21 - Pensão por morte",
  "B25 - Auxílio-reclusão",
  "B31 - Auxílio-doença",
  "B32 - Aposentadoria por invalidez",
  "B41 - Aposentadoria por idade",
  "B42 - Aposentadoria por tempo de contribuição",
  "B46 - Aposentadoria especial",
  "B80 - Salário Maternidade",
  "B87 - BPC à pessoa com deficiência",
  "B88 - BPC à pessoa idosa",
  "B91 - Auxílio-doença acidentário",
  "B92 - Aposentadoria por invalidez acidentária",
  "B94 - Auxílio-acidente",
  "CP - Complemento Positivo",
  "Revisão do Benefício",
  "Acréscimo de 25%",
];

const AREAS = [
  "Cível",
  "Criminal",
  "Trabalhista",
  "Família",
  "Previdenciário",
  "Tributário",
  "Administrativo",
  "Consumidor",
  "Imobiliário",
  "Empresarial",
  "Outro",
];

const FASES = [
  "Administrativo INSS",
  "Conhecimento",
  "Instrução",
  "Julgamento",
  "Recurso",
  "Execução",
  "Cumprimento de Sentença",
  "Arquivado",
  "Aguardando",
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

interface Props {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
  redirectTo?: string;
}

export default function NewProcessoForm({
  clients,
  defaultClientId,
  redirectTo,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    ProcessoFormState,
    FormData
  >(createProcessoAction, null);

  const [tipoAcaoSel, setTipoAcaoSel] = useState("");
  const [tipoAcaoManual, setTipoAcaoManual] = useState("");
  const [cnpjWarning, setCnpjWarning] = useState("");

  const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
  const todayISO = new Date().toISOString().split("T")[0];

  function handleNumeroBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v && !CNJ_REGEX.test(v)) {
      setCnpjWarning("Formato esperado: 0000000-00.0000.0.00.0000");
    } else {
      setCnpjWarning("");
    }
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {redirectTo && (
        <input type="hidden" name="redirect_to" value={redirectTo} />
      )}
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* ── Cliente ── */}
      <div className="space-y-4">
        <SectionTitle>Cliente</SectionTitle>
        <div className="mt-4">
          <Field label="Cliente" required>
            <select
              name="client_id"
              required
              defaultValue={defaultClientId ?? ""}
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Selecione o cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Dados do processo ── */}
      <div className="space-y-4">
        <SectionTitle>Dados do processo</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Número do processo (CNJ)">
              <input
                name="numero"
                type="text"
                placeholder="0000000-00.0000.0.00.0000"
                onBlur={handleNumeroBlur}
                onChange={() => setCnpjWarning("")}
                disabled={isPending}
                className={`${inputClass} ${cnpjWarning ? "border-amber-400 focus:border-amber-400 focus:ring-amber-100" : ""}`}
              />
              {cnpjWarning && (
                <p className="mt-1 font-body text-xs text-amber-600">
                  {cnpjWarning}
                </p>
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tipo de ação" required>
              <select
                value={tipoAcaoSel}
                onChange={(e) => {
                  setTipoAcaoSel(e.target.value);
                  if (e.target.value !== "outro") setTipoAcaoManual("");
                }}
                disabled={isPending}
                className={selectClass}
              >
                <option value="">— Selecione —</option>
                {TIPOS_ACAO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="outro">Outro (digitar manualmente)…</option>
              </select>
              {tipoAcaoSel === "outro" ? (
                <input
                  name="tipo_acao"
                  type="text"
                  required
                  value={tipoAcaoManual}
                  onChange={(e) => setTipoAcaoManual(e.target.value)}
                  placeholder="Digite o tipo de ação…"
                  disabled={isPending}
                  className={inputClass + " mt-2"}
                />
              ) : (
                <input type="hidden" name="tipo_acao" value={tipoAcaoSel} />
              )}
            </Field>
          </div>
          <Field label="Área jurídica" required>
            <select
              name="area"
              required
              defaultValue=""
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fase processual">
            <select
              name="fase"
              defaultValue=""
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {FASES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Data de distribuição">
            <input
              name="data_distribuicao"
              type="date"
              max={todayISO}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Previdenciário INSS ── */}
      <div className="space-y-4">
        <SectionTitle>Previdenciário — INSS & Honorários</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="DER — Data de Entrada do Requerimento">
            <input
              name="der"
              type="date"
              max={todayISO}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="DIB — Data de Início do Benefício">
            <input
              name="dib"
              type="date"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="DCB — Data de Cessação do Benefício">
            <input
              name="dcb"
              type="date"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Data do requerimento no INSS">
            <input
              name="data_protocolo_inss"
              type="date"
              max={todayISO}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Nº protocolo INSS">
            <input
              name="protocolo_inss"
              type="text"
              placeholder="Ex: 1234567890"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Agência INSS">
              <input
                name="agencia_inss"
                type="text"
                placeholder="Ex: APS Maceió Centro"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Resultado administrativo">
            <select
              name="resultado_admin"
              defaultValue=""
              disabled={isPending}
              className={selectClass}
            >
              <option value="">— Aguardando —</option>
              <option value="deferido">Deferido</option>
              <option value="indeferido">Indeferido</option>
              <option value="em_analise">Em análise</option>
              <option value="recurso">Em recurso administrativo</option>
            </select>
          </Field>

          <Field label="Data do resultado">
            <input
              name="data_resultado_admin"
              type="date"
              max={todayISO}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Motivo do indeferimento (se aplicável)">
              <textarea
                name="motivo_indeferimento"
                rows={2}
                placeholder="Descreva o motivo informado pelo INSS…"
                disabled={isPending}
                className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
              />
            </Field>
          </div>

          <Field label="Nº benefício concedido (pós-deferimento)">
            <input
              name="num_beneficio_concedido"
              type="text"
              placeholder="Ex: 123456789-0"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Modelo de honorários">
            <select
              name="modelo_honorario"
              defaultValue=""
              disabled={isPending}
              className={selectClass}
            >
              <option value="">— Selecione —</option>
              <option value="fixo">Fixo</option>
              <option value="percentual">Percentual sobre diferença</option>
              <option value="misto">Misto (fixo + percentual)</option>
              <option value="sucumbencia">Sucumbência (UNIÃO paga)</option>
              <option value="risco">Sem custo inicial (risco)</option>
            </select>
          </Field>

          <Field label="Valor honorário fixo (R$)">
            <input
              name="valor_honorario"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Percentual de honorários (%)">
            <input
              name="percentual_honorario"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 20,00"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Tribunal ── */}
      <div className="space-y-4">
        <SectionTitle>Tribunal</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Vara / Juízo">
              <input
                name="vara"
                type="text"
                placeholder="Ex: 1ª Vara do Trabalho de São Paulo"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Comarca">
              <input
                name="comarca"
                type="text"
                placeholder="Ex: São Paulo"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="notas"
            rows={3}
            placeholder="Anotações internas sobre o processo…"
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/processos"
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
            "Salvar processo"
          )}
        </button>
      </div>
    </form>
  );
}
