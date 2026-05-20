"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  createPericiaAction,
  type PericiaFormState,
} from "@/lib/pericia-actions";
import { TIPO_LABELS, type TipoPericia } from "@/lib/pericias-types";
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

const TIPO_LIST: TipoPericia[] = [
  "pericia_administrativa",
  "pericia_judicial",
  "avaliacao_social_administrativa",
  "avaliacao_social_judicial",
  "prorrogacao_beneficio",
];

const TIPO_DESCS: Record<TipoPericia, string> = {
  pericia_administrativa: "Realizada por perito do INSS na agência",
  pericia_judicial: "Determinada pelo juiz no âmbito do processo",
  avaliacao_social_administrativa: "Avaliação por assistente social no INSS",
  avaliacao_social_judicial:
    "Avaliação por assistente social determinada judicialmente",
  prorrogacao_beneficio: "Prorrogação de benefício previdenciário em curso",
};

interface Props {
  clients: { id: string; name: string }[];
  processos: {
    id: string;
    client_id: string;
    tipo_acao: string;
    numero: string | null;
  }[];
  defaultClientId?: string;
}

export default function NewPericiaForm({
  clients,
  processos,
  defaultClientId,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    PericiaFormState,
    FormData
  >(createPericiaAction, null);

  const [selectedTipo, setSelectedTipo] = useState<TipoPericia | "">("");
  const [selectedClientId, setSelectedClientId] = useState(
    defaultClientId ?? ""
  );

  const clientProcessos = processos.filter(
    (p) => p.client_id === selectedClientId
  );
  const isProrrogacao = selectedTipo === "prorrogacao_beneficio";

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

      {/* ── Tipo de perícia ── */}
      <div className="space-y-4">
        <SectionTitle>Tipo de perícia</SectionTitle>
        <input type="hidden" name="tipo" value={selectedTipo} />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TIPO_LIST.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setSelectedTipo(tipo)}
              disabled={isPending}
              className={`rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer ${
                selectedTipo === tipo
                  ? "border-primary bg-primary/5"
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

      {/* ── Vinculação ── */}
      <div className="space-y-4">
        <SectionTitle>Vinculação</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente" required>
            <select
              name="client_id"
              required
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
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
          <Field label="Processo vinculado">
            <select
              name="processo_id"
              disabled={isPending || !selectedClientId}
              className={selectClass}
            >
              <option value="">Nenhum / não vinculado</option>
              {clientProcessos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero ? `${p.numero} — ` : ""}
                  {p.tipo_acao}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Dados da perícia ── */}
      <div className="space-y-4">
        <SectionTitle>Dados da perícia</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data da perícia" required>
            <input
              name="data_pericia"
              type="date"
              required
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Hora">
            <input
              name="hora_pericia"
              type="time"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Local">
              <input
                name="local_pericia"
                type="text"
                placeholder="Ex: Agência INSS Centro, Fórum Trabalhista…"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Perito">
            <input
              name="perito"
              type="text"
              placeholder="Nome do perito responsável"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Especialidade">
            <input
              name="especialidade"
              type="text"
              placeholder="Ex: Ortopedia, Cardiologia…"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Status e resultado ── */}
      <div className="space-y-4">
        <SectionTitle>Status e resultado</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" required>
            <select
              name="status"
              defaultValue="agendado"
              disabled={isPending}
              className={selectClass}
            >
              <option value="agendado">Agendado</option>
              <option value="realizado">Realizado</option>
              <option value="remarcado">Remarcado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Field>
          <Field label="Resultado">
            <select
              name="resultado"
              defaultValue=""
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Sem resultado ainda</option>
              <option value="favoravel">Favorável</option>
              <option value="desfavoravel">Desfavorável</option>
              <option value="pendente">Pendente</option>
              <option value="inconclusivo">Inconclusivo</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Prorrogação de benefício (condicional) ── */}
      {isProrrogacao && (
        <div className="space-y-4">
          <SectionTitle>Dados do benefício</SectionTitle>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Número do benefício">
              <input
                name="beneficio_numero"
                type="text"
                placeholder="Ex: 123.456.789-0"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
            <Field label="Tipo do benefício">
              <input
                name="beneficio_tipo"
                type="text"
                placeholder="Ex: Auxílio-doença, Aposentadoria por invalidez…"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
            <Field label="Data fim atual do benefício">
              <input
                name="data_fim_beneficio"
                type="date"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
            <Field label="Nova data fim pretendida">
              <input
                name="nova_data_fim"
                type="date"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="observacoes"
            rows={3}
            placeholder="Anotações internas sobre a perícia…"
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/pericias"
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
            "Salvar perícia"
          )}
        </button>
      </div>
    </form>
  );
}
