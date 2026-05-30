"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";
import {
  ESTAGIOS,
  ESTAGIO_META,
  ORIGENS,
  AREAS_INTERESSE,
} from "@/lib/crm-types";
import type { Lead } from "@/lib/crm-types";
import { createLeadAction, updateLeadAction } from "@/lib/crm-actions";
import type { CrmFormState } from "@/lib/crm-actions";
import type { Colaborador } from "@/lib/colaboradores-db";

interface LeadFormProps {
  lead?: Lead;
  colaboradores: Colaborador[];
}

export default function LeadForm({ lead, colaboradores }: LeadFormProps) {
  const router = useRouter();
  const action = lead ? updateLeadAction : createLeadAction;
  const [state, formAction, isPending] = useActionState<CrmFormState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) router.push("/dashboard/crm");
  }, [state, router]);

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20";
  const labelClass = "mb-1 block font-body text-sm font-medium text-fg";

  return (
    <form action={formAction} className="space-y-6">
      {lead && <input type="hidden" name="id" value={lead.id} />}

      {/* Dados principais */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-slate-50 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-fg">
            Dados do Lead
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome *</label>
            <input
              name="nome"
              required
              defaultValue={lead?.nome}
              placeholder="Nome completo"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Tipo</label>
            <select
              name="tipo"
              defaultValue={lead?.tipo ?? "PF"}
              className={inputClass}
            >
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Empresa / Organização</label>
            <input
              name="empresa"
              defaultValue={lead?.empresa ?? ""}
              placeholder="Opcional"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Telefone</label>
            <input
              name="telefone"
              defaultValue={lead?.telefone ?? ""}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>E-mail</label>
            <input
              name="email"
              type="email"
              defaultValue={lead?.email ?? ""}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Área de Interesse</label>
            <select
              name="area_interesse"
              defaultValue={lead?.area_interesse ?? ""}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {AREAS_INTERESSE.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Origem</label>
            <select
              name="origem"
              defaultValue={lead?.origem ?? ""}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {ORIGENS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Estágio no Funil</label>
            <select
              name="estagio"
              defaultValue={lead?.estagio ?? "novo_contato"}
              className={inputClass}
            >
              {ESTAGIOS.map((e) => (
                <option key={e} value={e}>
                  {ESTAGIO_META[e].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Responsável</label>
            <select
              name="responsavel_id"
              defaultValue={lead?.responsavel_id ?? ""}
              className={inputClass}
            >
              <option value="">Sem responsável</option>
              {colaboradores
                .filter((c) => c.status === "ativo")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Notas</label>
            <textarea
              name="notas"
              rows={4}
              defaultValue={lead?.notas ?? ""}
              placeholder="Observações sobre o lead..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border px-4 py-2 font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending && <SpinnerIcon className="h-4 w-4" />}
          {lead ? "Salvar Alterações" : "Criar Lead"}
        </button>
      </div>
    </form>
  );
}
