"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  createRemuneracaoAction,
  type RemuneracaoFormState,
} from "@/lib/remuneracao-actions";
import {
  TIPO_LABELS,
  TIPO_DESCS,
  type TipoRemuneracao,
} from "@/lib/remuneracoes-types";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
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

const TIPO_COLORS_CARD: Record<TipoRemuneracao, string> = {
  salario: "border-blue-400 bg-blue-50",
  comissao: "border-emerald-400 bg-emerald-50",
  bonificacao: "border-amber-400 bg-amber-50",
};

const TIPO_LIST: TipoRemuneracao[] = ["salario", "comissao", "bonificacao"];

interface Props {
  colaboradores: {
    id: string;
    nome: string;
    cargo: string;
    salario_mensal: number | null;
  }[];
  processos: {
    id: string;
    client_id: string;
    tipo_acao: string;
    numero: string | null;
  }[];
  defaultColaboradorId?: string;
  defaultTipo?: string;
}

export default function NewRemuneracaoForm({
  colaboradores,
  processos,
  defaultColaboradorId,
  defaultTipo,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    RemuneracaoFormState,
    FormData
  >(createRemuneracaoAction, null);

  const [selectedTipo, setSelectedTipo] = useState<TipoRemuneracao | "">(
    (defaultTipo as TipoRemuneracao) ?? ""
  );
  const [selectedColaboradorId, setSelectedColaboradorId] = useState(
    defaultColaboradorId ?? ""
  );
  const [valorInput, setValorInput] = useState("");

  const showCompetencia =
    selectedTipo === "salario" || selectedTipo === "comissao";
  const showProcesso = selectedTipo === "comissao";

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

      {/* ── Tipo ── */}
      <div className="space-y-4">
        <SectionTitle>Tipo de remuneração</SectionTitle>
        <input type="hidden" name="tipo" value={selectedTipo} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TIPO_LIST.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setSelectedTipo(tipo);
                if (tipo === "salario" && selectedColaboradorId) {
                  const colab = colaboradores.find(
                    (c) => c.id === selectedColaboradorId
                  );
                  if (colab?.salario_mensal)
                    setValorInput(String(colab.salario_mensal));
                }
              }}
              disabled={isPending}
              className={`rounded-xl border-2 p-5 text-left transition-all duration-150 cursor-pointer ${
                selectedTipo === tipo
                  ? TIPO_COLORS_CARD[tipo]
                  : "border-border bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-body text-sm font-semibold text-fg">
                {TIPO_LABELS[tipo]}
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                {TIPO_DESCS[tipo]}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Colaborador ── */}
      <div className="space-y-4">
        <SectionTitle>Colaborador</SectionTitle>
        <div className="mt-4">
          <Field label="Selecione o colaborador" required>
            <select
              name="colaborador_id"
              required
              value={selectedColaboradorId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedColaboradorId(id);
                if (selectedTipo === "salario" && id) {
                  const colab = colaboradores.find((c) => c.id === id);
                  if (colab?.salario_mensal)
                    setValorInput(String(colab.salario_mensal));
                  else setValorInput("");
                }
              }}
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} —{" "}
                  {CARGO_LABELS[c.cargo as CargoColaborador] ?? c.cargo}
                  {c.salario_mensal
                    ? ` · R$ ${c.salario_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Valores ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e datas</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor (R$)" required>
            <input
              name="valor"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              required
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          {showCompetencia && (
            <Field label="Competência (mês/ano)">
              <input
                name="competencia"
                type="month"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Data de pagamento">
            <input
              name="data_pagamento"
              type="date"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Status">
            <select
              name="status"
              defaultValue="pendente"
              disabled={isPending}
              className={selectClass}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Processo (comissão) ── */}
      {showProcesso && (
        <div className="space-y-4">
          <SectionTitle>Processo vinculado</SectionTitle>
          <div className="mt-4">
            <Field label="Processo (opcional)">
              <select
                name="processo_id"
                defaultValue=""
                disabled={isPending}
                className={selectClass}
              >
                <option value="">Nenhum</option>
                {processos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero ? `${p.numero} — ` : ""}
                    {p.tipo_acao}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      {/* ── Descrição ── */}
      <div>
        <SectionTitle>
          {selectedTipo === "bonificacao"
            ? "Motivo / Justificativa"
            : "Descrição"}
        </SectionTitle>
        <div className="mt-4">
          <textarea
            name="descricao"
            rows={3}
            placeholder={
              selectedTipo === "bonificacao"
                ? "Ex: Meta batida em Março, Premiação por desempenho…"
                : selectedTipo === "comissao"
                  ? "Ex: 10% sobre honorários do processo XYZ…"
                  : "Observações sobre o salário…"
            }
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/financeiro?tab=remuneracoes"
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
            "Lançar remuneração"
          )}
        </button>
      </div>
    </form>
  );
}
