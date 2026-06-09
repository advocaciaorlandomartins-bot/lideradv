"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type {
  MinhaItem,
  MinhaControle,
  MinhaTarefa,
} from "@/lib/minhas-tarefas-db";
import {
  darBaixaControleAction,
  darBaixaTarefaAction,
  reabrirControleAction,
  reabrirTarefaAction,
} from "@/lib/minhas-tarefas-actions";
import {
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  ArchiveBoxIcon,
} from "@/components/icons";
import { ESTAGIO_PRODUCAO_META } from "@/lib/producao-types";

const TIPO_LABELS: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Implantado",
  alvaras: "Alvará",
};

const TIPO_COLORS: Record<string, string> = {
  audiencias: "bg-violet-100 text-violet-700",
  prazos: "bg-red-100 text-red-700",
  pericias: "bg-cyan-100 text-cyan-700",
  dcb: "bg-orange-100 text-orange-700",
  beneficios: "bg-emerald-100 text-emerald-700",
  implantados: "bg-blue-100 text-blue-700",
  alvaras: "bg-amber-100 text-amber-700",
};

function parseDeadline(str: string | null): Date | null {
  if (!str) return null;
  if (str.includes("/")) {
    const [d, m, y] = str.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(str);
}

function deadlineBadge(
  deadline: string | null
): { label: string; cls: string } | null {
  const date = parseDeadline(deadline);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0)
    return {
      label: `${Math.abs(diff)}d atraso`,
      cls: "bg-red-100 text-red-700 font-bold",
    };
  if (diff === 0)
    return { label: "Hoje!", cls: "bg-red-100 text-red-700 font-bold" };
  if (diff === 1)
    return { label: "Amanhã", cls: "bg-orange-100 text-orange-700" };
  if (diff <= 3)
    return { label: `${diff}d`, cls: "bg-amber-100 text-amber-700" };
  if (diff <= 7) return { label: `${diff}d`, cls: "bg-blue-100 text-blue-700" };
  return { label: `${diff}d`, cls: "bg-slate-100 text-slate-600" };
}

function formatDeadlineDisplay(deadline: string | null): string | null {
  if (!deadline) return null;
  if (deadline.includes("/")) return deadline;
  const [y, m, d] = deadline.split("-");
  return `${d}/${m}/${y}`;
}

interface ItemCardProps {
  item: MinhaItem;
  isConcluida?: boolean;
}

