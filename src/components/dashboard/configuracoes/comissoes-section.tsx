"use client";

import { useState, useActionState, useEffect } from "react";
import {
  createComissaoConfigAction,
  updateComissaoConfigAction,
  deleteComissaoConfigAction,
  toggleComissaoConfigAtivoAction,
  type ComissaoConfigFormState,
} from "@/lib/comissoes-config-actions";
import type { ComissaoConfig } from "@/lib/comissoes-config-db";
import { SpinnerIcon } from "@/components/icons";

const TIPO_ORIGEM_LABELS: Record<string, string> = {
  escritorio: "Escritório",
  indicacao: "Indicação",
  rede_social: "Rede Social",
  trafego_pago: "Tráfego Pago",
  outros: "Outros",
};

const CARGO_LABELS: Record<string, string> = {
  advogado: "Advogado(a)",
  estagiario: "Estagiário(a)",
  recepcao: "Recepção",
  agente: "Agente",
  advogado_associado: "Advogado(a) Associado(a)",
  comercial: "Comercial",
};

const TIPO_TRABALHO_LABELS: Record<string, string> = {
  administrativo: "Administrativo",
  judicial: "Judicial",
  ambos: "Ambos",
};

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelClass = "block font-body text-xs font-semibold text-fg mb-1";

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

