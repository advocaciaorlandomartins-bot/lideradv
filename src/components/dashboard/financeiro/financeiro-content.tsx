"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Lancamento, LancamentoKpis } from "@/lib/lancamentos-db";
import {
  markAsPagoAction,
  deleteLancamentoAction,
  deleteGrupoAction,
  reagendarLancamentoAction,
  revertParaPendenteAction,
} from "@/lib/lancamento-actions";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  TrendUpIcon,
  TrendDownIcon,
  CalendarIcon,
  SpinnerIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from "@/components/icons";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDMY(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function ddmmyyyyToISO(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function matchesSearch(l: Lancamento, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  return (
    l.descricao.toLowerCase().includes(lq) ||
    (l.client_name ?? "").toLowerCase().includes(lq) ||
    (l.categoria ?? "").toLowerCase().includes(lq)
  );
}

type DatePreset = "todos" | "hoje" | "mes" | "mes_anterior" | "ano" | "custom";
type MainTab = "pendentes" | "concluidas" | "atrasados";

function getPresetRange(preset: DatePreset): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth(),
    d = now.getDate();
  if (preset === "hoje")
    return { from: new Date(y, m, d), to: new Date(y, m, d) };
  if (preset === "mes")
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  if (preset === "mes_anterior")
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  if (preset === "ano")
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  return { from: null, to: null };
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ano", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-xl border bg-white p-3 sm:p-5 shadow-sm transition-all duration-150 min-w-0 ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "border-primary ring-2 ring-primary/20" : "border-border"} ${
        onClick && !active ? "hover:border-primary/40 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted leading-tight">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p
        className="mt-2 font-heading text-sm sm:text-xl font-semibold text-fg whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
        title={fmt(value)}
      >
        {fmt(value)}
      </p>
      {sub && <p className="mt-0.5 font-body text-xs text-muted">{sub}</p>}
    </Wrapper>
  );
}

function TipoIndicator({
  tipo,
  isPessoal,
}: {
  tipo: Lancamento["tipo"];
  isPessoal: boolean;
}) {
  if (isPessoal) {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 font-body text-[10px] font-bold text-purple-700">
        R$
      </span>
    );
  }
  return (
    <span
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-body text-[10px] font-bold ${tipo === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}
    >
      {tipo === "entrada" ? "+" : "−"}
    </span>
  );
}

// ── PaginationBar ─────────────────────────────────────────────────────────────

