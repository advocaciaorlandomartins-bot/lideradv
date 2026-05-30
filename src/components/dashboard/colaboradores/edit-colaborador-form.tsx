"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  updateColaboradorAction,
  type ColaboradorFormState,
} from "@/lib/colaborador-actions";
import type { ColaboradorFull } from "@/lib/colaboradores-db";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
import { PlusIcon } from "@/components/icons";
import { SpinnerIcon } from "@/components/icons";

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

const CARGOS_COM_OAB: CargoColaborador[] = ["advogado", "advogado_associado"];

interface Props {
  colaborador: ColaboradorFull;
}

export default function EditColaboradorForm({ colaborador }: Props) {
  const boundAction = useCallback(
    (prev: ColaboradorFormState, formData: FormData) =>
      updateColaboradorAction(colaborador.id, prev, formData),
    [colaborador.id]
  );
  const [state, formAction, isPending] = useActionState<
    ColaboradorFormState,
    FormData
  >(boundAction, null);

  const isKnownCargo = CARGO_LIST.includes(
    colaborador.cargo as CargoColaborador
  );
  const [selectedCargo, setSelectedCargo] = useState<string>(
    isKnownCargo ? colaborador.cargo : "__custom__"
  );
  const [customCargo, setCustomCargo] = useState(
    isKnownCargo ? "" : colaborador.cargo
  );
  const [selectedStatus, setSelectedStatus] = useState<"ativo" | "inativo">(
    colaborador.status
  );

  const isCustom = selectedCargo === "__custom__";
  const cargoValue = isCustom ? customCargo.trim() : selectedCargo;
  const showOab = CARGOS_COM_OAB.includes(selectedCargo as CargoColaborador);

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
        <input type="hidden" name="cargo" value={cargoValue} />
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
            </button>
          ))}

          {/* Novo cargo personalizado */}
          <button
            type="button"
            onClick={() => setSelectedCargo("__custom__")}
            disabled={isPending}
            className={`rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer ${
              isCustom
                ? "border-violet-400 bg-violet-50"
                : "border-dashed border-border bg-white hover:border-slate-400"
            }`}
          >
            <p className="font-body text-sm font-semibold text-fg flex items-center gap-1.5">
              <PlusIcon className="h-4 w-4 text-muted" />
              Outro cargo
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Defina um cargo personalizado
            </p>
          </button>
        </div>

        {/* Input para cargo personalizado */}
        {isCustom && (
          <div className="mt-3">
            <label className={labelClass}>
              Nome do cargo<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Paralegal, Perito, Coordenador…"
              value={customCargo}
              onChange={(e) => setCustomCargo(e.target.value)}
              disabled={isPending}
              autoFocus
              className={inputClass}
            />
          </div>
        )}
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
                defaultValue={colaborador.nome}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              defaultValue={colaborador.email ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              type="tel"
              defaultValue={colaborador.telefone ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          {showOab && (
            <Field label="Número OAB">
              <input
                name="oab"
                type="text"
                defaultValue={colaborador.oab ?? ""}
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
              defaultValue={colaborador.salario_mensal ?? ""}
              placeholder="0,00"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Data de admissão">
            <input
              name="data_admissao"
              type="date"
              defaultValue={colaborador.data_admissao_iso ?? ""}
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
                defaultValue={colaborador.data_demissao_iso ?? ""}
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
            defaultValue={colaborador.observacoes ?? ""}
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href={`/dashboard/colaboradores/${colaborador.id}`}
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