function ItemCard({ item, isConcluida = false }: ItemCardProps) {
  const [pending, startTransition] = useTransition();

  const isControle = item.source === "controle";
  const ctrl = isControle ? (item as MinhaControle) : null;
  const tarefa = !isControle ? (item as MinhaTarefa) : null;

  const title = isControle ? ctrl!.descricao : tarefa!.titulo;
  const clienteNome = item.cliente_nome;
  const clienteId = item.cliente_id;
  const processoNumero = item.processo_numero;
  const processoId = isControle ? ctrl!.processo_id : tarefa!.processo_id;
  const verHref = processoId
    ? `/dashboard/processos/${processoId}`
    : clienteId
      ? `/dashboard/clientes/${clienteId}`
      : null;
  const deadline = isControle ? ctrl!.data_evento : tarefa!.prazo;

  const badge = deadlineBadge(deadline);
  const deadlineDisplay = formatDeadlineDisplay(deadline);

  const tipoKey = isControle ? ctrl!.tipo : null;
  const tipoLabel = tipoKey ? (TIPO_LABELS[tipoKey] ?? tipoKey) : null;
  const tipoCls = tipoKey
    ? (TIPO_COLORS[tipoKey] ?? "bg-slate-100 text-slate-600")
    : null;

  const estagioProducao = isControle
    ? ctrl!.estagio_producao
    : tarefa!.estagio_producao;
  const estagioMeta =
    estagioProducao && estagioProducao in ESTAGIO_PRODUCAO_META
      ? ESTAGIO_PRODUCAO_META[
          estagioProducao as keyof typeof ESTAGIO_PRODUCAO_META
        ]
      : null;

  const prioridade = tarefa?.prioridade;
  const prioridadeCls =
    prioridade === "Alta"
      ? "bg-red-100 text-red-700"
      : prioridade === "Normal"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-500";

  function handleDarBaixa() {
    startTransition(async () => {
      if (isControle) {
        await darBaixaControleAction(item.id);
      } else {
        await darBaixaTarefaAction(item.id);
      }
    });
  }

  function handleReabrir() {
    startTransition(async () => {
      if (isControle) {
        await reabrirControleAction(item.id);
      } else {
        await reabrirTarefaAction(item.id);
      }
    });
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-opacity ${
        pending ? "opacity-50 pointer-events-none" : ""
      } ${isConcluida ? "border-border opacity-70" : "border-border hover:border-primary/30 hover:shadow-md"}`}
    >
      {/* Card body */}
      <div className="p-4">
        {/* Badges row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded px-1.5 py-0.5 font-body text-[10px] font-semibold ${
              isControle
                ? "bg-violet-100 text-violet-700"
                : "bg-teal-100 text-teal-700"
            }`}
          >
            {isControle ? "Controle" : "Tarefa"}
          </span>
          {tipoLabel && tipoCls && (
            <span
              className={`rounded px-1.5 py-0.5 font-body text-[10px] font-semibold ${tipoCls}`}
            >
              {tipoLabel}
            </span>
          )}
          {prioridade && (
            <span
              className={`rounded px-1.5 py-0.5 font-body text-[10px] font-semibold ${prioridadeCls}`}
            >
              {prioridade}
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className={`font-body text-sm font-semibold leading-snug ${isConcluida ? "text-muted line-through" : "text-fg"}`}
        >
          {title}
        </p>

        {/* Client */}
        {clienteNome && (
          <p className="mt-1 font-body text-xs font-semibold text-primary truncate">
            {clienteNome}
          </p>
        )}

        {/* Número do processo (texto, não link — navegação está no botão Ver) */}
        {processoNumero && (
          <p className="mt-0.5 font-body text-xs text-muted truncate">
            Proc. {processoNumero}
          </p>
        )}

        {/* Estágio de produção + link */}
        {estagioMeta && (
          <Link
            href="/dashboard/producao"
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] font-semibold transition-opacity hover:opacity-80 ${estagioMeta.bg} ${estagioMeta.color}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${estagioMeta.dot}`} />
            {estagioMeta.label}
          </Link>
        )}

        {/* Deadline */}
        {deadlineDisplay && (
          <div className="mt-2 flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 text-muted flex-shrink-0" />
            <span className="font-body text-xs text-muted">
              {deadlineDisplay}
            </span>
            {badge && (
              <span
                className={`rounded-full px-2 py-0.5 font-body text-[10px] font-bold ${badge.cls}`}
              >
                {badge.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action bar — isolated from card body so no Link/button overlap on mobile */}
      <div className="border-t border-border px-3 pb-3 pt-3">
        {isConcluida ? (
          <button
            onClick={handleReabrir}
            disabled={pending}
            style={{ touchAction: "manipulation" }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 font-body text-[12px] font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary active:bg-slate-50 disabled:opacity-50"
          >
            Reabrir
          </button>
        ) : (
          <div className="flex gap-2">
            {/* Ver processo ou cliente */}
            {verHref && (
              <Link
                href={verHref}
                style={{ touchAction: "manipulation" }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 font-body text-[12px] font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary active:bg-slate-50"
              >
                <FolderOpenIcon className="h-4 w-4 flex-shrink-0" />
                Ver
              </Link>
            )}
            {/* Dar baixa */}
            <button
              onClick={handleDarBaixa}
              disabled={pending}
              style={{ touchAction: "manipulation" }}
              className={`flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 font-body text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 ${verHref ? "flex-1" : "w-full"}`}
            >
              <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
              Dar baixa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface KanbanColaboradorProps {
  pendentes: MinhaItem[];
  emAndamento: MinhaItem[];
  concluidas: MinhaItem[];
  login: string;
}

interface ColumnProps {
  title: string;
  count: number;
  items: MinhaItem[];
  headerCls: string;
  dotCls: string;
  emptyText: string;
}

function KanbanColumn({
  title,
  count,
  items,
  headerCls,
  dotCls,
  emptyText,
}: ColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${headerCls}`}
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotCls}`} />
        <h2 className="font-heading text-sm font-semibold flex-1">{title}</h2>
        <span className="rounded-full bg-white/60 px-2 py-0.5 font-body text-[11px] font-bold">
          {count}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-8 text-center">
          <p className="font-body text-xs text-muted">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <ItemCard key={`${item.source}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KanbanColaborador({
  pendentes,
  emAndamento,
  concluidas,
}: KanbanColaboradorProps) {
  const [showArquivados, setShowArquivados] = useState(false);
  const ativas = pendentes.length + emAndamento.length;

  if (ativas === 0 && concluidas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 py-16 text-center">
        <CheckCircleIcon className="mb-3 h-10 w-10 text-emerald-400" />
        <p className="font-heading text-base font-semibold text-fg">
          Tudo em dia!
        </p>
        <p className="mt-1 font-body text-sm text-muted">
          Nenhuma tarefa ou controle atribuído a você no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Kanban — 2 colunas ativas */}
      {ativas > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KanbanColumn
            title="Pendente"
            count={pendentes.length}
            items={pendentes}
            headerCls="bg-amber-50 text-amber-800"
            dotCls="bg-amber-500"
            emptyText="Nenhuma pendência"
          />
          <KanbanColumn
            title="Em Andamento"
            count={emAndamento.length}
            items={emAndamento}
            headerCls="bg-blue-50 text-blue-800"
            dotCls="bg-blue-500"
            emptyText="Nenhuma em andamento"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 py-10 text-center">
          <CheckCircleIcon className="mb-2 h-8 w-8 text-emerald-400" />
          <p className="font-body text-sm font-semibold text-fg">
            Sem pendências ativas
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Todos os itens foram concluídos.
          </p>
        </div>
      )}

      {/* Seção Arquivados — igual ao padrão da Produção */}
      {concluidas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <ArchiveBoxIcon className="h-4 w-4 text-muted" />
              <span className="font-body text-sm font-semibold text-muted">
                Arquivados
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-bold text-slate-500">
                {concluidas.length}
              </span>
            </div>
            <button
              onClick={() => setShowArquivados((v) => !v)}
              style={{ touchAction: "manipulation" }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-body text-sm transition-colors ${
                showArquivados
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted hover:border-primary hover:text-primary"
              }`}
            >
              <ArchiveBoxIcon className="h-3.5 w-3.5" />
              {showArquivados
                ? "Ocultar"
                : `Ver ${concluidas.length} arquivado${concluidas.length !== 1 ? "s" : ""}`}
            </button>
          </div>

          {showArquivados && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {concluidas.map((item) => (
                <ItemCard
                  key={`${item.source}-${item.id}`}
                  item={item}
                  isConcluida
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
