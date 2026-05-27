"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  updateProcessoAction,
  type ProcessoFormState,
} from "@/lib/processo-actions";
import type { ProcessoFull } from "@/lib/processos-db";
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
  processo: ProcessoFull & { data_distribuicao_iso?: string | null };
  clients: { id: string; name: string }[];
}

export default function EditProcessoForm({ processo, clients }: Props) {
  const boundAction = updateProcessoAction.bind(null, processo.id);
  const [state, formAction, isPending] = useActionState<
    ProcessoFormState,
    FormData
  >(boundAction, null);

  const inList = TIPOS_ACAO.includes(processo.tipo_acao ?? "");
  const [tipoAcaoSel, setTipoAcaoSel] = useState(
    inList ? (processo.tipo_acao ?? "") : processo.tipo_acao ? "outro" : ""
  );
  const [tipoAcaoManual, setTipoAcaoManual] = useState(
    inList ? "" : (processo.tipo_acao ?? "")
  );

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

      {/* ── Cliente ── */}
      <div className="space-y-4">
        <SectionTitle>Cliente</SectionTitle>
        <div className="mt-4">
          <Field label="Cliente" required>
            <select
              name="client_id"
              required
              defaultValue={processo.client_id}
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
                defaultValue={processo.numero ?? ""}
                disabled={isPending}
                className={inputClass}
              />
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
              defaultValue={processo.area}
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
              defaultValue={processo.fase ?? ""}
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
                defaultValue={processo.vara ?? ""}
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
                defaultValue={processo.comarca ?? ""}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Parte contrária ── */}
      <div className="space-y-4">
        <SectionTitle>Parte contrária</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome">
              <input
                name="parte_contraria"
                type="text"
                placeholder="Nome da parte contrária"
                defaultValue={processo.parte_contraria ?? ""}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="CPF / CNPJ">
            <input
              name="parte_contraria_doc"
              type="text"
              placeholder="000.000.000-00"
              defaultValue={processo.parte_contraria_doc ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Financeiro ── */}
      <div className="space-y-4">
        <SectionTitle>Financeiro</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor da causa (R$)">
            <input
              name="valor_causa"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={processo.valor_causa ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Data de distribuição">
            <input
              name="data_distribuicao"
              type="date"
              defaultValue={processo.data_distribuicao_iso ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Status ── */}
      <div>
        <SectionTitle>Status</SectionTitle>
        <div className="mt-4 max-w-xs">
          <Field label="Status do processo">
            <select
              name="status"
              defaultValue={processo.status}
              disabled={isPending}
              className={selectClass}
            >
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </Field>
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
            defaultValue={processo.notas ?? ""}
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href={`/dashboard/processos/${processo.id}`}
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
