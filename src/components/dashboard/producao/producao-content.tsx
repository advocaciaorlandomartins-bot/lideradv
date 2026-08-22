"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SpinnerIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";
import {
  ESTAGIOS_PRODUCAO,
  ESTAGIO_PRODUCAO_META,
  RESULTADO_ADMIN_META,
  RESULTADO_JUDICIAL_META,
  type ProcessoProducao,
  type EstagioProducao,
} from "@/lib/producao-types";
import {
  moverParaProducaoAction,
  moverParaAdministrativoAction,
  registrarResultadoAdminAction,
  registrarResultadoJudicialAction,
  registrarProtocoloAdminAction,
  registrarDistribuicaoJudicialAction,
  arquivarProcessoAction,
  reabrirProcessoAction,
  voltarEstagioAction,
} from "@/lib/producao-actions";
import { getProximaAcaoProcesso } from "@/lib/processo-fases";

// Estágios lineares (arquivado é ponto final, não entra no stepper)
const PIPELINE = ["analise", "producao", "administrativo", "judicial"] as const;

// ── Stepper de progressão ─────────────────────────────────────────────────────

function ProgressoStepper({ estagio }: { estagio: EstagioProducao }) {
  const isArquivado = estagio === "arquivado";
  const currentIdx = PIPELINE.indexOf(estagio as (typeof PIPELINE)[number]);

  return (
    <div className="flex items-center gap-0">
      {PIPELINE.map((e, i) => {
        const meta = ESTAGIO_PRODUCAO_META[e];
        const isCurrent = e === estagio;
        const isDone = isArquivado || i < currentIdx;
        const isFuture = !isArquivado && i > currentIdx;

        return (
          <div key={e} className="flex items-center">
            {/* Bolinha */}
            <div
              title={meta.label}
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all
                ${isCurrent ? `${meta.dot} border-transparent text-white shadow-sm` : ""}
                ${isDone ? "border-transparent bg-slate-300 text-white" : ""}
                ${isFuture ? "border-slate-200 bg-white text-slate-300" : ""}
              `}
            >
              {isDone && !isCurrent ? (
                <svg
                  className="h-2.5 w-2.5"
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
            {/* Linha conectora */}
            {i < PIPELINE.length - 1 && (
              <div
                className={`h-0.5 w-5 ${i < currentIdx || isArquivado ? "bg-slate-300" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}

      {/* Arquivado — ponto final */}
      <div className="flex items-center">
        <div
          className={`h-0.5 w-5 ${isArquivado ? "bg-slate-300" : "bg-slate-200"}`}
        />
        <div
          title="Arquivado"
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold
            ${
              isArquivado
                ? "border-transparent bg-slate-400 text-white"
                : "border-slate-200 bg-white text-slate-300"
            }
          `}
        >
          <ArchiveBoxIcon className="h-2.5 w-2.5" />
        </div>
      </div>

      {/* Label da etapa atual */}
      <span
        className={`ml-2 font-body text-[10px] font-semibold ${ESTAGIO_PRODUCAO_META[estagio].color}`}
      >
        {ESTAGIO_PRODUCAO_META[estagio].label}
      </span>
    </div>
  );
}

// ── Dias badge ────────────────────────────────────────────────────────────────

function DiasBadge({ dias }: { dias: number }) {
  const cls =
    dias < 7
      ? "bg-green-100 text-green-700"
      : dias < 30
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${cls}`}
    >
      {dias}d
    </span>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function ProducaoCard({ processo }: { processo: ProcessoProducao }) {
  const [showForm, setShowForm] = useState(false);
  const [showFormProtocolo, setShowFormProtocolo] = useState(false);
  const [showFormDistribuicao, setShowFormDistribuicao] = useState(false);
  const [resultadoAdmin, setResultadoAdmin] = useState<"concedido" | "negado">(
    "concedido"
  );
  const [proximoAdmin, setProximoAdmin] = useState<"judicial" | "arquivado">(
    "arquivado"
  );
  const [resultadoJudicial, setResultadoJudicial] = useState<
    "procedente" | "improcedente" | "parcial"
  >("procedente");
  const hoje = new Date().toISOString().slice(0, 10);
  const [protocoloNumero, setProtocoloNumero] = useState("");
  const [protocoloData, setProtocoloData] = useState(hoje);
  const [distribuicaoData, setDistribuicaoData] = useState(hoje);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const estagio = processo.estagio_producao;
  const inputClass =
    "w-full rounded-lg border border-border bg-white px-2.5 py-1.5 font-body text-sm text-fg focus:border-primary focus:outline-none";

  const proximaAcao = getProximaAcaoProcesso({
    estagio_producao: processo.estagio_producao,
    resultado_administrativo: processo.resultado_administrativo,
    resultado_judicial: processo.resultado_judicial,
    protocolo_inss: processo.protocolo_inss,
    data_protocolo_inss: processo.data_protocolo_inss_iso,
    data_distribuicao: processo.data_distribuicao_iso,
  });

  function registrarProtocolo() {
    startTransition(async () => {
      await registrarProtocoloAdminAction(
        processo.id,
        protocoloNumero,
        protocoloData
      );
      setShowFormProtocolo(false);
      router.refresh();
    });
  }

  function registrarDistribuicao() {
    startTransition(async () => {
      await registrarDistribuicaoJudicialAction(
        processo.id,
        "",
        distribuicaoData
      );
      setShowFormDistribuicao(false);
      router.refresh();
    });
  }

  function avancarAdmin() {
    startTransition(async () => {
      const proximo =
        resultadoAdmin === "concedido" ? "arquivado" : proximoAdmin;
      await registrarResultadoAdminAction(processo.id, resultadoAdmin, proximo);
      setShowForm(false);
      router.refresh();
    });
  }

  function avancarJudicial() {
    startTransition(async () => {
      await registrarResultadoJudicialAction(processo.id, resultadoJudicial);
      setShowForm(false);
      router.refresh();
    });
  }

  const nextBtnBase =
    "flex items-center gap-1 rounded-lg border px-2 py-1 font-body text-[11px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
      {/* Stepper */}
      <div className="mb-3">
        <ProgressoStepper estagio={estagio} />
      </div>

      {/* Dados do processo */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-body text-sm font-semibold text-fg leading-tight">
            {processo.client_name}
          </p>
          <p className="truncate font-body text-xs text-muted">
            {processo.tipo_acao} · {processo.area}
          </p>
          {processo.numero && (
            <p className="truncate font-body text-[11px] text-muted">
              {processo.numero}
            </p>
          )}
          <p className="truncate font-body text-[11px] text-muted">
            Resp.: {processo.responsavel_nome ?? "Sem responsável"}
          </p>
        </div>
        <DiasBadge dias={processo.dias_no_estagio} />
      </div>

      {/* Próxima ação — mostra se já deu entrada e só falta o resultado, ou
          se ainda precisa dar entrada, pra não ficar parecendo pendência
          infinita quando na verdade já está andando */}
      {proximaAcao && (
        <div
          className={`mb-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 ${
            proximaAcao.urgente
              ? "bg-red-50"
              : proximaAcao.aguardando
                ? "bg-blue-50"
                : "bg-slate-50"
          }`}
        >
          <span
            className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
              proximaAcao.urgente
                ? "bg-red-500"
                : proximaAcao.aguardando
                  ? "bg-blue-500"
                  : "bg-slate-400"
            }`}
          />
          <p
            className={`font-body text-[11px] font-semibold leading-tight ${
              proximaAcao.urgente
                ? "text-red-700"
                : proximaAcao.aguardando
                  ? "text-blue-700"
                  : "text-slate-600"
            }`}
          >
            {proximaAcao.aguardando ? "Aguardando: " : ""}
            {proximaAcao.label}
          </p>
        </div>
      )}

      {/* Tarefas pendentes badge */}
      {processo.tarefas_pendentes > 0 && (
        <div className="mb-2">
          <Link
            href="/dashboard/minhas-tarefas"
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-body text-[10px] font-semibold text-amber-700 transition-opacity hover:opacity-80"
          >
            <svg
              className="h-3 w-3 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            {processo.tarefas_pendentes} tarefa
            {processo.tarefas_pendentes !== 1 ? "s" : ""} pendente
            {processo.tarefas_pendentes !== 1 ? "s" : ""}
          </Link>
        </div>
      )}

      {/* Badges de resultado */}
      {(processo.resultado_administrativo || processo.resultado_judicial) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {processo.resultado_administrativo && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 font-body text-[10px] font-medium
                ${RESULTADO_ADMIN_META[processo.resultado_administrativo].bg}
                ${RESULTADO_ADMIN_META[processo.resultado_administrativo].color}`}
            >
              Adm:{" "}
              {RESULTADO_ADMIN_META[processo.resultado_administrativo].label}
            </span>
          )}
          {processo.resultado_judicial && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 font-body text-[10px] font-medium
                ${RESULTADO_JUDICIAL_META[processo.resultado_judicial].bg}
                ${RESULTADO_JUDICIAL_META[processo.resultado_judicial].color}`}
            >
              Jud: {RESULTADO_JUDICIAL_META[processo.resultado_judicial].label}
            </span>
          )}
        </div>
      )}

      {/* ── Ações de progressão ── */}
      {!showForm && !showFormProtocolo && !showFormDistribuicao && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <Link
            href={`/dashboard/processos/${processo.id}`}
            className="flex items-center gap-1 rounded px-1.5 py-1 font-body text-[11px] text-muted transition-colors hover:text-primary"
          >
            <FolderOpenIcon className="h-3 w-3" />
            Ver
          </Link>

          {/* ← Voltar (disponível em producao, administrativo, judicial) */}
          {["producao", "administrativo", "judicial"].includes(estagio) && (
            <button
              onClick={() =>
                startTransition(async () => {
                  const r = await voltarEstagioAction(processo.id);
                  if (r?.error) alert(r.error);
                  router.refresh();
                })
              }
              disabled={isPending}
              className="flex items-center gap-1 rounded px-1.5 py-1 font-body text-[11px] text-muted transition-colors hover:text-fg disabled:opacity-50"
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

          {/* Análise → Produção */}
          {estagio === "analise" && (
            <button
              onClick={() =>
                startTransition(async () => {
                  const r = await moverParaProducaoAction(processo.id);
                  if (r?.error) alert(r.error);
                  router.refresh();
                })
              }
              disabled={isPending}
              className={`${nextBtnBase} border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100`}
            >
              {isPending ? (
                <SpinnerIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
              Iniciar Produção
            </button>
          )}

          {/* Produção → Administrativo */}
          {estagio === "producao" && (
            <button
              onClick={() =>
                startTransition(async () => {
                  const r = await moverParaAdministrativoAction(processo.id);
                  if (r?.error) alert(r.error);
                  router.refresh();
                })
              }
              disabled={isPending}
              className={`${nextBtnBase} border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100`}
            >
              {isPending ? (
                <SpinnerIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
              Protocolar Adm.
            </button>
          )}

          {/* Administrativo, ainda sem protocolo → dar entrada */}
          {estagio === "administrativo" &&
            !processo.data_protocolo_inss_iso && (
              <button
                onClick={() => setShowFormProtocolo(true)}
                className={`${nextBtnBase} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
              >
                <ChevronRightIcon className="h-3 w-3" />
                Registrar Protocolo
              </button>
            )}

          {/* Administrativo → resultado (concedido → arquivo / negado → judicial ou arquivo) */}
          {estagio === "administrativo" && (
            <button
              onClick={() => setShowForm(true)}
              className={`${nextBtnBase} border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100`}
            >
              <ChevronRightIcon className="h-3 w-3" />
              Registrar Resultado
            </button>
          )}

          {/* Judicial, ainda sem distribuição → dar entrada na ação */}
          {estagio === "judicial" && !processo.data_distribuicao_iso && (
            <button
              onClick={() => setShowFormDistribuicao(true)}
              className={`${nextBtnBase} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
            >
              <ChevronRightIcon className="h-3 w-3" />
              Registrar Distribuição
            </button>
          )}

          {/* Judicial → resultado (sempre arquiva) */}
          {estagio === "judicial" && (
            <button
              onClick={() => setShowForm(true)}
              className={`${nextBtnBase} border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100`}
            >
              <ChevronRightIcon className="h-3 w-3" />
              Registrar Resultado
            </button>
          )}

          {/* Arquivado → Reabrir (volta para análise) */}
          {estagio === "arquivado" && (
            <button
              onClick={() =>
                startTransition(async () => {
                  const r = await reabrirProcessoAction(processo.id);
                  if (r?.error) alert(r.error);
                  router.refresh();
                })
              }
              disabled={isPending}
              className="flex items-center gap-1 rounded px-1.5 py-1 font-body text-[11px] text-muted transition-colors hover:text-primary disabled:opacity-50"
            >
              {isPending && <SpinnerIcon className="h-3 w-3" />}
              Reabrir
            </button>
          )}

          {/* Arquivar direto — apenas para cancelar, disponível em qualquer etapa ativa */}
          {estagio !== "arquivado" && (
            <button
              onClick={() => {
                if (
                  !confirm(
                    "Arquivar este processo? O fluxo de produção será encerrado."
                  )
                )
                  return;
                startTransition(async () => {
                  await arquivarProcessoAction(processo.id);
                  router.refresh();
                });
              }}
              disabled={isPending}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 font-body text-[11px] text-muted transition-colors hover:text-red-600 disabled:opacity-50"
            >
              <ArchiveBoxIcon className="h-3 w-3" />
              Arquivar
            </button>
          )}
        </div>
      )}

      {/* ── Form inline — Resultado Administrativo ── */}
      {showForm && estagio === "administrativo" && (
        <div className="mt-2 space-y-2.5 border-t border-border pt-2.5">
          <p className="font-body text-xs font-semibold text-fg">
            Resultado Administrativo
          </p>
          <select
            value={resultadoAdmin}
            onChange={(e) =>
              setResultadoAdmin(e.target.value as "concedido" | "negado")
            }
            className={inputClass}
          >
            <option value="concedido">Concedido ✓</option>
            <option value="negado">Negado ✗</option>
          </select>

          {resultadoAdmin === "negado" && (
            <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5">
              <p className="font-body text-xs font-medium text-muted">
                Próxima etapa:
              </p>
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
                  Arquivar (sem judicial)
                </span>
              </label>
            </div>
          )}

          {resultadoAdmin === "concedido" && (
            <p className="font-body text-[11px] text-green-700 bg-green-50 rounded px-2 py-1.5">
              O processo será arquivado como concedido.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={avancarAdmin}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
            >
              {isPending && <SpinnerIcon className="h-3 w-3" />}
              Confirmar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Form inline — Resultado Judicial ── */}
      {showForm && estagio === "judicial" && (
        <div className="mt-2 space-y-2.5 border-t border-border pt-2.5">
          <p className="font-body text-xs font-semibold text-fg">
            Resultado Judicial
          </p>
          <select
            value={resultadoJudicial}
            onChange={(e) =>
              setResultadoJudicial(
                e.target.value as "procedente" | "improcedente" | "parcial"
              )
            }
            className={inputClass}
          >
            <option value="procedente">Procedente ✓</option>
            <option value="improcedente">Improcedente ✗</option>
            <option value="parcial">Parcial Procedente</option>
          </select>
          <p className="font-body text-[11px] text-muted">
            O processo será arquivado após confirmar.
          </p>
          <div className="flex gap-2">
            <button
              onClick={avancarJudicial}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
            >
              {isPending && <SpinnerIcon className="h-3 w-3" />}
              Confirmar e Arquivar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Form inline — Protocolo Administrativo ── */}
      {showFormProtocolo && (
        <div className="mt-2 space-y-2.5 border-t border-border pt-2.5">
          <p className="font-body text-xs font-semibold text-fg">
            Protocolo do Requerimento Administrativo
          </p>
          <input
            type="text"
            value={protocoloNumero}
            onChange={(e) => setProtocoloNumero(e.target.value)}
            placeholder="Número do protocolo (opcional)"
            className={inputClass}
          />
          <input
            type="date"
            value={protocoloData}
            onChange={(e) => setProtocoloData(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              onClick={registrarProtocolo}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
            >
              {isPending && <SpinnerIcon className="h-3 w-3" />}
              Confirmar
            </button>
            <button
              onClick={() => setShowFormProtocolo(false)}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Form inline — Distribuição Judicial ── */}
      {showFormDistribuicao && (
        <div className="mt-2 space-y-2.5 border-t border-border pt-2.5">
          <p className="font-body text-xs font-semibold text-fg">
            Distribuição da Ação Judicial
          </p>
          <input
            type="date"
            value={distribuicaoData}
            onChange={(e) => setDistribuicaoData(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              onClick={registrarDistribuicao}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-60"
            >
              {isPending && <SpinnerIcon className="h-3 w-3" />}
              Confirmar
            </button>
            <button
              onClick={() => setShowFormDistribuicao(false)}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs text-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  estagio,
  processos,
}: {
  estagio: EstagioProducao;
  processos: ProcessoProducao[];
}) {
  const meta = ESTAGIO_PRODUCAO_META[estagio];
  return (
    <div className="flex min-w-[260px] max-w-[300px] flex-1 flex-col rounded-xl border border-border bg-slate-50">
      <div
        className={`flex items-center gap-2 rounded-t-xl border-b border-border px-3 py-2.5 ${meta.bg}`}
      >
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className={`font-body text-sm font-semibold ${meta.color}`}>
          {meta.label}
        </span>
        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white font-body text-xs font-bold text-fg shadow-sm">
          {processos.length}
        </span>
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto p-2"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        {processos.length === 0 && (
          <p className="py-6 text-center font-body text-xs text-muted">
            Nenhum caso
          </p>
        )}
        {processos.map((p) => (
          <ProducaoCard key={p.id} processo={p} />
        ))}
      </div>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function StatsBar({
  processos,
  activeFilter,
  onFilter,
}: {
  processos: ProcessoProducao[];
  activeFilter: EstagioProducao | null;
  onFilter: (e: EstagioProducao) => void;
}) {
  const stats: {
    label: string;
    estagio: EstagioProducao;
    value: number;
    color: string;
    activeColor: string;
  }[] = [
    {
      label: "Análise",
      estagio: "analise",
      value: processos.filter((p) => p.estagio_producao === "analise").length,
      color: "text-blue-600",
      activeColor: "border-blue-400 bg-blue-50",
    },
    {
      label: "Produção",
      estagio: "producao",
      value: processos.filter((p) => p.estagio_producao === "producao").length,
      color: "text-teal-600",
      activeColor: "border-teal-400 bg-teal-50",
    },
    {
      label: "Administrativo",
      estagio: "administrativo",
      value: processos.filter((p) => p.estagio_producao === "administrativo")
        .length,
      color: "text-orange-600",
      activeColor: "border-orange-400 bg-orange-50",
    },
    {
      label: "Judicial",
      estagio: "judicial",
      value: processos.filter((p) => p.estagio_producao === "judicial").length,
      color: "text-purple-600",
      activeColor: "border-purple-400 bg-purple-50",
    },
    {
      label: "Arquivados",
      estagio: "arquivado",
      value: processos.filter((p) => p.estagio_producao === "arquivado").length,
      color: "text-slate-500",
      activeColor: "border-slate-400 bg-slate-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => {
        const isActive = activeFilter === s.estagio;
        return (
          <button
            key={s.label}
            onClick={() => onFilter(s.estagio)}
            className={`cursor-pointer rounded-xl border-2 p-4 shadow-sm text-left transition-all hover:shadow-md ${
              isActive
                ? s.activeColor
                : "border-border bg-white hover:border-primary/40"
            }`}
          >
            <p
              className={`font-body text-xs font-semibold ${isActive ? "" : "text-muted"}`}
            >
              {s.label}
            </p>
            <p className={`mt-1 font-heading text-2xl font-bold ${s.color}`}>
              {s.value}
            </p>
            {isActive && (
              <p className="mt-1 font-body text-[10px] font-semibold text-muted">
                clique para limpar
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProducaoContent({
  processos,
}: {
  processos: ProcessoProducao[];
}) {
  const [showArquivados, setShowArquivados] = useState(false);
  const [filterEstagio, setFilterEstagio] = useState<EstagioProducao | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [filterResponsavel, setFilterResponsavel] = useState<string | null>(
    null
  );

  const responsaveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of processos) {
      if (p.responsavel_id && p.responsavel_nome)
        map.set(p.responsavel_id, p.responsavel_nome);
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [processos]);

  function handleStatsFilter(estagio: EstagioProducao) {
    if (estagio === "arquivado") {
      setShowArquivados(true);
    }
    setFilterEstagio((prev) => (prev === estagio ? null : estagio));
  }

  const estagiosVisiveis = (() => {
    if (filterEstagio) return [filterEstagio];
    return showArquivados
      ? ESTAGIOS_PRODUCAO
      : ESTAGIOS_PRODUCAO.filter((e) => e !== "arquivado");
  })();

  const processosFiltrados = useMemo(() => {
    const q = search.toLowerCase().trim();
    return processos.filter((p) => {
      if (
        q &&
        !p.client_name.toLowerCase().includes(q) &&
        !p.tipo_acao.toLowerCase().includes(q) &&
        !(p.numero ?? "").toLowerCase().includes(q)
      )
        return false;
      if (filterResponsavel && p.responsavel_id !== filterResponsavel)
        return false;
      return true;
    });
  }, [processos, search, filterResponsavel]);

  // Contagem por responsável (processos ativos, sem contar arquivados) — usada
  // na faixa de resumo para o admin ver a carga de cada colaborador de relance.
  const contagemPorResponsavel = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of processos) {
      if (!p.responsavel_id || p.estagio_producao === "arquivado") continue;
      map.set(p.responsavel_id, (map.get(p.responsavel_id) ?? 0) + 1);
    }
    return responsaveis
      .map((r) => ({ ...r, count: map.get(r.id) ?? 0 }))
      .filter((r) => r.count > 0);
  }, [processos, responsaveis]);

  const byEstagio = Object.fromEntries(
    ESTAGIOS_PRODUCAO.map((e) => [
      e,
      processosFiltrados.filter((p) => p.estagio_producao === e),
    ])
  ) as Record<EstagioProducao, ProcessoProducao[]>;

  return (
    <div className="space-y-5">
      <StatsBar
        processos={processosFiltrados}
        activeFilter={filterEstagio}
        onFilter={handleStatsFilter}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/processos/novo"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          + Novo Processo
        </Link>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar cliente, ação, número…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {responsaveis.length > 0 && (
          <select
            value={filterResponsavel ?? ""}
            onChange={(e) => setFilterResponsavel(e.target.value || null)}
            className="h-9 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          {filterEstagio && (
            <button
              onClick={() => setFilterEstagio(null)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 font-body text-sm text-primary transition-colors hover:bg-primary/10"
            >
              Limpar filtro
            </button>
          )}
          <button
            onClick={() => {
              setShowArquivados((v) => !v);
              if (filterEstagio === "arquivado") setFilterEstagio(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm transition-colors ${
              showArquivados
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted hover:border-primary hover:text-primary"
            }`}
          >
            <ArchiveBoxIcon className="h-4 w-4" />
            {showArquivados ? "Ocultar Arquivados" : "Mostrar Arquivados"}
          </button>
        </div>
      </div>

      {!filterResponsavel && contagemPorResponsavel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Por responsável:
          </span>
          {contagemPorResponsavel.map((r) => (
            <button
              key={r.id}
              onClick={() => setFilterResponsavel(r.id)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary cursor-pointer"
            >
              {r.nome}
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted">
                {r.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {estagiosVisiveis.map((estagio) => (
            <KanbanColumn
              key={estagio}
              estagio={estagio}
              processos={byEstagio[estagio]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