function PaginationBar({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  function pageWindow(): (number | "…")[] {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const left = Math.max(2, page - 2);
    const right = Math.min(totalPages - 1, page + 2);
    const acc: (number | "…")[] = [1];
    if (left > 2) acc.push("…");
    for (let i = left; i <= right; i++) acc.push(i);
    if (right < totalPages - 1) acc.push("…");
    acc.push(totalPages);
    return acc;
  }
  const pages = pageWindow();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
      <div className="flex items-center gap-1">
        <span className="mr-1 font-body text-xs text-muted">Exibir:</span>
        {[10, 20, 50].map((s) => (
          <button
            key={s}
            onClick={() => {
              onPageSize(s);
              onPage(1);
            }}
            className={`h-7 min-w-[2rem] rounded px-1.5 font-body text-xs transition-colors cursor-pointer ${pageSize === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <p className="mr-1 font-body text-xs text-muted">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{" "}
          {total}
        </p>
        {totalPages > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => onPage(1)}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-border font-body text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              «
            </button>
            <button
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              ‹
            </button>
            {pages.map((n, i) =>
              n === "…" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex h-7 w-7 items-center justify-center font-body text-xs text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => onPage(n)}
                  className={`flex h-7 w-7 items-center justify-center rounded font-body text-xs transition-colors cursor-pointer ${page === n ? "bg-primary font-semibold text-white" : "border border-border text-muted hover:border-primary hover:text-primary"}`}
                >
                  {n}
                </button>
              )
            )}
            <button
              onClick={() => onPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              ›
            </button>
            <button
              onClick={() => onPage(totalPages)}
              disabled={page === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-border font-body text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RowActions ────────────────────────────────────────────────────────────────

function RowActions({
  lancamento,
  canEdit: _canEdit,
  singleDeleteOnly = false,
  hidePayActions = false,
}: {
  lancamento: Lancamento;
  canEdit: boolean;
  singleDeleteOnly?: boolean;
  hidePayActions?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState(false);
  const [novaData, setNovaData] = useState(() =>
    ddmmyyyyToISO(lancamento.data_vencimento)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  function handlePago() {
    setMenuOpen(false);
    setAction("pago");
    startTransition(async () => {
      await markAsPagoAction(lancamento.id);
      router.refresh();
      setAction(null);
    });
  }

  function handleDesfazer() {
    setMenuOpen(false);
    setAction("desfazer");
    startTransition(async () => {
      await revertParaPendenteAction(lancamento.id);
      router.refresh();
      setAction(null);
    });
  }

  function handleReagendar() {
    if (!novaData) return;
    setAction("reagendar");
    startTransition(async () => {
      await reagendarLancamentoAction(lancamento.id, novaData);
      router.refresh();
      setAction(null);
      setReagendando(false);
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!singleDeleteOnly && lancamento.grupo_parcelas) {
      const choice = confirm(
        `Este lançamento faz parte de um grupo.\n\n• OK = excluir TODOS\n• Cancelar = excluir só este`
      );
      if (choice) {
        setAction("del");
        startTransition(async () => {
          await deleteGrupoAction(lancamento.grupo_parcelas!);
          router.refresh();
          setAction(null);
        });
        return;
      }
    } else {
      const msg = lancamento.remuneracao_id
        ? "Este lançamento é uma remuneração. Excluir também remove o registro. Confirmar?"
        : "Excluir este lançamento?";
      if (!confirm(msg)) return;
    }
    setAction("del");
    startTransition(async () => {
      await deleteLancamentoAction(lancamento.id);
      router.refresh();
      setAction(null);
    });
  }

  const loading = isPending && action !== null;

  // ── Desktop inline actions ─────────────────────────────────────────────────
  const desktopActions = (
    <div className="hidden sm:flex items-center gap-1.5">
      {lancamento.status === "pago" && (
        <button
          onClick={handleDesfazer}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-body text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
        >
          {loading && action === "desfazer" ? (
            <SpinnerIcon className="h-3 w-3" />
          ) : null}
          Desfazer
        </button>
      )}
      {lancamento.status === "pendente" && !hidePayActions && (
        <>
          <button
            onClick={handlePago}
            disabled={loading}
            className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-body text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
          >
            {loading && action === "pago" ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : null}
            {lancamento.tipo === "entrada" ? "Recebi" : "Paguei"}
          </button>
          {!reagendando ? (
            <button
              onClick={() => setReagendando(true)}
              className="flex items-center gap-1 rounded-md border border-border bg-slate-50 px-2 py-1 font-body text-[11px] font-semibold text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
            >
              <CalendarIcon className="h-3 w-3" />
              Reagendar
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="h-6 rounded border border-border bg-white px-1.5 font-body text-[11px] text-fg outline-none focus:border-primary"
              />
              <button
                onClick={handleReagendar}
                disabled={loading || !novaData}
                className="rounded-md bg-primary px-1.5 py-0.5 font-body text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {loading && action === "reagendar" ? "…" : "OK"}
              </button>
              <button
                onClick={() => setReagendando(false)}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 font-body text-[11px] text-muted hover:bg-slate-200 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
      {lancamento.status !== "cancelado" && (
        <Link
          href={`/dashboard/financeiro/${lancamento.id}/editar`}
          className="flex items-center gap-1 rounded-md border border-border bg-slate-50 px-2 py-1 font-body text-[11px] font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-primary"
        >
          Abrir
        </Link>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="font-body text-[11px] font-semibold text-red-500 transition-colors hover:text-red-700 disabled:opacity-40 cursor-pointer"
      >
        {loading && action === "del" ? "…" : "Excluir"}
      </button>
    </div>
  );

  // ── Mobile ⋮ dropdown ──────────────────────────────────────────────────────
  const mobileMenu = (
    <div ref={menuRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={loading}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
      >
        {loading ? (
          <SpinnerIcon className="h-3.5 w-3.5" />
        ) : (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-xl">
          {lancamento.status === "pendente" && !hidePayActions && (
            <button
              onClick={handlePago}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 font-body text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <BanknotesIcon className="h-4 w-4 flex-shrink-0" />
              {lancamento.tipo === "entrada" ? "Recebi" : "Paguei"}
            </button>
          )}
          {lancamento.status === "pendente" && !hidePayActions && (
            <button
              onClick={() => {
                setMenuOpen(false);
                setReagendando(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 font-body text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              <CalendarIcon className="h-4 w-4 flex-shrink-0" />
              Reagendar
            </button>
          )}
          {lancamento.status === "pago" && (
            <button
              onClick={handleDesfazer}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 font-body text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              <SpinnerIcon className="h-4 w-4 flex-shrink-0" />
              Desfazer
            </button>
          )}
          {lancamento.status !== "cancelado" && (
            <Link
              href={`/dashboard/financeiro/${lancamento.id}/editar`}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 font-body text-sm font-semibold text-fg hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4 flex-shrink-0 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16.657V19h2.343a2 2 0 001.415-.586l6.586-6.586"
                />
              </svg>
              Abrir / Editar
            </Link>
          )}
          <div className="mx-3 my-1 border-t border-border" />
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 font-body text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"
              />
            </svg>
            Excluir
          </button>
        </div>
      )}

      {/* Reagendar inline (mobile) */}
      {reagendando && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-xl">
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReagendar}
              disabled={loading || !novaData}
              className="flex-1 rounded-lg bg-primary py-1.5 font-body text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && action === "reagendar" ? "…" : "Confirmar"}
            </button>
            <button
              onClick={() => setReagendando(false)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 font-body text-sm text-muted hover:bg-slate-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {desktopActions}
      {mobileMenu}
    </>
  );
}

// ── LancamentoRow (shared by all tabs) ───────────────────────────────────────

function LancamentoRow({
  l,
  canEdit,
  singleDeleteOnly = false,
  showPagoEm = false,
  highlightOverdue = false,
  hidePayActions = false,
}: {
  l: Lancamento;
  canEdit: boolean;
  singleDeleteOnly?: boolean;
  showPagoEm?: boolean;
  highlightOverdue?: boolean;
  hidePayActions?: boolean;
}) {
  const isPessoal = l.remuneracao_id !== null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = parseDMY(l.data_vencimento).getTime() === today.getTime();

  const rowBorder = isPessoal
    ? "border-l-2 border-l-purple-300"
    : l.tipo === "entrada"
      ? "border-l-2 border-l-emerald-400"
      : "border-l-2 border-l-red-400";

  return (
    <tr className={`group transition-colors hover:bg-primary/5 ${rowBorder}`}>
      <td className="px-3 py-2">
        <span
          className={`flex items-center gap-1 font-body text-[11px] font-semibold ${highlightOverdue ? (isToday ? "text-amber-600" : "text-red-600") : "text-fg"}`}
        >
          <CalendarIcon className="h-3 w-3 flex-shrink-0" />
          <span className="whitespace-nowrap">{l.data_vencimento}</span>
          {highlightOverdue && isToday && (
            <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-body text-[10px] font-bold text-amber-700">
              Hoje
            </span>
          )}
        </span>
      </td>
      <td className="min-w-0 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <TipoIndicator tipo={l.tipo} isPessoal={isPessoal} />
          <div className="min-w-0">
            <p className="truncate font-body text-xs font-semibold text-fg">
              {l.descricao}
            </p>
            <p className="truncate font-body text-[10px] text-muted">
              {[
                l.client_name,
                l.parcela_atual != null
                  ? l.parcela_atual === 0
                    ? "Entrada"
                    : `Parcela ${l.parcela_atual}/${l.total_parcelas}`
                  : null,
                isPessoal ? "Pessoal" : l.categoria,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </td>
      <td
        className={`px-3 py-2 text-right font-body text-xs font-semibold tabular-nums ${isPessoal ? "text-purple-700" : l.tipo === "entrada" ? "text-emerald-700" : "text-red-600"}`}
      >
        {l.tipo === "entrada" ? "+" : "−"} {fmt(l.valor)}
      </td>
      {showPagoEm && (
        <td className="truncate px-3 py-2 font-body text-[11px] text-muted">
          {l.data_pagamento ?? "—"}
        </td>
      )}
      <td className="px-3 py-2">
        <RowActions
          lancamento={l}
          canEdit={canEdit}
          singleDeleteOnly={singleDeleteOnly}
          hidePayActions={hidePayActions}
        />
      </td>
    </tr>
  );
}

// ── MobileFab ─────────────────────────────────────────────────────────────────

function MobileFab() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2 lg:hidden"
    >
      {open && (
        <>
          <Link
            href="/dashboard/financeiro/novo?tipo=entrada"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full bg-emerald-600 py-2.5 pl-4 pr-5 font-body text-sm font-semibold text-white shadow-lg transition-all hover:bg-emerald-700"
          >
            <PlusIcon className="h-4 w-4" />
            Nova Receita
          </Link>
          <Link
            href="/dashboard/financeiro/novo?tipo=saida"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full bg-red-600 py-2.5 pl-4 pr-5 font-body text-sm font-semibold text-white shadow-lg transition-all hover:bg-red-700"
          >
            <PlusIcon className="h-4 w-4" />
            Nova Despesa
          </Link>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200 ${open ? "rotate-45 bg-slate-700" : "bg-primary"}`}
        aria-label="Novo lançamento"
      >
        <PlusIcon className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  lancamentos: Lancamento[];
  kpis: LancamentoKpis;
  canEdit: boolean;
}

const AGUARDANDO_LIMIT = 3;

function AguardandoSection({
  lista,
  canEdit,
  fmt,
}: {
  lista: Lancamento[];
  canEdit: boolean;
  fmt: (v: number) => string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento aguardando resultado?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteLancamentoAction(id);
      router.refresh();
      setDeletingId(null);
    });
  }
  const visible = expanded ? lista : lista.slice(0, AGUARDANDO_LIMIT);
  const hidden = lista.length - AGUARDANDO_LIMIT;

  function ActionButtons({ l }: { l: Lancamento }) {
    return (
      <>
        <Link
          href={`/dashboard/financeiro/novo?tipo=entrada${l.client_id ? `&client_id=${l.client_id}` : ""}${l.processo_id ? `&processo_id=${l.processo_id}` : ""}&cancel_aguardando=${l.id}&valor_inicial=${l.valor}&back=/dashboard/financeiro`}
          className="rounded border border-emerald-500 bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Registrar resultado
        </Link>
        <Link
          href={`/dashboard/financeiro/${l.id}/editar`}
          className="rounded border border-border bg-white px-2.5 py-1 font-body text-[11px] text-muted hover:text-fg"
        >
          Editar
        </Link>
        <button
          type="button"
          onClick={() => handleDelete(l.id)}
          disabled={isPending && deletingId === l.id}
          className="rounded border border-red-200 bg-white px-2.5 py-1 font-body text-[11px] text-red-500 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
        >
          {isPending && deletingId === l.id ? "…" : "Excluir"}
        </button>
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100/60 px-4 py-3">
        <h2 className="font-heading text-sm font-bold text-amber-900">
          Aguardando resultado
        </h2>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 font-body text-[11px] font-bold text-amber-800">
          {lista.length}
        </span>
      </div>

      {/* Mobile: cartões */}
      <div className="divide-y divide-amber-100 sm:hidden">
        {visible.map((l) => (
          <div key={l.id} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-body text-xs font-semibold text-fg">
                  {l.descricao}
                </p>
                <p className="font-body text-[10px] text-muted">
                  {[l.client_name, l.categoria].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="flex-shrink-0 font-body text-xs font-semibold text-emerald-700 tabular-nums">
                +{fmt(l.valor)}
              </span>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-1.5">
                <ActionButtons l={l} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <tbody>
            {visible.map((l) => (
              <tr
                key={l.id}
                className="border-b border-amber-100 last:border-0"
              >
                <td className="w-36 px-4 py-2.5">
                  <span className="font-body text-[11px] font-semibold text-amber-700">
                    Sem data definida
                  </span>
                </td>
                <td className="min-w-0 px-3 py-2.5">
                  <p className="truncate font-body text-xs font-semibold text-fg">
                    {l.descricao}
                  </p>
                  <p className="truncate font-body text-[10px] text-muted">
                    {[l.client_name, l.categoria].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="w-32 px-3 py-2.5 text-right font-body text-xs font-semibold tabular-nums text-emerald-700">
                  +{fmt(l.valor)}
                </td>
                {canEdit && (
                  <td className="w-64 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <ActionButtons l={l} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2">
        <div className="flex items-center gap-3">
          <p className="font-body text-[11px] text-amber-700">
            Total esperado:{" "}
            <span className="font-semibold text-amber-900">
              {fmt(lista.reduce((s, l) => s + l.valor, 0))}
            </span>
          </p>
          {lista.length > AGUARDANDO_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-body text-[11px] font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 cursor-pointer"
            >
              {expanded
                ? "Ver menos"
                : `+${hidden} ${hidden === 1 ? "item" : "itens"}`}
            </button>
          )}
        </div>
        <p className="font-body text-[11px] text-amber-600">
          Definir data quando o resultado for confirmado
        </p>
      </div>
    </div>
  );
}

export default function FinanceiroContent({ lancamentos, canEdit }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>("pendentes");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "entrada" | "saida">(
    "todos"
  );
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pagePendentes, setPagePendentes] = useState(1);
  const [pageSizePendentes, setPageSizePendentes] = useState(10);
  const [pageAtrasados, setPageAtrasados] = useState(1);
  const [pageSizeAtrasados, setPageSizeAtrasados] = useState(10);
  const [pageConcluidas, setPageConcluidas] = useState(1);
  const [pageSizeConcluidas, setPageSizeConcluidas] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const l of lancamentos) {
      if (l.categoria) set.add(l.categoria);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lancamentos]);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();
    const all = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const yy = d.getFullYear(),
        mm = d.getMonth();
      const month = d
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(". ", "/")
        .replace(".", "");
      let receitas = 0,
        despesas = 0;
      for (const l of lancamentos) {
        const ld = parseDMY(l.data_vencimento);
        if (ld.getFullYear() === yy && ld.getMonth() === mm) {
          if (l.tipo === "entrada") receitas += l.valor;
          else if (l.tipo === "saida") despesas += l.valor;
        }
      }
      return { month, receitas, despesas };
    });
    // remove leading months with no data at all
    const firstWithData = all.findIndex(
      (d) => d.receitas > 0 || d.despesas > 0
    );
    return firstWithData === -1 ? all.slice(-6) : all.slice(firstWithData);
  }, [lancamentos]);

  const projecaoMeses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yy = d.getFullYear();
      const mm = d.getMonth();
      let aReceber = 0;
      let aPagar = 0;
      for (const l of lancamentos) {
        if (l.status !== "pendente") continue;
        const ld = parseDMY(l.data_vencimento);
        if (ld.getFullYear() === yy && ld.getMonth() === mm) {
          if (l.tipo === "entrada") aReceber += l.valor;
          else if (l.tipo === "saida") aPagar += l.valor;
        }
      }
      return {
        label: d
          .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
          .replace(". ", "/")
          .replace(".", ""),
        isAtual: i === 0,
        aReceber,
        aPagar,
        saldo: aReceber - aPagar,
      };
    });
  }, [lancamentos]);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59") : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const dateFiltered = useMemo(() => {
    return lancamentos.filter((l) => {
      if (!dateRange.from && !dateRange.to) return true;
      const refStr =
        l.status === "pago" && l.data_pagamento
          ? l.data_pagamento
          : l.data_vencimento;
      const ref = parseDMY(refStr);
      if (dateRange.from && ref < dateRange.from) return false;
      if (dateRange.to && ref > dateRange.to) return false;
      return true;
    });
  }, [lancamentos, dateRange]);

  const filteredKpis = useMemo(() => {
    let aReceber = 0,
      recebido = 0,
      aPagar = 0,
      pago = 0,
      folhaPendente = 0,
      folhaPaga = 0;
    for (const l of dateFiltered) {
      if (l.tipo === "entrada") {
        if (l.status === "pendente") aReceber += l.valor;
        else if (l.status === "pago") recebido += l.valor;
      } else if (l.tipo === "saida") {
        if (l.status === "pendente") aPagar += l.valor;
        else if (l.status === "pago") pago += l.valor;
        if (l.remuneracao_id !== null) {
          if (l.status === "pendente") folhaPendente += l.valor;
          else if (l.status === "pago") folhaPaga += l.valor;
        }
      }
    }
    return { aReceber, recebido, aPagar, pago, folhaPendente, folhaPaga };
  }, [dateFiltered]);

  const saldo = filteredKpis.recebido - filteredKpis.pago;

  const pendentesVencidos = useMemo(() => {
    const q = search.toLowerCase().trim();
    return lancamentos
      .filter(
        (l) =>
          l.status === "pendente" &&
          parseDMY(l.data_vencimento) <= today &&
          matchesSearch(l, q) &&
          (tipoFilter === "todos" || l.tipo === tipoFilter) &&
          (categoryFilter === "todas" || l.categoria === categoryFilter)
      )
      .sort(
        (a, b) =>
          parseDMY(a.data_vencimento).getTime() -
          parseDMY(b.data_vencimento).getTime()
      );
  }, [lancamentos, today, search, tipoFilter, categoryFilter]);

  const pendentesNaoVencidos = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dateFiltered
      .filter(
        (l) =>
          l.status === "pendente" &&
          parseDMY(l.data_vencimento) > today &&
          matchesSearch(l, q) &&
          (tipoFilter === "todos" || l.tipo === tipoFilter) &&
          (categoryFilter === "todas" || l.categoria === categoryFilter)
      )
      .sort(
        (a, b) =>
          parseDMY(a.data_vencimento).getTime() -
          parseDMY(b.data_vencimento).getTime()
      );
  }, [dateFiltered, today, search, tipoFilter, categoryFilter]);

  const aguardandoLista = useMemo(() => {
    const q = search.toLowerCase().trim();
    return lancamentos
      .filter(
        (l) =>
          l.status === "aguardando_resultado" &&
          matchesSearch(l, q) &&
          (tipoFilter === "todos" || l.tipo === tipoFilter) &&
          (categoryFilter === "todas" || l.categoria === categoryFilter)
      )
      .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  }, [lancamentos, search, tipoFilter, categoryFilter]);

  const concluidas = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dateFiltered
      .filter(
        (l) =>
          l.status !== "pendente" &&
          l.status !== "aguardando_resultado" &&
          matchesSearch(l, q) &&
          (tipoFilter === "todos" || l.tipo === tipoFilter) &&
          (categoryFilter === "todas" || l.categoria === categoryFilter)
      )
      .sort(
        (a, b) =>
          parseDMY(b.data_vencimento).getTime() -
          parseDMY(a.data_vencimento).getTime()
      );
  }, [dateFiltered, search, tipoFilter, categoryFilter]);

  const concluidasTotals = useMemo(() => {
    let receitas = 0,
      despesas = 0;
    for (const l of concluidas) {
      if (l.status === "pago") {
        if (l.tipo === "entrada") receitas += l.valor;
        else if (l.tipo === "saida") despesas += l.valor;
      }
    }
    return { receitas, despesas, total: receitas - despesas };
  }, [concluidas]);

  const paginatedPendentes = pendentesNaoVencidos.slice(
    (pagePendentes - 1) * pageSizePendentes,
    pagePendentes * pageSizePendentes
  );
  const paginatedAtrasados = pendentesVencidos.slice(
    (pageAtrasados - 1) * pageSizeAtrasados,
    pageAtrasados * pageSizeAtrasados
  );
  const paginatedConcluidas = concluidas.slice(
    (pageConcluidas - 1) * pageSizeConcluidas,
    pageConcluidas * pageSizeConcluidas
  );

  function handleDatePreset(p: DatePreset) {
    setDatePreset(p);
    setPageConcluidas(1);
    setPagePendentes(1);
    setPageAtrasados(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPageConcluidas(1);
    setPagePendentes(1);
    setPageAtrasados(1);
  }

  function handleTipoFilter(t: typeof tipoFilter) {
    setTipoFilter(t);
    setPageConcluidas(1);
    setPagePendentes(1);
    setPageAtrasados(1);
  }

  function handleKpiClick(tab: MainTab, tipo: "entrada" | "saida") {
    setMainTab(tab);
    setTipoFilter(tipo);
    setPageConcluidas(1);
    setPagePendentes(1);
    setPageAtrasados(1);
  }

  function handleCategoryFilter(cat: string) {
    setCategoryFilter(cat);
    setPageConcluidas(1);
    setPagePendentes(1);
    setPageAtrasados(1);
  }

  function exportCSV() {
    const all = [...pendentesVencidos, ...pendentesNaoVencidos, ...concluidas];
    const headers = [
      "ID",
      "Tipo",
      "Categoria",
      "Descrição",
      "Cliente",
      "Valor",
      "Status",
      "Vencimento",
      "Pago em",
    ];
    const rows = all.map((l) => [
      l.id,
      l.tipo === "entrada" ? "Receita" : "Despesa",
      l.categoria ?? "",
      l.descricao,
      l.client_name ?? "",
      l.valor.toFixed(2).replace(".", ","),
      l.status,
      l.data_vencimento,
      l.data_pagamento ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Shared table column layout ──────────────────────────────────────────────

  const colsPendentes = (
    <colgroup>
      <col className="w-[112px]" />
      <col />
      <col className="w-[100px]" />
      <col className="w-[280px]" />
    </colgroup>
  );

  const colsConcluidas = (
    <colgroup>
      <col className="w-[112px]" />
      <col />
      <col className="w-[100px]" />
      <col className="w-[100px]" />
      <col className="w-[180px]" />
    </colgroup>
  );

  const thBase =
    "px-3 py-2 text-left font-body text-[10px] font-semibold uppercase tracking-wide text-muted";

  return (
    <div className="space-y-5">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="A Receber"
          value={filteredKpis.aReceber}
          sub={`${lancamentos.filter((l) => l.tipo === "entrada" && l.status === "pendente").length} lançamentos`}
          color="bg-blue-50 text-blue-600"
          icon={TrendUpIcon}
          active={mainTab === "pendentes" && tipoFilter === "entrada"}
          onClick={() => handleKpiClick("pendentes", "entrada")}
        />
        <KpiCard
          label="Recebido"
          value={filteredKpis.recebido}
          sub="entradas pagas"
          color="bg-emerald-50 text-emerald-600"
          icon={BanknotesIcon}
          active={mainTab === "concluidas" && tipoFilter === "entrada"}
          onClick={() => handleKpiClick("concluidas", "entrada")}
        />
        <KpiCard
          label="A Pagar"
          value={filteredKpis.aPagar}
          sub={`${lancamentos.filter((l) => l.tipo === "saida" && l.status === "pendente").length} lançamentos`}
          color="bg-amber-50 text-amber-600"
          icon={TrendDownIcon}
          active={mainTab === "pendentes" && tipoFilter === "saida"}
          onClick={() => handleKpiClick("pendentes", "saida")}
        />
        <KpiCard
          label="Pago"
          value={filteredKpis.pago}
          sub="saídas pagas"
          color="bg-slate-100 text-slate-500"
          icon={BanknotesIcon}
          active={mainTab === "concluidas" && tipoFilter === "saida"}
          onClick={() => handleKpiClick("concluidas", "saida")}
        />
        <div
          className={`col-span-2 rounded-xl border bg-white p-5 shadow-sm lg:col-span-1 ${saldo >= 0 ? "border-emerald-200" : "border-red-200"}`}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Saldo do período
          </p>
          <p
            className={`mt-3 font-heading text-2xl font-semibold ${saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}
          >
            {fmt(saldo)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">Recebido − Pago</p>
        </div>
      </div>

      {/* ── Projeção 6 meses ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <CalendarIcon className="h-4 w-4 text-muted" />
          <span className="font-heading text-sm font-semibold text-fg">
            Projeção — Próximos 6 Meses
          </span>
          <span className="ml-auto font-body text-xs text-muted">
            Lançamentos pendentes
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-6">
          {projecaoMeses.map((m) => (
            <div
              key={m.label}
              className={`rounded-lg border p-3 ${m.isAtual ? "border-blue-200 bg-blue-50/60" : "border-border bg-surface"}`}
            >
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-heading text-xs font-semibold text-fg">
                  {m.label}
                </span>
                {m.isAtual && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-px font-body text-[9px] font-bold uppercase tracking-wide text-blue-600">
                    Atual
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-body text-[10px] text-muted">
                    Receber
                  </span>
                  <span className="font-body text-[10px] font-semibold text-emerald-600 tabular-nums">
                    {fmt(m.aReceber)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-body text-[10px] text-muted">
                    Pagar
                  </span>
                  <span className="font-body text-[10px] font-semibold text-red-500 tabular-nums">
                    {fmt(m.aPagar)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1 border-t border-border/50 pt-1">
                  <span className="font-body text-[10px] font-semibold text-muted">
                    Saldo
                  </span>
                  <span
                    className={`font-body text-[10px] font-bold tabular-nums ${m.saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {fmt(Math.abs(m.saldo))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Honorários aguardando resultado judicial ─────────────────────── */}
      {aguardandoLista.length > 0 && (
        <AguardandoSection
          lista={aguardandoLista}
          canEdit={canEdit}
          fmt={fmt}
        />
      )}

      {/* ── Barra de controles unificada ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Abas de situação + filtro de tipo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab situação */}
          <div className="flex gap-1 rounded-xl border border-border bg-white p-1 shadow-sm">
            <button
              onClick={() => setMainTab("pendentes")}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors duration-150 ${mainTab === "pendentes" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-fg"}`}
            >
              <BanknotesIcon className="h-4 w-4" />
              Pendentes
              {pendentesNaoVencidos.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${mainTab === "pendentes" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}
                >
                  {pendentesNaoVencidos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMainTab("concluidas")}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors duration-150 ${mainTab === "concluidas" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-fg"}`}
            >
              <TrendUpIcon className="h-4 w-4" />
              Concluídas
              {concluidas.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${mainTab === "concluidas" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {concluidas.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMainTab("atrasados")}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors duration-150 ${mainTab === "atrasados" ? "bg-red-600 text-white shadow-sm" : pendentesVencidos.length > 0 ? "text-red-600 hover:text-red-700" : "text-muted hover:text-fg"}`}
            >
              <TrendDownIcon className="h-4 w-4" />
              Vencidos
              {pendentesVencidos.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${mainTab === "atrasados" ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}
                >
                  {pendentesVencidos.length}
                </span>
              )}
            </button>
          </div>

          {/* Tipo filter */}
          <div className="flex gap-1 rounded-xl border border-border bg-white p-1 shadow-sm">
            {(["todos", "entrada", "saida"] as const).map((t) => {
              const labels: Record<string, string> = {
                todos: "Todos",
                entrada: "Receitas",
                saida: "Despesas",
              };
              const active = tipoFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => handleTipoFilter(t)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                    active
                      ? t === "entrada"
                        ? "bg-emerald-600 text-white"
                        : t === "saida"
                          ? "bg-red-600 text-white"
                          : "bg-primary text-white"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {t === "entrada" && <TrendUpIcon className="h-3.5 w-3.5" />}
                  {t === "saida" && <TrendDownIcon className="h-3.5 w-3.5" />}
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtro de categoria */}
        {categorias.length > 0 && (
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryFilter(e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-white pl-3 pr-8 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
        )}

        {/* Exportar */}
        <button
          onClick={exportCSV}
          title="Exportar CSV"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>

      {/* ── Active tab panel ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-50 px-5 py-3">
          {/* Left: título + filtros de período */}
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`font-heading text-sm font-bold ${mainTab === "atrasados" ? "text-red-600" : "text-fg"}`}
            >
              {mainTab === "pendentes"
                ? "Próximos vencimentos"
                : mainTab === "concluidas"
                  ? "Recebidas e pagas"
                  : "Vencidos em aberto"}
            </h2>
            {mainTab !== "atrasados" && (
              <>
                <span className="text-border">·</span>
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handleDatePreset(p.key)}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-body text-xs font-semibold transition-colors cursor-pointer ${
                      datePreset === p.key
                        ? "bg-primary text-white"
                        : "border border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {datePreset === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        setPageConcluidas(1);
                      }}
                      className="h-7 rounded border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
                    />
                    <span className="font-body text-xs text-muted">até</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => {
                        setCustomTo(e.target.value);
                        setPageConcluidas(1);
                      }}
                      className="h-7 rounded border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: busca + ação */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline font-body text-[11px] text-muted italic">
              Para dar baixa use{" "}
              <a
                href="/dashboard/financeiro?tab=receber"
                className="text-primary underline underline-offset-2 hover:no-underline not-italic font-semibold"
              >
                A Receber
              </a>
            </span>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-40 rounded-lg border border-border bg-white pl-8 pr-3 font-body text-xs text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 lg:w-48"
              />
            </div>
            {mainTab === "concluidas" && (
              <Link
                href="/dashboard/remuneracoes/nova"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 font-body text-xs font-semibold text-white transition-colors hover:bg-purple-700 whitespace-nowrap"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Nova Remuneração
              </Link>
            )}
          </div>
        </div>

        {/* ── Concluídas: summary mini-cards ── */}
        {mainTab === "concluidas" && concluidas.length > 0 && (
          <div className="grid grid-cols-3 gap-3 border-b border-border bg-slate-50/40 px-5 py-3">
            <div className="rounded-lg border border-emerald-200 bg-white p-3 text-center shadow-sm">
              <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-muted">
                Receitas
              </p>
              <p className="mt-1 font-heading text-base font-semibold text-emerald-700">
                {fmt(concluidasTotals.receitas)}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-white p-3 text-center shadow-sm">
              <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-muted">
                Despesas
              </p>
              <p className="mt-1 font-heading text-base font-semibold text-red-600">
                −{fmt(concluidasTotals.despesas)}
              </p>
            </div>
            <div
              className={`rounded-lg border bg-white p-3 text-center shadow-sm ${concluidasTotals.total >= 0 ? "border-emerald-200" : "border-red-200"}`}
            >
              <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-muted">
                Saldo
              </p>
              <p
                className={`mt-1 font-heading text-base font-semibold ${concluidasTotals.total >= 0 ? "text-emerald-700" : "text-red-600"}`}
              >
                {fmt(concluidasTotals.total)}
              </p>
            </div>
          </div>
        )}

        {/* ── Table for active tab ── */}
        {mainTab === "atrasados" && pendentesVencidos.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-8">
            <span className="font-body text-2xl font-bold text-emerald-600">
              ✓
            </span>
            <p className="font-body text-sm font-semibold text-emerald-700">
              Nenhum vencimento em atraso — tudo em dia!
            </p>
          </div>
        ) : (mainTab === "pendentes" && pendentesNaoVencidos.length === 0) ||
          (mainTab === "concluidas" && concluidas.length === 0) ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <BanknotesIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              {mainTab === "pendentes"
                ? "Nenhum vencimento futuro no período"
                : "Nenhum registro concluído no período"}
            </p>
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                {mainTab === "concluidas" ? colsConcluidas : colsPendentes}
                <thead>
                  <tr
                    className={`border-b border-border ${mainTab === "atrasados" ? "bg-red-50/40" : "bg-slate-50/50"}`}
                  >
                    <th className={thBase}>Vencimento</th>
                    <th className={thBase}>Descrição</th>
                    <th className={`${thBase} text-right`}>Valor</th>
                    {mainTab === "concluidas" && (
                      <th className={thBase}>Pago em</th>
                    )}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(mainTab === "pendentes"
                    ? paginatedPendentes
                    : mainTab === "concluidas"
                      ? paginatedConcluidas
                      : paginatedAtrasados
                  ).map((l) => (
                    <LancamentoRow
                      key={l.id}
                      l={l}
                      canEdit={canEdit}
                      singleDeleteOnly={mainTab === "concluidas"}
                      showPagoEm={mainTab === "concluidas"}
                      highlightOverdue={mainTab === "atrasados"}
                      hidePayActions={true}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={
                mainTab === "pendentes"
                  ? pagePendentes
                  : mainTab === "concluidas"
                    ? pageConcluidas
                    : pageAtrasados
              }
              pageSize={
                mainTab === "pendentes"
                  ? pageSizePendentes
                  : mainTab === "concluidas"
                    ? pageSizeConcluidas
                    : pageSizeAtrasados
              }
              total={
                mainTab === "pendentes"
                  ? pendentesNaoVencidos.length
                  : mainTab === "concluidas"
                    ? concluidas.length
                    : pendentesVencidos.length
              }
              onPage={
                mainTab === "pendentes"
                  ? setPagePendentes
                  : mainTab === "concluidas"
                    ? setPageConcluidas
                    : setPageAtrasados
              }
              onPageSize={
                mainTab === "pendentes"
                  ? setPageSizePendentes
                  : mainTab === "concluidas"
                    ? setPageSizeConcluidas
                    : setPageSizeAtrasados
              }
            />
          </>
        )}
      </div>

      {/* ── FAB mobile ────────────────────────────────────────────────────── */}
      {canEdit && <MobileFab />}

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <p className="mb-4 font-heading text-sm font-semibold text-fg">
          Receitas e despesas por mês
        </p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              barCategoryGap="30%"
              barGap={3}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontFamily: "inherit", fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v === 0
                    ? "0"
                    : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : String(v)
                }
                tick={{ fontFamily: "inherit", fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number"
                    ? value.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : String(value)
                }
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  paddingTop: 8,
                }}
              />
              <Bar
                dataKey="receitas"
                name="Receitas"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="despesas"
                name="Despesas"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
