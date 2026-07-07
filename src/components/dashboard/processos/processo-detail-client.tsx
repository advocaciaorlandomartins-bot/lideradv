"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import IaJuridicaSection from "@/components/dashboard/ia/ia-juridica-section";
import IaPeticoesProcesso from "@/components/dashboard/ia/ia-peticoes-processo";
import CerebroPanel from "@/components/dashboard/ia/cerebro-panel";
import type {
  ProcessoExtended,
  HistoricoRegistro,
  EventoControle,
  TarefaProcesso,
  PendenciaCliente,
  ColaboradorSimples,
} from "@/lib/processo-full-db";
import type { ModeloDocumento } from "@/lib/modelos-db";
import {
  avancarFaseAction,
  arquivarProcessoAction,
  updateRelatoAction,
  updateResponsavelAction,
  createHistoricoRegistroAction,
  deleteHistoricoRegistroAction,
  createEventoControleAction,
  updateEventoControleAction,
  deleteEventoControleAction,
  darBaixaEventoControleAction,
  reabrirEventoControleAction,
  createTarefaProcessoAction,
  deleteTarefaAction,
  darBaixaTarefaProcessoAction,
  reabrirTarefaProcessoAction,
  createPendenciaAction,
  updatePendenciaStatusAction,
  deletePendenciaAction,
} from "@/lib/processo-full-actions";
import {
  moverParaProducaoAction,
  moverParaAdministrativoAction,
  registrarResultadoAdminAction,
  registrarResultadoJudicialAction,
  arquivarProcessoAction as arquivarProducaoAction,
  reabrirProcessoAction,
  voltarEstagioAction,
} from "@/lib/producao-actions";
import {
  ESTAGIO_PRODUCAO_META,
  RESULTADO_ADMIN_META,
  RESULTADO_JUDICIAL_META,
} from "@/lib/producao-types";
import {
  XMarkIcon,
  SpinnerIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  PlusIcon,
  CheckIcon,
  ClockIcon,
  FolderOpenIcon,
  ArrowDownTrayIcon,
  KanbanIcon,
  ArchiveBoxIcon,
} from "@/components/icons";

// ── Types ──────────────────────────────────────────────────────

interface Props {
  processo: ProcessoExtended;
  historico: HistoricoRegistro[];
  eventos: EventoControle[];
  tarefas: TarefaProcesso[];
  pendencias: PendenciaCliente[];
  colaboradores: ColaboradorSimples[];
  modelos: ModeloDocumento[];
  sessionLogin?: string;
}

type Tab = "dados" | "relato" | "linha_do_tempo";

// ── Style helpers ───────────────────────────────────────────────

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls =
  "block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1";
const btnPrimary =
  "flex items-center gap-1.5 rounded-lg bg-primary px-4 h-9 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const btnOutline =
  "flex items-center gap-1.5 rounded-lg border border-border px-4 h-9 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary cursor-pointer";
const btnDanger =
  "font-body text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer";

// ── Linha de Produção ──────────────────────────────────────────

const PIPELINE_PROD = [
  "analise",
  "producao",
  "administrativo",
  "judicial",
] as const;

