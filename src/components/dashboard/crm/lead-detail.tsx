"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PhoneIcon,
  MailIcon,
  TagIcon,
  ClockIcon,
  CheckCircleIcon,
  TrashIcon,
  PlusIcon,
  ArrowRightIcon,
  SpinnerIcon,
  ChevronRightIcon,
} from "@/components/icons";
import {
  ESTAGIOS,
  ESTAGIO_META,
  TIPOS_ATIVIDADE,
  ORIGENS,
  type Lead,
  type Atividade,
  type Tarefa,
  type Estagio,
} from "@/lib/crm-types";
import {
  moveLeadEstagioAction,
  deleteLeadAction,
  createAtividadeAction,
  deleteAtividadeAction,
  createTarefaAction,
  toggleTarefaAction,
  deleteTarefaAction,
  convertLeadToClientAction,
  type CrmFormState,
} from "@/lib/crm-actions";
import type { Colaborador } from "@/lib/colaboradores-db";

type DetailTab = "info" | "atividades" | "tarefas";

// ── Convert Button ─────────────────────────────────────────────────────────────

function ConvertButton({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Já tem processo criado automaticamente → mostra links para processo e cliente
  if (lead.processo_id) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/producao`}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-body text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
        >
          <ArrowRightIcon className="h-4 w-4" />
          Ver na Produção
        </Link>
        {lead.client_id && (
          <Link
            href={`/dashboard/clientes/${lead.client_id}`}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 font-body text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Ver Cliente
          </Link>
        )}
      </div>
    );
  }

  // Tem cliente mas ainda sem processo
  if (lead.client_id) {
    return (
      <Link
        href={`/dashboard/clientes/${lead.client_id}`}
        className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 font-body text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
      >
        <CheckCircleIcon className="h-4 w-4" />
        Ver Cliente
      </Link>
    );
  }

  // Não convertido: botão de conversão manual
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
          if (
            !confirm(
              `Fechar lead e criar cliente + processo para "${lead.nome}"?`
            )
          )
            return;
          startTransition(async () => {
            const result = await convertLeadToClientAction(lead.id);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? (
          <SpinnerIcon className="h-4 w-4" />
        ) : (
          <ArrowRightIcon className="h-4 w-4" />
        )}
        Fechar & Converter
      </button>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Stage Progression ─────────────────────────────────────────────────────────

// Pipeline linear (perdido é terminal separado)
const PIPELINE_ESTAGIO: Estagio[] = [
  "novo_contato",
  "consulta_agendada",
  "em_analise",
  "proposta_enviada",
  "fechado",
];

function EstagioBar({ lead }: { lead: Lead }) {
  const [isPending, startTransition] = useTransition();
  const currentIdx = PIPELINE_ESTAGIO.indexOf(lead.estagio);
  const isPerdido = lead.estagio === "perdido";

  function mover(alvo: Estagio) {
    startTransition(async () => {
      await moveLeadEstagioAction(lead.id, alvo);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PIPELINE_ESTAGIO.map((e, i) => {
        const meta = ESTAGIO_META[e];
        const isCurrent = e === lead.estagio;
        const isPast = !isPerdido && i < currentIdx;
        const isNext = !isPerdido && i === currentIdx + 1;
        const isFuture = isPerdido ? false : i > currentIdx;
        // clicável: etapas passadas (voltar) e a próxima (avançar)
        const isClickable = !isCurrent && !isPending && (isPast || isNext);

        return (
          <button
            key={e}
            disabled={isPending || isCurrent || (isFuture && !isNext)}
            onClick={() => isClickable && mover(e)}
            title={
              isPast
                ? `Voltar para ${meta.label}`
                : isNext
                  ? `Avançar para ${meta.label}`
                  : undefined
            }
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-medium transition-all
              ${
                isCurrent
                  ? `${meta.bg} ${meta.color} ${meta.border} border-2 shadow-sm`
                  : isPast
                    ? "border border-slate-200 bg-slate-100 text-slate-500 hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer"
                    : isNext
                      ? `border ${meta.border} ${meta.color} bg-white hover:${meta.bg} cursor-pointer`
                      : "border border-slate-200 bg-white text-slate-300 cursor-default"
              }
              disabled:cursor-not-allowed`}
          >
            {isPast && (
              <svg
                className="h-2.5 w-2.5 rotate-180 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isCurrent ? meta.dot : isPast ? "bg-slate-400" : meta.dot}`}
            />
            {meta.label}
            {isNext && !isPending && (
              <ChevronRightIcon className="h-3 w-3 flex-shrink-0" />
            )}
          </button>
        );
      })}

      {/* Perdido — terminal sempre acessível se não estiver fechado/perdido */}
      {!isPerdido && lead.estagio !== "fechado" && (
        <button
          disabled={isPending}
          onClick={() => mover("perdido")}
          title="Marcar como Perdido"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-body text-xs font-medium text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed"
        >
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
          {ESTAGIO_META["perdido"].label}
        </button>
      )}

      {/* Reabrir se perdido */}
      {isPerdido && (
        <button
          disabled={isPending}
          onClick={() => mover("novo_contato")}
          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-medium text-primary transition-all hover:bg-primary/10 disabled:cursor-not-allowed"
        >
          Reabrir Lead
        </button>
      )}

      {isPending && <SpinnerIcon className="h-4 w-4 text-muted" />}
    </div>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const fields = [
    { label: "Nome", value: lead.nome },
    {
      label: "Tipo",
      value: lead.tipo === "PF" ? "Pessoa Física" : "Pessoa Jurídica",
    },
    { label: "Empresa", value: lead.empresa },
    { label: "Telefone", value: lead.telefone },
    { label: "E-mail", value: lead.email },
    { label: "Área de Interesse", value: lead.area_interesse },
    {
      label: "Origem",
      value: lead.origem
        ? (ORIGENS.find((o) => o.value === lead.origem)?.label ?? lead.origem)
        : null,
    },
    { label: "Responsável", value: lead.responsavel_nome },
    { label: "Criado em", value: lead.created_at },
    { label: "Atualizado em", value: lead.updated_at },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-slate-50 px-5 py-3">
          <h3 className="font-heading text-sm font-semibold text-fg">
            Informações
          </h3>
        </div>
        <dl className="divide-y divide-border">
          {fields.map(({ label, value }) =>
            value ? (
              <div key={label} className="flex items-start gap-4 px-5 py-3">
                <dt className="w-36 shrink-0 font-body text-sm text-muted">
                  {label}
                </dt>
                <dd className="font-body text-sm text-fg">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>

      {lead.notas && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border bg-slate-50 px-5 py-3">
            <h3 className="font-heading text-sm font-semibold text-fg">
              Notas
            </h3>
          </div>
          <p className="whitespace-pre-wrap px-5 py-4 font-body text-sm text-fg">
            {lead.notas}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/crm/leads/${lead.id}/editar`}
          className="rounded-lg border border-border px-4 py-2 font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary"
        >
          Editar Lead
        </Link>
        <button
          onClick={() => {
            if (!confirm("Excluir este lead? Esta ação não pode ser desfeita."))
              return;
            startTransition(async () => {
              await deleteLeadAction(lead.id);
              router.push("/dashboard/crm");
            });
          }}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 font-body text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          <TrashIcon className="h-4 w-4" />
          Excluir Lead
        </button>
      </div>
    </div>
  );
}

// ── Atividade inline form ─────────────────────────────────────────────────────

function AtividadeForm({
  lead,
  colaboradores,
  onClose,
}: {
  lead: Lead;
  colaboradores: Colaborador[];
  onClose: () => void;
}) {
  const [state, formAction, isFormPending] = useActionState<
    CrmFormState,
    FormData
  >(createAtividadeAction, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none";
  const labelClass = "mb-1 block font-body text-sm font-medium text-fg";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border bg-slate-50 px-5 py-3">
        <h3 className="font-heading text-sm font-semibold text-fg">
          Registrar Atividade
        </h3>
      </div>
      <form action={formAction} className="grid gap-3 p-5 sm:grid-cols-2">
        <input type="hidden" name="lead_id" value={lead.id} />

        <div>
          <label className={labelClass}>Tipo *</label>
          <select name="tipo" required className={inputClass}>
            {TIPOS_ATIVIDADE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Data e Hora</label>
          <input
            name="data_hora"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Título *</label>
          <input
            name="titulo"
            required
            placeholder="Ex: Ligação de prospecção"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Responsável</label>
          <select name="responsavel_id" className={inputClass}>
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
          <label className={labelClass}>Descrição</label>
          <textarea
            name="descricao"
            rows={3}
            placeholder="Detalhes da interação..."
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-sm text-muted hover:text-fg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isFormPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-sm font-semibold text-white disabled:opacity-60"
          >
            {isFormPending && <SpinnerIcon className="h-3.5 w-3.5" />}
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Atividades Tab ────────────────────────────────────────────────────────────

function AtividadesTab({
  lead,
  atividades,
  colaboradores,
}: {
  lead: Lead;
  atividades: Atividade[];
  colaboradores: Colaborador[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showForm ? (
        <AtividadeForm
          lead={lead}
          colaboradores={colaboradores}
          onClose={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-2 font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <PlusIcon className="h-4 w-4" />
          Registrar Atividade
        </button>
      )}

      {/* List */}
      {atividades.length === 0 && !showForm && (
        <p className="py-8 text-center font-body text-sm text-muted">
          Nenhuma atividade registrada.
        </p>
      )}
      {atividades.map((a) => {
        const tipoMeta = TIPOS_ATIVIDADE.find((t) => t.value === a.tipo);
        return (
          <div
            key={a.id}
            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TagIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      {a.titulo}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {tipoMeta?.label} · {a.data_hora}
                      {a.responsavel_nome && ` · ${a.responsavel_nome}`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      startTransition(() =>
                        deleteAtividadeAction(a.id, lead.id)
                      )
                    }
                    disabled={isPending}
                    className="rounded-lg p-1 text-muted transition-colors hover:text-red-600 disabled:opacity-40"
                    title="Excluir"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                {a.descricao && (
                  <p className="mt-1 font-body text-sm text-muted">
                    {a.descricao}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tarefa inline form ────────────────────────────────────────────────────────

function TarefaForm({
  lead,
  colaboradores,
  onClose,
}: {
  lead: Lead;
  colaboradores: Colaborador[];
  onClose: () => void;
}) {
  const [state, formAction, isFormPending] = useActionState<
    CrmFormState,
    FormData
  >(createTarefaAction, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none";
  const labelClass = "mb-1 block font-body text-sm font-medium text-fg";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border bg-slate-50 px-5 py-3">
        <h3 className="font-heading text-sm font-semibold text-fg">
          Nova Tarefa
        </h3>
      </div>
      <form action={formAction} className="grid gap-3 p-5 sm:grid-cols-2">
        <input type="hidden" name="lead_id" value={lead.id} />

        <div className="sm:col-span-2">
          <label className={labelClass}>Título *</label>
          <input
            name="titulo"
            required
            placeholder="Ex: Ligar para agendar consulta"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Vencimento</label>
          <input name="data_vencimento" type="date" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Responsável</label>
          <select name="responsavel_id" className={inputClass}>
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
          <label className={labelClass}>Descrição</label>
          <textarea
            name="descricao"
            rows={2}
            placeholder="Detalhes..."
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-sm text-muted hover:text-fg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isFormPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-sm font-semibold text-white disabled:opacity-60"
          >
            {isFormPending && <SpinnerIcon className="h-3.5 w-3.5" />}
            Criar
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Tarefas Tab ───────────────────────────────────────────────────────────────

function TarefasTab({
  lead,
  tarefas,
  colaboradores,
}: {
  lead: Lead;
  tarefas: Tarefa[];
  colaboradores: Colaborador[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pendentes = tarefas.filter((t) => !t.concluida);
  const concluidas = tarefas.filter((t) => t.concluida);

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showForm ? (
        <TarefaForm
          lead={lead}
          colaboradores={colaboradores}
          onClose={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-2 font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Tarefa
        </button>
      )}

      {tarefas.length === 0 && !showForm && (
        <p className="py-8 text-center font-body text-sm text-muted">
          Nenhuma tarefa cadastrada.
        </p>
      )}

      {/* Pendentes */}
      {pendentes.map((t) => (
        <TarefaRow
          key={t.id}
          tarefa={t}
          lead={lead}
          isPending={isPending}
          startTransition={startTransition}
        />
      ))}

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted pt-2">
            Concluídas ({concluidas.length})
          </p>
          {concluidas.map((t) => (
            <TarefaRow
              key={t.id}
              tarefa={t}
              lead={lead}
              isPending={isPending}
              startTransition={startTransition}
            />
          ))}
        </>
      )}
    </div>
  );
}

function TarefaRow({
  tarefa,
  lead,
  isPending,
  startTransition,
}: {
  tarefa: Tarefa;
  lead: Lead;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    !tarefa.concluida &&
    tarefa.data_vencimento &&
    tarefa.data_vencimento < today;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm ${tarefa.concluida ? "opacity-60" : ""} ${isOverdue ? "border-red-200" : "border-border"}`}
    >
      <button
        onClick={() =>
          startTransition(() =>
            toggleTarefaAction(tarefa.id, lead.id, !tarefa.concluida)
          )
        }
        disabled={isPending}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors disabled:opacity-40 ${
          tarefa.concluida
            ? "border-green-500 bg-green-500 text-white"
            : "border-border hover:border-green-500"
        }`}
      >
        {tarefa.concluida && (
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`font-body text-sm font-medium ${tarefa.concluida ? "line-through text-muted" : "text-fg"}`}
        >
          {tarefa.titulo}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {tarefa.data_vencimento && (
            <span
              className={`flex items-center gap-1 font-body text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-muted"}`}
            >
              <ClockIcon className="h-3 w-3" />
              {tarefa.data_vencimento}
              {isOverdue && " (atrasada)"}
            </span>
          )}
          {tarefa.responsavel_nome && (
            <span className="font-body text-xs text-muted">
              {tarefa.responsavel_nome}
            </span>
          )}
        </div>
        {tarefa.descricao && (
          <p className="mt-1 font-body text-xs text-muted">
            {tarefa.descricao}
          </p>
        )}
      </div>
      <button
        onClick={() =>
          startTransition(() => deleteTarefaAction(tarefa.id, lead.id))
        }
        disabled={isPending}
        className="rounded-lg p-1 text-muted transition-colors hover:text-red-600 disabled:opacity-40"
        title="Excluir"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface LeadDetailProps {
  lead: Lead;
  atividades: Atividade[];
  tarefas: Tarefa[];
  colaboradores: Colaborador[];
}

export default function LeadDetail({
  lead,
  atividades,
  tarefas,
  colaboradores,
}: LeadDetailProps) {
  const [tab, setTab] = useState<DetailTab>("info");
  const meta = ESTAGIO_META[lead.estagio];

  const DETAIL_TABS: { key: DetailTab; label: string; count?: number }[] = [
    { key: "info", label: "Informações" },
    { key: "atividades", label: "Atividades", count: atividades.length },
    {
      key: "tarefas",
      label: "Tarefas",
      count: tarefas.filter((t) => !t.concluida).length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-fg">
                  {lead.nome}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 font-body text-xs font-medium ${meta.color} ${meta.bg}`}
                >
                  {lead.tipo}
                </span>
              </div>
              {lead.empresa && (
                <p className="font-body text-sm text-muted">{lead.empresa}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {lead.telefone && (
                  <span className="flex items-center gap-1 font-body text-sm text-muted">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {lead.telefone}
                  </span>
                )}
                {lead.email && (
                  <span className="flex items-center gap-1 font-body text-sm text-muted">
                    <MailIcon className="h-3.5 w-3.5" />
                    {lead.email}
                  </span>
                )}
                {lead.area_interesse && (
                  <span className="flex items-center gap-1 font-body text-sm text-muted">
                    <TagIcon className="h-3.5 w-3.5" />
                    {lead.area_interesse}
                  </span>
                )}
              </div>
            </div>
            <ConvertButton lead={lead} />
          </div>
        </div>
        {/* Stage bar */}
        <div className="px-5 py-3">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Estágio no Funil
          </p>
          <EstagioBar lead={lead} />
        </div>
      </div>

      {/* Detail tabs */}
      <div className="flex gap-1 border-b border-border">
        {DETAIL_TABS.map(({ key, label, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-body text-sm font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-body text-xs font-bold ${active ? "bg-primary/10 text-primary" : "bg-slate-100 text-muted"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "info" && <InfoTab lead={lead} />}
      {tab === "atividades" && (
        <AtividadesTab
          lead={lead}
          atividades={atividades}
          colaboradores={colaboradores}
        />
      )}
      {tab === "tarefas" && (
        <TarefasTab
          lead={lead}
          tarefas={tarefas}
          colaboradores={colaboradores}
        />
      )}
    </div>
  );
}