function fmt(v: number, tipo: string) {
  if (tipo === "percentual") return `${v.toFixed(2)}%`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ComissaoFormProps {
  initial?: ComissaoConfig;
  onSuccess: () => void;
  onCancel: () => void;
}

function ComissaoForm({ initial, onSuccess, onCancel }: ComissaoFormProps) {
  const action = initial
    ? updateComissaoConfigAction.bind(null, initial.id)
    : createComissaoConfigAction;

  const [state, formAction, isPending] = useActionState<
    ComissaoConfigFormState,
    FormData
  >(action, null);

  const [comissaoTipo, setComissaoTipo] = useState<string>(
    initial?.comissao_tipo ?? "percentual"
  );
  const [bonTipo, setBonTipo] = useState(initial?.bonificacao_tipo ?? "");

  useEffect(() => {
    if (state && "success" in state) {
      onSuccess();
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}

      {initial && (
        <input
          type="hidden"
          name="ativo"
          value={initial.ativo ? "true" : "false"}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome da regra *">
            <input
              name="nome"
              type="text"
              required
              defaultValue={initial?.nome ?? ""}
              placeholder="Ex.: Comissão Advogado Indicador — Judicial"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Aplica-se à origem">
          <select
            name="tipo_origem"
            defaultValue={initial?.tipo_origem ?? ""}
            className={selectClass}
          >
            <option value="">Todas as origens</option>
            <option value="escritorio">Escritório</option>
            <option value="indicacao">Indicação</option>
            <option value="rede_social">Rede Social</option>
            <option value="trafego_pago">Tráfego Pago</option>
            <option value="outros">Outros</option>
          </select>
        </Field>

        <Field label="Cargo do colaborador">
          <select
            name="cargo_colaborador"
            defaultValue={initial?.cargo_colaborador ?? ""}
            className={selectClass}
          >
            <option value="">Todos os cargos</option>
            <option value="advogado">Advogado(a)</option>
            <option value="advogado_associado">Advogado(a) Associado(a)</option>
            <option value="comercial">Comercial</option>
            <option value="agente">Agente</option>
            <option value="recepcao">Recepção</option>
            <option value="estagiario">Estagiário(a)</option>
          </select>
        </Field>

        <Field label="Tipo de trabalho (advogados)">
          <select
            name="tipo_trabalho"
            defaultValue={initial?.tipo_trabalho ?? ""}
            className={selectClass}
          >
            <option value="">Não se aplica</option>
            <option value="administrativo">Administrativo</option>
            <option value="judicial">Judicial</option>
            <option value="ambos">Ambos</option>
          </select>
        </Field>

        <div className="sm:col-span-2">
          <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-3">
            <p className="font-body text-xs font-semibold text-muted uppercase tracking-wide">
              Comissão
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de comissão">
                <select
                  name="comissao_tipo"
                  value={comissaoTipo}
                  onChange={(e) => setComissaoTipo(e.target.value)}
                  className={selectClass}
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor">Valor fixo (R$)</option>
                </select>
              </Field>
              <Field
                label={
                  comissaoTipo === "percentual"
                    ? "Percentual (%)"
                    : "Valor (R$)"
                }
              >
                <input
                  name="comissao_valor"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={initial?.comissao_valor ?? ""}
                  placeholder={
                    comissaoTipo === "percentual" ? "10.00" : "500.00"
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-3">
            <p className="font-body text-xs font-semibold text-muted uppercase tracking-wide">
              Bonificação (opcional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de bonificação">
                <select
                  name="bonificacao_tipo"
                  value={bonTipo}
                  onChange={(e) => setBonTipo(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Sem bonificação</option>
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor">Valor fixo (R$)</option>
                </select>
              </Field>
              {bonTipo && (
                <Field
                  label={
                    bonTipo === "percentual" ? "Percentual (%)" : "Valor (R$)"
                  }
                >
                  <input
                    name="bonificacao_valor"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={initial?.bonificacao_valor ?? ""}
                    placeholder={bonTipo === "percentual" ? "5.00" : "200.00"}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Field label="Observações">
            <textarea
              name="observacoes"
              rows={2}
              defaultValue={initial?.observacoes ?? ""}
              placeholder="Detalhes ou condições específicas…"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted hover:text-fg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-9 items-center gap-2 rounded-lg bg-primary px-5 font-body text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60 cursor-pointer"
        >
          {isPending && <SpinnerIcon className="h-4 w-4" />}
          {initial ? "Salvar alterações" : "Criar regra"}
        </button>
      </div>
    </form>
  );
}

interface Props {
  comissoes: ComissaoConfig[];
}

export default function ComissoesSection({
  comissoes: initialComissoes,
}: Props) {
  const [comissoes, setComissoes] = useState(initialComissoes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteComissaoConfigAction(id);
    setComissoes((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  }

  async function handleToggle(id: string, ativo: boolean) {
    setToggling(id);
    await toggleComissaoConfigAtivoAction(id, ativo);
    setComissoes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ativo: !ativo } : c))
    );
    setToggling(null);
  }

  const editingConfig = editingId
    ? comissoes.find((c) => c.id === editingId)
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-fg">
            Regras de Comissão e Bonificação
          </h2>
          <p className="font-body text-sm text-muted mt-0.5">
            Configure as regras de comissão que serão aplicadas automaticamente
            no financeiro.
          </p>
        </div>
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="flex h-9 items-center rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white hover:bg-cta-hover transition-colors cursor-pointer"
          >
            + Nova regra
          </button>
        )}
      </div>

      {showForm && !editingId && (
        <div className="rounded-xl border border-primary/20 bg-blue-50/40 p-5">
          <h3 className="font-heading text-sm font-semibold text-fg mb-4">
            Nova regra de comissão
          </h3>
          <ComissaoForm
            onSuccess={() => {
              setShowForm(false);
              window.location.reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {editingConfig && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
          <h3 className="font-heading text-sm font-semibold text-fg mb-4">
            Editando: {editingConfig.nome}
          </h3>
          <ComissaoForm
            initial={editingConfig}
            onSuccess={() => {
              setEditingId(null);
              window.location.reload();
            }}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {comissoes.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
          <p className="font-body text-sm text-muted">
            Nenhuma regra de comissão cadastrada.
          </p>
          <p className="font-body text-xs text-muted mt-1">
            Clique em &quot;+ Nova regra&quot; para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comissoes.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 transition-opacity ${
                !c.ativo
                  ? "opacity-60 border-border"
                  : "border-border shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-sm font-semibold text-fg">
                      {c.nome}
                    </span>
                    {!c.ativo && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-semibold text-slate-500">
                        Inativo
                      </span>
                    )}
                    {c.tipo_origem && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-body text-[11px] text-blue-600">
                        {TIPO_ORIGEM_LABELS[c.tipo_origem] ?? c.tipo_origem}
                      </span>
                    )}
                    {c.cargo_colaborador && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 font-body text-[11px] text-violet-600">
                        {CARGO_LABELS[c.cargo_colaborador] ??
                          c.cargo_colaborador}
                      </span>
                    )}
                    {c.tipo_trabalho && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-body text-[11px] text-emerald-600">
                        {TIPO_TRABALHO_LABELS[c.tipo_trabalho] ??
                          c.tipo_trabalho}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 font-body text-sm text-muted">
                    <span>
                      <span className="font-semibold text-fg">Comissão:</span>{" "}
                      {fmt(c.comissao_valor, c.comissao_tipo)}
                    </span>
                    {c.bonificacao_tipo && c.bonificacao_valor != null && (
                      <span>
                        <span className="font-semibold text-fg">
                          Bonificação:
                        </span>{" "}
                        {fmt(c.bonificacao_valor, c.bonificacao_tipo)}
                      </span>
                    )}
                  </div>
                  {c.observacoes && (
                    <p className="mt-1 font-body text-xs text-muted truncate max-w-lg">
                      {c.observacoes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(c.id, c.ativo)}
                    disabled={toggling === c.id}
                    className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {c.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(c.id);
                      setShowForm(false);
                    }}
                    className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-muted hover:text-primary hover:border-primary transition-colors cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="flex h-8 items-center rounded-lg border border-red-200 px-3 font-body text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === c.id ? (
                      <SpinnerIcon className="h-3.5 w-3.5" />
                    ) : (
                      "Excluir"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
