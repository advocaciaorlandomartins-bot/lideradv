"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateMeusDadosAction,
  type MeusDadosFormState,
} from "@/lib/colaborador-actions";
import type { ColaboradorFull } from "@/lib/colaboradores-db";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
import DocumentsSection from "@/components/dashboard/documents/documents-section";
import type { Documento } from "@/lib/documents-db";
import { SpinnerIcon, CheckCircleIcon } from "@/components/icons";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-white px-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelClass = "block font-body text-sm font-semibold text-fg mb-1.5";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-32 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-body text-sm text-fg">{value}</span>
    </div>
  );
}

export default function MeusDadosContent({
  colaborador,
  documentos,
}: {
  colaborador: ColaboradorFull;
  documentos: Documento[];
}) {
  const [state, formAction, isPending] = useActionState<
    MeusDadosFormState,
    FormData
  >(updateMeusDadosAction, null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className="space-y-6">
      {/* Dados administrativos — só leitura, quem muda é o admin */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-2">
        <h2 className="font-heading text-base font-semibold text-fg mb-2">
          Dados do cargo
        </h2>
        <InfoRow label="Nome" value={colaborador.nome} />
        <InfoRow
          label="Cargo"
          value={
            CARGO_LABELS[colaborador.cargo as CargoColaborador] ??
            colaborador.cargo
          }
        />
        {colaborador.oab && (
          <InfoRow
            label="OAB"
            value={
              colaborador.oab_uf
                ? `${colaborador.oab}/${colaborador.oab_uf}`
                : colaborador.oab
            }
          />
        )}
        <InfoRow
          label="Status"
          value={colaborador.status === "ativo" ? "Ativo" : "Inativo"}
        />
        <p className="mt-2 font-body text-xs text-muted">
          Esses dados só o administrador altera. Se algo aqui estiver errado,
          avise o escritório.
        </p>
      </div>

      {/* Autoatendimento — contato e endereço */}
      <form
        action={formAction}
        className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-fg">
            Meus dados de contato
          </h2>
          {showSaved && (
            <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
              Salvo!
            </span>
          )}
        </div>
        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <input
              name="telefone"
              type="tel"
              defaultValue={colaborador.telefone ?? ""}
              placeholder="(00) 00000-0000"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              defaultValue={colaborador.email ?? ""}
              placeholder="email@exemplo.com"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="CEP">
            <input
              name="cep"
              type="text"
              defaultValue={colaborador.cep ?? ""}
              placeholder="00000-000"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Rua/Logradouro">
              <input
                name="street"
                type="text"
                defaultValue={colaborador.street ?? ""}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Número">
            <input
              name="addr_number"
              type="text"
              defaultValue={colaborador.addr_number ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Complemento">
            <input
              name="complement"
              type="text"
              defaultValue={colaborador.complement ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Bairro">
            <input
              name="neighborhood"
              type="text"
              defaultValue={colaborador.neighborhood ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Cidade">
              <input
                name="city"
                type="text"
                defaultValue={colaborador.city ?? ""}
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="UF">
            <input
              name="state"
              type="text"
              maxLength={2}
              defaultValue={colaborador.state ?? ""}
              disabled={isPending}
              className={`${inputClass} uppercase`}
              style={{ textTransform: "uppercase" }}
            />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <SpinnerIcon className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </form>

      {/* Arquivos — ex: contrato de parceria assinado */}
      <DocumentsSection
        entityType="colaborador"
        entityId={colaborador.id}
        documents={documentos}
      />
    </div>
  );
}