function ProducaoBar({ processo }: { processo: ProcessoExtended }) {
  const [showFormAdmin, setShowFormAdmin] = useState(false);
  const [showFormJud, setShowFormJud] = useState(false);
  const [resultadoAdmin, setResultadoAdmin] = useState<"concedido" | "negado">(
    "concedido"
  );
  const [proximoAdmin, setProximoAdmin] = useState<"judicial" | "arquivado">(
    "arquivado"
  );
  const [resultadoJud, setResultadoJud] = useState<
    "procedente" | "improcedente" | "parcial"
  >("procedente");
  const [isPending, startTransition] = useTransition();

  const estagio = processo.estagio_producao;
  const isArquivado = estagio === "arquivado";
  const currentIdx = PIPELINE_PROD.indexOf(
    estagio as (typeof PIPELINE_PROD)[number]
  );

  const inputCls2 =
    "w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg focus:border-primary focus:outline-none";

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-slate-50 px-5 py-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-fg">
            Linha de Produção
          </h3>
          <p className="font-body text-xs text-muted">
            {isArquivado
              ? "Processo arquivado"
              : `${processo.dias_no_estagio}d na etapa atual`}
          </p>
        </div>
        <Link
          href="/dashboard/producao"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <KanbanIcon className="h-3.5 w-3.5" />
          Ver na Produção
        </Link>
      </div>

      {/* Stepper */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-0 flex-wrap">
          {PIPELINE_PROD.map((e, i) => {
            const meta = ESTAGIO_PRODUCAO_META[e];
            const isCurrent = e === estagio && !isArquivado;
            const isDone = isArquivado || i < currentIdx;
            const isFuture = !isArquivado && i > currentIdx;

            return (
              <div key={e} className="flex items-center">
                <div
                  title={meta.label}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all
                    ${isCurrent ? `${meta.dot} border-transparent text-white shadow-sm` : ""}
                    ${isDone ? "border-transparent bg-slate-300 text-white" : ""}
                    ${isFuture ? "border-slate-200 bg-white text-slate-300" : ""}
                  `}
                >
                  {isDone && !isCurrent ? (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <div className="flex flex-col items-center mx-1">
                  <div
                    className={`h-0.5 w-10 ${i < currentIdx || isArquivado ? "bg-slate-300" : "bg-slate-200"}`}
                  />
                </div>
              </div>
            );
          })}

          {/* Arquivado terminal */}
          <div
            title="Arquivado"
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold
              ${isArquivado ? "border-transparent bg-slate-400 text-white" : "border-slate-200 bg-white text-slate-300"}
            `}
          >
            <ArchiveBoxIcon className="h-3.5 w-3.5" />
          </div>

          {/* Label atual */}
          <span
            className={`ml-3 font-body text-sm font-semibold ${ESTAGIO_PRODUCAO_META[estagio as keyof typeof ESTAGIO_PRODUCAO_META]?.color ?? "text-slate-500"}`}
          >
            {ESTAGIO_PRODUCAO_META[
              estagio as keyof typeof ESTAGIO_PRODUCAO_META
            ]?.label ?? estagio}
          </span>

          {/* Resultados */}
          {processo.resultado_administrativo && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 font-body text-[11px] font-medium ${RESULTADO_ADMIN_META[processo.resultado_administrativo as keyof typeof RESULTADO_ADMIN_META]?.bg} ${RESULTADO_ADMIN_META[processo.resultado_administrativo as keyof typeof RESULTADO_ADMIN_META]?.color}`}
            >
              Adm:{" "}
              {
                RESULTADO_ADMIN_META[
                  processo.resultado_administrativo as keyof typeof RESULTADO_ADMIN_META
                ]?.label
              }
            </span>
          )}
          {processo.resultado_judicial && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 font-body text-[11px] font-medium ${RESULTADO_JUDICIAL_META[processo.resultado_judicial as keyof typeof RESULTADO_JUDICIAL_META]?.bg} ${RESULTADO_JUDICIAL_META[processo.resultado_judicial as keyof typeof RESULTADO_JUDICIAL_META]?.color}`}
            >
              Jud:{" "}
              {
                RESULTADO_JUDICIAL_META[
                  processo.resultado_judicial as keyof typeof RESULTADO_JUDICIAL_META
                ]?.label
              }
            </span>
          )}
        </div>

        {/* Botões de ação */}
        {!showFormAdmin && !showFormJud && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Voltar */}
            {["producao", "administrativo", "judicial"].includes(estagio) && (
              <button
                onClick={() =>
                  startTransition(() => voltarEstagioAction(processo.id))
                }
                disabled={isPending}
                className="flex items-center gap-1 rounded px-2 py-1 font-body text-xs text-muted transition-colors hover:text-fg disabled:opacity-40"
              >
                {isPending ? (
                  <SpinnerIcon className="h-3 w-3" />
                ) : (
                  <svg
                    className="h-3 w-3 rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
                Voltar
              </button>
            )}

            {/* Avançar */}
            {estagio === "analise" && (
              <button
                onClick={() =>
                  startTransition(() => moverParaProducaoAction(processo.id))
                }
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 font-body text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
              >
                {isPending ? (
                  <SpinnerIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
                Iniciar Produção
              </button>
            )}
            {estagio === "producao" && (
              <button
                onClick={() =>
                  startTransition(() =>
                    moverParaAdministrativoAction(processo.id)
                  )
                }
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 font-body text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
              >
                {isPending ? (
                  <SpinnerIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
                Protocolar Adm.
              </button>
            )}
            {estagio === "administrativo" && (
              <button
                onClick={() => setShowFormAdmin(true)}
                className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 font-body text-xs font-semibold text-orange-700 hover:bg-orange-100"
              >
                <ChevronRightIcon className="h-3 w-3" />
                Registrar Resultado
              </button>
            )}
            {estagio === "judicial" && (
              <button
                onClick={() => setShowFormJud(true)}
                className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 font-body text-xs font-semibold text-purple-700 hover:bg-purple-100"
              >
                <ChevronRightIcon className="h-3 w-3" />
                Registrar Resultado
              </button>
            )}
            {isArquivado && (
              <button
                onClick={() =>
                  startTransition(() => reabrirProcessoAction(processo.id))
                }
                disabled={isPending}
                className="flex items-center gap-1 rounded px-2 py-1 font-body text-xs text-muted hover:text-primary disabled:opacity-40"
              >
                {isPending && <SpinnerIcon className="h-3 w-3" />}
                Reabrir
              </button>
            )}
            {!isArquivado && (
              <button
                onClick={() => {
                  if (!confirm("Arquivar este processo na produção?")) return;
                  startTransition(() => arquivarProducaoAction(processo.id));
                }}
                disabled={isPending}
                className="ml-auto flex items-center gap-1 rounded px-2 py-1 font-body text-xs text-muted hover:text-red-600 disabled:opacity-40"
              >
                <ArchiveBoxIcon className="h-3 w-3" />
                Arquivar
              </button>
            )}
          </div>
        )}

        {/* Form resultado administrativo */}
        {showFormAdmin && (
          <div className="mt-3 space-y-3 rounded-lg border border-border bg-slate-50 p-4">
            <p className="font-body text-xs font-semibold text-fg">
              Resultado Administrativo
            </p>
            <select
              value={resultadoAdmin}
              onChange={(e) =>
                setResultadoAdmin(e.target.value as "concedido" | "negado")
              }
              className={inputCls2}
            >
              <option value="concedido">Concedido ✓</option>
              <option value="negado">Negado ✗</option>
            </select>
            {resultadoAdmin === "negado" && (
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={proximoAdmin === "judicial"}
                    onChange={() => setProximoAdmin("judicial")}
                    className="accent-primary"
                  />
                  <span className="font-body text-xs text-fg">
                    Encaminhar para Judicial
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={proximoAdmin === "arquivado"}
                    onChange={() => setProximoAdmin("arquivado")}
                    className="accent-primary"
                  />
                  <span className="font-body text-xs text-fg">
                    Arquivar sem judicial
                  </span>
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  startTransition(async () => {
                    await registrarResultadoAdminAction(
                      processo.id,
                      resultadoAdmin,
                      resultadoAdmin === "concedido"
                        ? "arquivado"
                        : proximoAdmin
                    );
                    setShowFormAdmin(false);
                  })
                }
                disabled={isPending}
                className="flex flex-1 justify-center items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
              >
                {isPending && <SpinnerIcon className="h-3 w-3" />} Confirmar
              </button>
              <button
                onClick={() => setShowFormAdmin(false)}
                className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Form resultado judicial */}
        {showFormJud && (
          <div className="mt-3 space-y-3 rounded-lg border border-border bg-slate-50 p-4">
            <p className="font-body text-xs font-semibold text-fg">
              Resultado Judicial
            </p>
            <select
              value={resultadoJud}
              onChange={(e) =>
                setResultadoJud(
                  e.target.value as "procedente" | "improcedente" | "parcial"
                )
              }
              className={inputCls2}
            >
              <option value="procedente">Procedente ✓</option>
              <option value="improcedente">Improcedente ✗</option>
              <option value="parcial">Parcial Procedente</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  startTransition(async () => {
                    await registrarResultadoJudicialAction(
                      processo.id,
                      resultadoJud
                    );
                    setShowFormJud(false);
                  })
                }
                disabled={isPending}
                className="flex flex-1 justify-center items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
              >
                {isPending && <SpinnerIcon className="h-3 w-3" />} Confirmar e
                Arquivar
              </button>
              <button
                onClick={() => setShowFormJud(false)}
                className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal wrapper ───────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <h2 className="font-heading text-lg font-semibold text-fg">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg cursor-pointer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Phase Timeline ─────────────────────────────────────────────

const FASES = [
  {
    key: "pre_contrato",
    label: "Pré-contrato",
    field: "fase_precontrato_at" as const,
  },
  {
    key: "elaboracao",
    label: "Elaboração",
    field: "fase_elaboracao_at" as const,
  },
  {
    key: "arquivado",
    label: "Arquivada(o)",
    field: "fase_arquivado_at" as const,
  },
];

function FaseTimeline({
  processo,
  onAvancar,
  onArquivar,
}: {
  processo: ProcessoExtended;
  onAvancar: () => void;
  onArquivar: () => void;
}) {
  const currentIdx = FASES.findIndex((f) => f.key === processo.fase_workflow);

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-sm font-semibold text-fg">
          Progressão do Processo
        </h3>
        <div className="flex gap-2">
          {processo.fase_workflow !== "arquivado" && (
            <>
              {processo.fase_workflow === "pre_contrato" && (
                <button onClick={onAvancar} className={btnOutline}>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                  Avançar Fase
                </button>
              )}
              <button onClick={onArquivar} className={btnOutline}>
                <FolderOpenIcon className="h-3.5 w-3.5" />
                Arquivar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-0">
        {FASES.map((fase, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const pending = idx > currentIdx;
          const date = processo[fase.field];

          return (
            <div key={fase.key} className="flex flex-1 items-start">
              <div className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div
                      className={`h-0.5 flex-1 transition-colors ${done || active ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                  <div
                    className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition-colors ${
                      done
                        ? "border-primary bg-primary"
                        : active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-white"
                    }`}
                  >
                    {done ? (
                      <CheckIcon className="h-4 w-4 text-white" />
                    ) : (
                      <span
                        className={`font-body text-xs font-bold ${active ? "text-primary" : "text-muted"}`}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  {idx < FASES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 transition-colors ${done ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`font-body text-xs font-semibold ${active ? "text-primary" : done ? "text-fg" : "text-muted"}`}
                  >
                    {fase.label}
                  </p>
                  {date && (
                    <p className="font-body text-[10px] text-muted mt-0.5">
                      {date}
                    </p>
                  )}
                  {active && !date && (
                    <p className="font-body text-[10px] text-primary mt-0.5">
                      Fase atual
                    </p>
                  )}
                  {pending && (
                    <p className="font-body text-[10px] text-slate-300 mt-0.5">
                      —
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dados Tab ──────────────────────────────────────────────────

const PRIORIDADE_STYLES: Record<string, string> = {
  Alta: "bg-red-50 text-red-600 border-red-200",
  Média: "bg-amber-50 text-amber-700 border-amber-200",
  Baixa: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function DadosField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-6">
      <span className="w-36 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-body text-sm text-fg">{value || "—"}</span>
    </div>
  );
}

function DadosTab({ processo }: { processo: ProcessoExtended }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="rounded-full border px-3 py-1 font-body text-xs font-semibold bg-violet-50 text-violet-700 border-violet-200">
          {processo.tipo_demanda}
        </span>
        <span
          className={`rounded-full border px-3 py-1 font-body text-xs font-semibold ${PRIORIDADE_STYLES[processo.prioridade] ?? "bg-slate-100 text-slate-500 border-border"}`}
        >
          {processo.prioridade}
        </span>
        <span className="rounded-full border px-3 py-1 font-body text-xs font-semibold bg-blue-50 text-blue-600 border-blue-200">
          {processo.area}
        </span>
      </div>

      <DadosField label="Tipo de Ação" value={processo.tipo_acao} />
      {processo.assunto && (
        <DadosField label="Assunto" value={processo.assunto} />
      )}
      {processo.numero && (
        <DadosField label="Nº Protocolo" value={processo.numero} />
      )}
      {processo.vara && (
        <DadosField label="Vara / Juízo" value={processo.vara} />
      )}
      {processo.comarca && (
        <DadosField label="Comarca" value={processo.comarca} />
      )}
      {processo.data_distribuicao && (
        <DadosField label="Distribuição" value={processo.data_distribuicao} />
      )}
      {processo.valor_causa != null && (
        <DadosField
          label="Valor da causa"
          value={processo.valor_causa.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        />
      )}
      {processo.parte_contraria && (
        <DadosField label="Parte contrária" value={processo.parte_contraria} />
      )}
      {processo.parte_contraria_doc && (
        <DadosField
          label="Doc. parte contr."
          value={processo.parte_contraria_doc}
        />
      )}
      {processo.resultado && (
        <DadosField label="Resultado" value={processo.resultado} />
      )}
      {processo.notas && (
        <DadosField label="Observações" value={processo.notas} />
      )}

      {/* Bloco INSS — só exibe se houver ao menos um campo preenchido */}
      {(processo.der ||
        processo.dib ||
        processo.dcb ||
        processo.protocolo_inss ||
        processo.resultado_admin ||
        processo.modelo_honorario) && (
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/40 p-5 space-y-3">
          <p className="font-body text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">
            Previdenciário — INSS & Honorários
          </p>
          {processo.der && (
            <DadosField
              label="DER"
              value={new Date(processo.der + "T12:00:00").toLocaleDateString(
                "pt-BR"
              )}
            />
          )}
          {processo.dib && (
            <DadosField
              label="DIB"
              value={new Date(processo.dib + "T12:00:00").toLocaleDateString(
                "pt-BR"
              )}
            />
          )}
          {processo.dcb && (
            <DadosField
              label="DCB"
              value={new Date(processo.dcb + "T12:00:00").toLocaleDateString(
                "pt-BR"
              )}
            />
          )}
          {processo.data_protocolo_inss && (
            <DadosField
              label="Requerimento INSS"
              value={new Date(
                processo.data_protocolo_inss + "T12:00:00"
              ).toLocaleDateString("pt-BR")}
            />
          )}
          {processo.protocolo_inss && (
            <DadosField
              label="Protocolo INSS"
              value={processo.protocolo_inss}
            />
          )}
          {processo.agencia_inss && (
            <DadosField label="Agência INSS" value={processo.agencia_inss} />
          )}
          {processo.resultado_admin && (
            <DadosField
              label="Resultado admin."
              value={
                processo.resultado_admin === "deferido"
                  ? "Deferido"
                  : processo.resultado_admin === "indeferido"
                    ? "Indeferido"
                    : processo.resultado_admin === "em_analise"
                      ? "Em análise"
                      : processo.resultado_admin === "recurso"
                        ? "Em recurso"
                        : processo.resultado_admin
              }
            />
          )}
          {processo.data_resultado_admin && (
            <DadosField
              label="Data resultado"
              value={new Date(
                processo.data_resultado_admin + "T12:00:00"
              ).toLocaleDateString("pt-BR")}
            />
          )}
          {processo.motivo_indeferimento && (
            <DadosField
              label="Motivo indeferi."
              value={processo.motivo_indeferimento}
            />
          )}
          {processo.num_beneficio_concedido && (
            <DadosField
              label="NB concedido"
              value={processo.num_beneficio_concedido}
            />
          )}
          {processo.modelo_honorario && (
            <DadosField
              label="Honorários"
              value={
                processo.modelo_honorario === "fixo"
                  ? "Fixo"
                  : processo.modelo_honorario === "percentual"
                    ? "Percentual"
                    : processo.modelo_honorario === "misto"
                      ? "Misto"
                      : processo.modelo_honorario === "sucumbencia"
                        ? "Sucumbência"
                        : processo.modelo_honorario === "risco"
                          ? "Sem custo (risco)"
                          : processo.modelo_honorario
              }
            />
          )}
          {processo.valor_honorario != null && (
            <DadosField
              label="Valor honorário"
              value={processo.valor_honorario.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            />
          )}
          {processo.percentual_honorario != null && (
            <DadosField
              label="Percentual"
              value={`${processo.percentual_honorario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Relato Tab ─────────────────────────────────────────────────

function RelatoTab({ processo }: { processo: ProcessoExtended }) {
  const [text, setText] = useState(processo.relato ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    const result = await updateRelatoAction(processo.id, text);
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Descreva o relato do processo de forma narrativa…"
        className="w-full resize-y rounded-lg border border-border bg-white p-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
      />
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Salvando…
            </>
          ) : saved ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Salvo
            </>
          ) : (
            "Salvar Relato"
          )}
        </button>
      </div>
    </div>
  );
}

// ── Linha do Tempo Tab ─────────────────────────────────────────

const TIPO_REGISTRO_CORES: Record<string, string> = {
  Demanda: "bg-blue-100 text-blue-700",
  Cliente: "bg-violet-100 text-violet-700",
  "Registro de Atividades": "bg-emerald-100 text-emerald-700",
};

function LinhaDoTempoTab({
  registros,
  processo,
  onNovoRegistro,
}: {
  registros: HistoricoRegistro[];
  processo: ProcessoExtended;
  onNovoRegistro: () => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered =
    filtroTipo === "Todos"
      ? registros
      : registros.filter((r) => r.tipo === filtroTipo);

  function handleDelete(id: string) {
    if (!confirm("Excluir este registro?")) return;
    startTransition(async () => {
      await deleteHistoricoRegistroAction(id, processo.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {["Todos", "Demanda", "Cliente", "Registro de Atividades"].map(
            (t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors cursor-pointer ${
                  filtroTipo === t
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-muted hover:bg-slate-200"
                }`}
              >
                {t}
              </button>
            )
          )}
        </div>
        <button onClick={onNovoRegistro} className={btnPrimary}>
          <PlusIcon className="h-3.5 w-3.5" />
          Novo registro
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ClockIcon className="h-8 w-8 text-slate-300" />
          <p className="font-body text-sm text-muted">
            Nenhum registro na linha do tempo
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-border ml-3 space-y-4 pl-6">
          {filtered.map((reg) => (
            <div key={reg.id} className="relative">
              <div className="absolute -left-[29px] top-3 h-3 w-3 rounded-full border-2 border-primary bg-white" />
              <div
                className={`rounded-xl border p-4 ${reg.destaque ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-bold ${TIPO_REGISTRO_CORES[reg.tipo] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {reg.tipo}
                    </span>
                    {reg.destaque && (
                      <span className="rounded-full bg-amber-200 px-2.5 py-0.5 font-body text-[11px] font-bold text-amber-800">
                        ★ Destaque
                      </span>
                    )}
                    {reg.situacao && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-[11px] text-slate-600">
                        {reg.situacao}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(reg.id)}
                    className={btnDanger}
                  >
                    Excluir
                  </button>
                </div>
                <p className="font-body text-sm text-fg whitespace-pre-wrap leading-relaxed">
                  {reg.texto}
                </p>
                <div className="mt-2 flex gap-4 font-body text-xs text-muted">
                  <span>{reg.created_at_formatted}</span>
                  {reg.data_referencia && (
                    <span>Ref: {reg.data_referencia}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Eventos Section ─────────────────────────────────────────────

const TIPO_EVENTO_CORES: Record<string, string> = {
  Audiência: "bg-blue-50 text-blue-700",
  Perícia: "bg-violet-50 text-violet-700",
  Prazo: "bg-red-50 text-red-700",
  Protocolo: "bg-emerald-50 text-emerald-700",
  Reunião: "bg-amber-50 text-amber-700",
};

function EventoRow({
  ev,
  processo,
}: {
  ev: EventoControle;
  processo: ProcessoExtended;
}) {
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(ev.titulo);
  const [tipo, setTipo] = useState(ev.tipo ?? "");
  const [data, setData] = useState(
    ev.data ? ev.data.split("/").reverse().join("-") : ""
  );
  const [hora, setHora] = useState(ev.hora ?? "");
  const [local, setLocal] = useState(ev.local ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const concluido = ev.status === "concluido";

  function handleDarBaixa() {
    startTransition(async () => {
      await darBaixaEventoControleAction(ev.id, processo.id);
      router.refresh();
    });
  }

  function handleReabrir() {
    startTransition(async () => {
      await reabrirEventoControleAction(ev.id, processo.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Excluir evento?")) return;
    startTransition(async () => {
      await deleteEventoControleAction(ev.id, processo.id);
      router.refresh();
    });
  }

  async function handleSave() {
    setSaving(true);
    await updateEventoControleAction({
      id: ev.id,
      processoId: processo.id,
      titulo,
      tipo: tipo || null,
      data: data || null,
      hora: hora || null,
      local: local || null,
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const inputSm =
    "rounded-lg border border-border bg-white px-2.5 py-1.5 font-body text-sm text-fg focus:border-primary focus:outline-none w-full";

  if (editing) {
    return (
      <li className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título *"
          className={inputSm}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={inputSm}
          >
            <option value="">— Tipo —</option>
            {Object.keys(TIPO_EVENTO_CORES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={inputSm}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className={inputSm}
          />
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Local"
            className={inputSm}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !titulo.trim()}
            className="flex-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        concluido ? "border-border bg-slate-50 opacity-70" : "border-border"
      }`}
    >
      {/* Checkbox de status */}
      <button
        onClick={concluido ? handleReabrir : handleDarBaixa}
        title={concluido ? "Reabrir" : "Dar baixa"}
        style={{ touchAction: "manipulation" }}
        className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
          concluido
            ? "bg-emerald-500 border-emerald-500"
            : "border-border hover:border-emerald-500"
        }`}
      >
        {concluido && <CheckIcon className="h-2.5 w-2.5 text-white" />}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-body text-sm font-semibold ${concluido ? "line-through text-muted" : "text-fg"}`}
          >
            {ev.titulo}
          </span>
          {ev.tipo && (
            <span
              className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${TIPO_EVENTO_CORES[ev.tipo] ?? "bg-slate-100 text-slate-500"}`}
            >
              {ev.tipo}
            </span>
          )}
          {concluido && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-body text-[10px] font-semibold text-emerald-700">
              Concluído
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-1 font-body text-xs text-muted">
          {ev.data && (
            <span>
              {ev.data}
              {ev.hora ? ` às ${ev.hora}` : ""}
            </span>
          )}
          {ev.local && <span>📍 {ev.local}</span>}
          {ev.responsavel_nome && <span>👤 {ev.responsavel_nome}</span>}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="rounded px-2 py-1 font-body text-[11px] text-muted hover:text-primary transition-colors"
        >
          Editar
        </button>
        <button onClick={handleDelete} className={btnDanger}>
          ×
        </button>
      </div>
    </li>
  );
}

function EventosSection({
  eventos,
  processo,
  onNovo,
}: {
  eventos: EventoControle[];
  processo: ProcessoExtended;
  onNovo: () => void;
}) {
  const ativos = eventos.filter((e) => e.status !== "concluido").length;

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-base font-semibold text-fg">
          Eventos / Controles ({ativos}/{eventos.length})
        </h2>
        <button onClick={onNovo} className={btnOutline}>
          <PlusIcon className="h-3.5 w-3.5" />
          Novo evento
        </button>
      </div>

      {eventos.length === 0 ? (
        <p className="font-body text-sm text-muted text-center py-6">
          Nenhum evento registrado
        </p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((ev) => (
            <EventoRow key={ev.id} ev={ev} processo={processo} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Responsável Section ────────────────────────────────────────

function ResponsavelSection({
  processo,
  colaboradores,
}: {
  processo: ProcessoExtended;
  colaboradores: ColaboradorSimples[];
}) {
  const [value, setValue] = useState(processo.responsavel_id ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(v: string) {
    setValue(v);
    setSaving(true);
    await updateResponsavelAction(processo.id, v || null);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h3 className="font-heading text-sm font-semibold text-fg mb-3">
        Responsável
      </h3>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className={selectCls}
        >
          <option value="">— Sem responsável —</option>
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.cargo})
            </option>
          ))}
        </select>
        {saving && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <SpinnerIcon className="h-4 w-4 text-muted" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tarefas Section ────────────────────────────────────────────

function TarefasSection({
  tarefas,
  processo,
  onNova,
  sessionLogin,
}: {
  tarefas: TarefaProcesso[];
  processo: ProcessoExtended;
  onNova: () => void;
  sessionLogin?: string;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const isConcluida = (t: TarefaProcesso) =>
    t.status === "Concluída" || t.status === "concluida";

  function toggleStatus(t: TarefaProcesso) {
    startTransition(async () => {
      if (isConcluida(t)) {
        await reabrirTarefaProcessoAction(t.id, processo.id);
      } else {
        await darBaixaTarefaProcessoAction(t.id, processo.id);
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Excluir tarefa?")) return;
    startTransition(async () => {
      await deleteTarefaAction(id, processo.id);
      router.refresh();
    });
  }

  const PRIORIDADE_DOT: Record<string, string> = {
    Alta: "bg-red-500",
    Normal: "bg-amber-500",
    Baixa: "bg-slate-400",
  };

  const pendentes = tarefas.filter((t) => !isConcluida(t));

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-sm font-semibold text-fg">
          Tarefas ({pendentes.length}/{tarefas.length})
        </h3>
        <button
          onClick={onNova}
          className="font-body text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
        >
          + Nova
        </button>
      </div>

      {tarefas.length === 0 ? (
        <p className="font-body text-xs text-muted text-center py-4">
          Sem tarefas
        </p>
      ) : (
        <ul className="space-y-2">
          {tarefas.map((t) => {
            const done = isConcluida(t);
            const isMinha = sessionLogin && t.responsavel === sessionLogin;
            return (
              <li
                key={t.id}
                className={`flex items-start gap-2 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${isMinha && !done ? "bg-amber-50/70" : ""}`}
              >
                <button
                  onClick={() => toggleStatus(t)}
                  title={done ? "Reabrir tarefa" : "Dar baixa"}
                  style={{ touchAction: "manipulation" }}
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                    done
                      ? "bg-emerald-600 border-emerald-600"
                      : "border-border hover:border-emerald-500"
                  }`}
                >
                  {done && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-body text-sm leading-tight ${done ? "line-through text-muted" : "text-fg"}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${PRIORIDADE_DOT[t.prioridade] ?? "bg-slate-400"}`}
                    />
                    {t.titulo}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-0.5 font-body text-[11px] text-muted">
                    {t.responsavel && (
                      <span
                        className={
                          isMinha ? "font-semibold text-amber-700" : ""
                        }
                      >
                        {isMinha ? "Você" : t.responsavel}
                      </span>
                    )}
                    {t.prazo && <span>· {t.prazo}</span>}
                    {done && (
                      <span className="text-emerald-600 font-semibold">
                        ✓ Concluída
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className={btnDanger}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {sessionLogin &&
        pendentes.some((t) => t.responsavel === sessionLogin) && (
          <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 font-body text-xs font-semibold text-amber-700">
            Você tem tarefas pendentes. Clique no checkbox para dar baixa.
          </p>
        )}
    </div>
  );
}

// ── Pendências Section ─────────────────────────────────────────

function PendenciasSection({
  pendencias,
  processo,
  onNova,
}: {
  pendencias: PendenciaCliente[];
  processo: ProcessoExtended;
  onNova: () => void;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggle(p: PendenciaCliente) {
    const next = p.status === "pendente" ? "resolvida" : "pendente";
    startTransition(async () => {
      await updatePendenciaStatusAction(p.id, next, processo.id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Excluir pendência?")) return;
    startTransition(async () => {
      await deletePendenciaAction(id, processo.id);
      router.refresh();
    });
  }

  function handleWhatsApp(descricao: string) {
    const msg = encodeURIComponent(
      `Olá! Temos uma pendência referente ao seu processo:\n\n${descricao}\n\nPor favor, providencie o mais breve possível. Grato(a)!`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-sm font-semibold text-fg">
          Pendências ({pendencias.filter((p) => p.status === "pendente").length}
          )
        </h3>
        <button
          onClick={onNova}
          className="font-body text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
        >
          + Nova
        </button>
      </div>

      {pendencias.length === 0 ? (
        <p className="font-body text-xs text-muted text-center py-4">
          Sem pendências
        </p>
      ) : (
        <ul className="space-y-2">
          {pendencias.map((p) => (
            <li key={p.id} className="flex items-start gap-2">
              <button
                onClick={() => toggle(p)}
                className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  p.status === "resolvida"
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-amber-400 hover:border-amber-500"
                }`}
              >
                {p.status === "resolvida" && (
                  <CheckIcon className="h-2.5 w-2.5 text-white" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-body text-xs leading-relaxed ${p.status === "resolvida" ? "line-through text-muted" : "text-fg"}`}
                >
                  {p.descricao}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {p.status === "pendente" && (
                  <button
                    onClick={() => handleWhatsApp(p.descricao)}
                    title="Solicitar via WhatsApp"
                    className="text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer font-body text-xs font-semibold"
                  >
                    WA
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  className={btnDanger}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Docs Automatizados Section ─────────────────────────────────

const DOCS_PADRAO = [
  {
    key: "procuracao",
    label: "Procuração Ad Judicia",
    desc: "Com dados do cliente preenchidos",
  },
  {
    key: "contrato_honorarios",
    label: "Contrato de Honorários",
    desc: "Prestação de serviços advocatícios",
  },
  {
    key: "declaracao_hipossuficiencia",
    label: "Declaração de Hipossuficiência",
    desc: "Benefícios da justiça gratuita",
  },
  {
    key: "notificacao_extrajudicial",
    label: "Notificação Extrajudicial",
    desc: "Com dados do notificante preenchidos",
  },
];

function DocsAutomatizadosSection({
  clientId,
  modelos,
}: {
  clientId: string;
  modelos: ModeloDocumento[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<"padrao" | "meus">("padrao");

  async function handleGerarPadrao(templateKey: string, label: string) {
    setLoadingKey(templateKey);
    try {
      const res = await fetch(
        `/api/clientes/${clientId}/gerar-documento?template=${templateKey}`
      );
      if (!res.ok) throw new Error("Erro ao gerar");
      const blob = await res.blob();
      downloadBlob(blob, `${label.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleGerarModelo(modeloId: string, titulo: string) {
    setLoadingKey(modeloId);
    try {
      const res = await fetch(
        `/api/gerar-modelo?modeloId=${modeloId}&clienteId=${clientId}`
      );
      if (!res.ok) throw new Error("Erro ao gerar");
      const blob = await res.blob();
      downloadBlob(blob, `${titulo.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setLoadingKey(null);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const modelosAtivos = modelos.filter((m) => m.ativo);

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <DocumentTextIcon className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold text-fg">
          Documentos Automatizados
        </h3>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border bg-slate-50 p-1 mb-4">
        <button
          onClick={() => setDocTab("padrao")}
          className={`flex-1 rounded-md py-1.5 font-body text-xs font-semibold transition-colors cursor-pointer ${
            docTab === "padrao"
              ? "bg-white text-primary shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          Padrão
        </button>
        <button
          onClick={() => setDocTab("meus")}
          className={`flex-1 rounded-md py-1.5 font-body text-xs font-semibold transition-colors cursor-pointer ${
            docTab === "meus"
              ? "bg-white text-primary shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          Meus Modelos
          {modelosAtivos.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {modelosAtivos.length}
            </span>
          )}
        </button>
      </div>

      {/* Padrão tab */}
      {docTab === "padrao" && (
        <ul className="space-y-2">
          {DOCS_PADRAO.map((doc) => (
            <li
              key={doc.key}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="font-body text-xs font-semibold text-fg">
                  {doc.label}
                </p>
                <p className="font-body text-[11px] text-muted">{doc.desc}</p>
              </div>
              <button
                onClick={() => handleGerarPadrao(doc.key, doc.label)}
                disabled={loadingKey === doc.key}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0 ml-2"
              >
                {loadingKey === doc.key ? (
                  <SpinnerIcon className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                )}
                PDF
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Meus Modelos tab */}
      {docTab === "meus" && (
        <>
          {modelosAtivos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <DocumentTextIcon className="h-7 w-7 text-slate-300" />
              <p className="font-body text-xs text-muted">
                Nenhum modelo cadastrado
              </p>
              <Link
                href="/dashboard/modelos/novo"
                className="font-body text-xs font-semibold text-primary hover:underline"
              >
                Criar modelo →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {modelosAtivos.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-xs font-semibold text-fg truncate">
                      {m.titulo}
                    </p>
                    {m.descricao && (
                      <p className="font-body text-[11px] text-muted truncate">
                        {m.descricao}
                      </p>
                    )}
                    {m.categoria && (
                      <p className="font-body text-[10px] text-slate-400">
                        {m.categoria}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleGerarModelo(m.id, m.titulo)}
                    disabled={loadingKey === m.id}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0 ml-2"
                  >
                    {loadingKey === m.id ? (
                      <SpinnerIcon className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <Link
              href="/dashboard/modelos"
              className="font-body text-xs font-semibold text-primary hover:underline"
            >
              Gerenciar modelos →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────

function AvancarFaseModal({
  processo,
  onClose,
}: {
  processo: ProcessoExtended;
  onClose: () => void;
}) {
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAvancar() {
    setError(null);
    startTransition(async () => {
      const result = await avancarFaseAction(processo.id, "elaboracao");
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Avançar Fase" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <p className="font-body text-sm text-muted">
          Você está avançando este processo de <strong>Pré-contrato</strong>{" "}
          para <strong>Elaboração</strong>.
        </p>
        <div className="rounded-lg border border-border p-4 bg-slate-50 space-y-1">
          <p className="font-body text-xs text-muted font-semibold uppercase tracking-wide">
            Processo
          </p>
          <p className="font-body text-sm font-semibold text-fg">
            {processo.tipo_acao}
          </p>
          <p className="font-body text-xs text-muted">{processo.client_name}</p>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleAvancar}
          disabled={loading}
          className={btnPrimary}
        >
          {loading ? <SpinnerIcon className="h-4 w-4" /> : null}
          Confirmar Avanço
        </button>
      </div>
    </Modal>
  );
}

function ArquivarModal({
  processo,
  onClose,
}: {
  processo: ProcessoExtended;
  onClose: () => void;
}) {
  const [resultado, setResultado] = useState("");
  const [obs, setObs] = useState("");
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const RESULTADOS = [
    "Deferido",
    "Indeferido",
    "Parcialmente deferido",
    "Falta de viabilidade",
    "Desistência",
    "Acordo extrajudicial",
    "Sentença favorável",
    "Sentença desfavorável",
    "Outro",
  ];

  function handleArquivar() {
    if (!resultado) {
      setError("Selecione o resultado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await arquivarProcessoAction(processo.id, resultado, obs);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Arquivar Processo" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelCls}>Resultado *</label>
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className={selectCls}
          >
            <option value="">Selecione…</option>
            {RESULTADOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Observação</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            placeholder="Observação final sobre o processo…"
            className="w-full resize-none rounded-lg border border-border bg-white p-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleArquivar}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 h-9 font-body text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <SpinnerIcon className="h-4 w-4" />
          ) : (
            <FolderOpenIcon className="h-4 w-4" />
          )}
          Arquivar
        </button>
      </div>
    </Modal>
  );
}

function NovoRegistroModal({
  processo,
  onClose,
}: {
  processo: ProcessoExtended;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("Demanda");
  const [dataRef, setDataRef] = useState("");
  const [situacao, setSituacao] = useState("");
  const [destaque, setDestaque] = useState(false);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleCreate() {
    setError(null);
    if (!texto.trim()) {
      setError("O texto é obrigatório.");
      return;
    }
    startTransition(async () => {
      const result = await createHistoricoRegistroAction({
        processoId: processo.id,
        clientId: processo.client_id,
        texto,
        tipo,
        dataReferencia: dataRef || null,
        situacao: situacao || null,
        destaque,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Novo Registro" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelCls}>Tipo de registro</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={selectCls}
          >
            <option value="Demanda">Demanda</option>
            <option value="Cliente">Cliente</option>
            <option value="Registro de Atividades">
              Registro de Atividades
            </option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Texto *</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder="Descreva o registro…"
            className="w-full resize-none rounded-lg border border-border bg-white p-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Data referência</label>
            <input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Situação</label>
            <input
              type="text"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              placeholder="Ex: Em análise"
              className={inputCls}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={destaque}
            onChange={(e) => setDestaque(e.target.checked)}
            className="rounded border-border"
          />
          <span className="font-body text-sm text-fg">
            Marcar como destaque
          </span>
        </label>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className={btnPrimary}
        >
          {loading && <SpinnerIcon className="h-4 w-4" />}
          Salvar Registro
        </button>
      </div>
    </Modal>
  );
}

function NovoEventoModal({
  processo,
  colaboradores,
  onClose,
}: {
  processo: ProcessoExtended;
  colaboradores: ColaboradorSimples[];
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState("");
  const [link, setLink] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createEventoControleAction({
        processoId: processo.id,
        titulo,
        tipo: tipo || null,
        data: data || null,
        hora: hora || null,
        local: local || null,
        linkVirtual: link || null,
        responsavelId: responsavelId || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Novo Evento / Controle" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelCls}>Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Audiência de instrução"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={selectCls}
            >
              <option value="">— Selecione —</option>
              {[
                "Audiência",
                "Perícia",
                "Prazo",
                "Protocolo",
                "Reunião",
                "Outro",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Responsável</label>
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Local</label>
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex: Fórum Central, sala 3"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Link virtual</label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/…"
            className={inputCls}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className={btnPrimary}
        >
          {loading && <SpinnerIcon className="h-4 w-4" />}
          Salvar Evento
        </button>
      </div>
    </Modal>
  );
}

function NovaTarefaModal({
  processo,
  colaboradores,
  onClose,
}: {
  processo: ProcessoExtended;
  colaboradores: ColaboradorSimples[];
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prioridade, setPrioridade] = useState("Normal");
  const [prazo, setPrazo] = useState("");
  const [hora, setHora] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createTarefaProcessoAction({
        processoId: processo.id,
        clientId: processo.client_id,
        titulo,
        responsavel: responsavel || null,
        prioridade,
        prazo: prazo || null,
        hora: hora || null,
        comentarios: comentarios || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Nova Tarefa" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelCls}>Tarefa *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Descreva a tarefa…"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Responsável</label>
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className={selectCls}
            >
              <option value="">— Selecione —</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className={selectCls}
            >
              <option value="Alta">Alta</option>
              <option value="Normal">Normal</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Prazo</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Comentários</label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-white p-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className={btnPrimary}
        >
          {loading && <SpinnerIcon className="h-4 w-4" />}
          Salvar Tarefa
        </button>
      </div>
    </Modal>
  );
}

function NovaPendenciaModal({
  processo,
  onClose,
}: {
  processo: ProcessoExtended;
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createPendenciaAction({
        processoId: processo.id,
        clientId: processo.client_id,
        descricao,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal title="Nova Pendência" onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={labelCls}>Pendência *</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            placeholder="Descreva o documento ou informação pendente do cliente…"
            className="w-full resize-none rounded-lg border border-border bg-white p-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 font-body text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button onClick={onClose} className={btnOutline}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className={btnPrimary}
        >
          {loading && <SpinnerIcon className="h-4 w-4" />}
          Adicionar Pendência
        </button>
      </div>
    </Modal>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function ProcessoDetailClient({
  processo,
  historico,
  eventos,
  tarefas,
  pendencias,
  colaboradores,
  modelos,
  sessionLogin,
}: Props) {
  const [tab, setTab] = useState<Tab>("dados");
  const [avancarOpen, setAvancarOpen] = useState(false);
  const [arquivarOpen, setArquivarOpen] = useState(false);
  const [novoRegistroOpen, setNovoRegistroOpen] = useState(false);
  const [novoEventoOpen, setNovoEventoOpen] = useState(false);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [novaPendenciaOpen, setNovaPendenciaOpen] = useState(false);

  const TABS: { key: Tab; label: string }[] = [
    { key: "dados", label: "Dados" },
    { key: "relato", label: "Relato" },
    { key: "linha_do_tempo", label: "Linha do Tempo" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Cliente
              </span>
              <Link
                href={`/dashboard/clientes/${processo.client_id}`}
                className="font-heading text-xl font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {processo.client_name}
              </Link>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                  processo.status === "ativo"
                    ? "bg-emerald-50 text-emerald-700"
                    : processo.status === "arquivado"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    processo.status === "ativo"
                      ? "bg-emerald-500"
                      : processo.status === "arquivado"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                {processo.status === "ativo"
                  ? "Ativo"
                  : processo.status === "arquivado"
                    ? "Arquivado"
                    : "Encerrado"}
              </span>
            </div>
            <p className="font-heading text-base font-semibold text-fg">
              {processo.tipo_acao}
            </p>
            {processo.numero && (
              <p className="font-mono text-xs text-muted mt-0.5">
                {processo.numero}
              </p>
            )}
            <div className="flex gap-3 mt-1.5">
              <Link
                href={`/dashboard/clientes/${processo.client_id}`}
                className="font-body text-xs text-primary hover:underline"
              >
                Ficha do cliente →
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-start">
            <Link
              href={`/dashboard/processos/${processo.id}/editar`}
              className={btnOutline}
            >
              Editar
            </Link>
            <Link
              href={`/dashboard/financeiro/novo?client_id=${processo.client_id}&processo_id=${processo.id}`}
              className={btnOutline}
            >
              Financeiro
            </Link>
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <FaseTimeline
        processo={processo}
        onAvancar={() => setAvancarOpen(true)}
        onArquivar={() => setArquivarOpen(true)}
      />

      {/* Linha de Produção */}
      <ProducaoBar processo={processo} />

      {/* IA Jurídica — Analisar Documento | Diagnóstico Estratégico | Gerar Petição */}
      <IaJuridicaSection
        clienteId={processo.client_id}
        processoId={processo.id}
        areaProcesso={processo.area}
      />

      {/* Cérebro Jurídico — roda depois dos documentos analisados */}
      <CerebroPanel processoId={processo.id} processoStatus={processo.status} />

      {/* Petições salvas do processo */}
      <IaPeticoesProcesso
        processoId={processo.id}
        clienteId={processo.client_id}
        areaProcesso={processo.area}
      />

      {/* Tab Nav */}
      <div className="flex gap-1 rounded-xl border border-border bg-white p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors cursor-pointer ${
              tab === t.key
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-slate-100 hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {tab === "dados" && <DadosTab processo={processo} />}
        {tab === "relato" && <RelatoTab processo={processo} />}
        {tab === "linha_do_tempo" && (
          <LinhaDoTempoTab
            registros={historico}
            processo={processo}
            onNovoRegistro={() => setNovoRegistroOpen(true)}
          />
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Eventos / Controles — 2 cols */}
        <div className="lg:col-span-2">
          <EventosSection
            eventos={eventos}
            processo={processo}
            onNovo={() => setNovoEventoOpen(true)}
          />
        </div>

        {/* Sidebar — 1 col */}
        <div className="flex flex-col gap-4">
          <ResponsavelSection
            processo={processo}
            colaboradores={colaboradores}
          />
          <TarefasSection
            tarefas={tarefas}
            processo={processo}
            onNova={() => setNovaTarefaOpen(true)}
            sessionLogin={sessionLogin}
          />
          <PendenciasSection
            pendencias={pendencias}
            processo={processo}
            onNova={() => setNovaPendenciaOpen(true)}
          />
          <DocsAutomatizadosSection
            clientId={processo.client_id}
            modelos={modelos}
          />
        </div>
      </div>

      {/* Modals */}
      {avancarOpen && processo.fase_workflow === "pre_contrato" && (
        <AvancarFaseModal
          processo={processo}
          onClose={() => setAvancarOpen(false)}
        />
      )}
      {arquivarOpen && (
        <ArquivarModal
          processo={processo}
          onClose={() => setArquivarOpen(false)}
        />
      )}
      {novoRegistroOpen && (
        <NovoRegistroModal
          processo={processo}
          onClose={() => setNovoRegistroOpen(false)}
        />
      )}
      {novoEventoOpen && (
        <NovoEventoModal
          processo={processo}
          colaboradores={colaboradores}
          onClose={() => setNovoEventoOpen(false)}
        />
      )}
      {novaTarefaOpen && (
        <NovaTarefaModal
          processo={processo}
          colaboradores={colaboradores}
          onClose={() => setNovaTarefaOpen(false)}
        />
      )}
      {novaPendenciaOpen && (
        <NovaPendenciaModal
          processo={processo}
          onClose={() => setNovaPendenciaOpen(false)}
        />
      )}
    </div>
  );
}
