"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  createColaboradorAction,
  type ColaboradorFormState,
} from "@/lib/colaborador-actions";
import { CARGO_LABELS, type CargoColaborador } from "@/lib/colaboradores-types";
import { SpinnerIcon, PlusIcon, XMarkIcon } from "@/components/icons";

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

const CARGO_LIST: CargoColaborador[] = [
  "advogado",
  "advogado_associado",
  "estagiario",
  "agente",
  "recepcao",
  "comercial",
];

const CARGO_DESCS: Record<CargoColaborador, string> = {
  advogado: "Advogado sócio ou titular do escritório",
  advogado_associado: "Advogado associado, sem vínculo societário",
  estagiario: "Estudante de direito em estágio",
  agente: "Agente de acompanhamento de processos",
  recepcao: "Atendimento e recepção de clientes",
  comercial: "Captação e relacionamento comercial",
};

const CARGOS_COM_OAB: CargoColaborador[] = ["advogado", "advogado_associado"];

export default function NewColaboradorForm() {
  const [state, formAction, isPending] = useActionState<
    ColaboradorFormState,
    FormData
  >(createColaboradorAction, null);

  const [selectedCargo, setSelectedCargo] = useState<CargoColaborador | "">("");
  const [selectedStatus, setSelectedStatus] = useState<"ativo" | "inativo">(
    "ativo"
  );
  const [showComissao, setShowComissao] = useState(false);

  const showOab =
    selectedCargo !== "" &&
    CARGOS_COM_OAB.includes(selectedCargo as CargoColaborador);

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

      {/* ── Cargo ── */}
      <div className="space-y-4">
        <SectionTitle>Cargo</SectionTitle>
        <input type="hidden" name="cargo" value={selectedCargo} />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARGO_LIST.map((cargo) => (
            <button
              key={cargo}
              type="button"
              onClick={() => setSelectedCargo(cargo)}
              disabled={isPending}
              className={`rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer ${
                selectedCargo === cargo
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-body text-sm font-semibold text-fg">
                {CARGO_LABELS[cargo]}
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                {CARGO_DESCS[cargo]}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Dados pessoais ── */}
      <div className="space-y-4">
        <SectionTitle>Dados pessoais</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome completo" required>
              <input
                name="nome"
                type="text"
                required
                placeholder="Nome do colaborador"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              placeholder="email@exemplo.com"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              type="tel"
              placeholder="(00) 00000-0000"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          {showOab && (
            <Field label="Número OAB">
              <input
                name="oab"
                type="text"
                placeholder="Ex: SP 123.456"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </div>

      {/* ── Vínculo ── */}
      <div className="space-y-4">
        <SectionTitle>Vínculo</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Salário mensal (R$)">
            <input
              name="salario_mensal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Data de admissão">
            <input
              name="data_admissao"
              type="date"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as "ativo" | "inativo")
              }
              disabled={isPending}
              className={selectClass}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </Field>
          {selectedStatus === "inativo" && (
            <Field label="Data de demissão">
              <input
                name="data_demissao"
                type="date"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="observacoes"
            rows={3}
            placeholder="Anotações internas sobre o colaborador…"
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Comissão inicial ── */}
      <div className="space-y-4">
        <SectionTitle>Comissão inicial</SectionTitle>
        <p className="font-body text-xs text-muted -mt-2">
          Opcional — registre uma comissão já no cadastro.
        </p>

        <div className="flex flex-wrap gap-3 mt-2">
          {!showComissao && (
            <button
              type="button"
              onClick={() => setShowComissao(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-emerald-300 px-4 py-2.5 font-body text-sm font-semibold text-emerald-600 transition-colors duration-150 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar comissão
            </button>
          )}
        </div>

        {/* Comissão */}
        {showComissao && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-body text-xs font-bold text-emerald-700">
                Comissão
              </span>
              <button
                type="button"
                onClick={() => setShowComissao(false)}
                disabled={isPending}
                className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600 cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Valor (R$)">
                <input
                  name="comissao_valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>
              <Field label="Competência (mês/ano)">
                <input
                  name="comissao_competencia"
                  type="month"
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <input
                    name="comissao_descricao"
                    type="text"
                    placeholder="Ex: 10% sobre honorários do processo XYZ…"
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/colaboradores"
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
            "Salvar colaborador"
          )}
        </button>
      </div>
    </form>
  );
}
