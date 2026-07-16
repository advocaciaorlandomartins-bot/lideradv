"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markAsPagoAction,
  markMultiplePagoAction,
  pagamentoParcialAction,
} from "@/lib/lancamento-actions";
import type { ContaCliente, ContaClienteItem } from "@/lib/lancamentos-db";
import { MagnifyingGlassIcon } from "@/components/icons";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtInput(digits: string): string {
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

type Periodo = "todos" | "mes_atual" | "personalizado";

function parseVencimento(s: string | null): Date | null {
  if (!s) return null;
  const p = s.split("/");
  if (p.length !== 3) return null;
  return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
}

function matchesPeriodo(
  d: Date | null,
  periodo: Periodo,
  inicio: string,
  fim: string
): boolean {
  if (periodo === "todos") return true;
  if (!d) return false;
  if (periodo === "mes_atual") {
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }
  if (inicio && d < new Date(inicio + "T00:00:00")) return false;
  if (fim && d > new Date(fim + "T23:59:59")) return false;
  return true;
}

function sortByVencimento(items: ContaClienteItem[]): ContaClienteItem[] {
  return [...items].sort((a, b) => {
    const da = parseVencimento(a.data_vencimento);
    const db = parseVencimento(b.data_vencimento);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
}

// ── Distribuição de pagamento parcial (preview) ───────────────────────────────

interface DistLine {
  id: string;
  descricao: string;
  valorOriginal: number;
  valorPago: number;
  restante: number;
  status: "pago" | "parcial" | "sem_alteracao";
}

function calcDistribuicao(
  pendingItems: ContaClienteItem[],
  valorPago: number
): DistLine[] {
  let rem = valorPago;
  return sortByVencimento(pendingItems).map((item) => {
    if (rem <= 0)
      return {
        id: item.id,
        descricao: item.descricao,
        valorOriginal: item.valor,
        valorPago: 0,
        restante: item.valor,
        status: "sem_alteracao",
      };
    if (rem >= item.valor) {
      const pago = item.valor;
      rem = Math.round((rem - pago) * 100) / 100;
      return {
        id: item.id,
        descricao: item.descricao,
        valorOriginal: item.valor,
        valorPago: pago,
        restante: 0,
        status: "pago",
      };
    }
    const pago = Math.round(rem * 100) / 100;
    const restante = Math.round((item.valor - pago) * 100) / 100;
    rem = 0;
    return {
      id: item.id,
      descricao: item.descricao,
      valorOriginal: item.valor,
      valorPago: pago,
      restante,
      status: "parcial",
    };
  });
}

// ── Modal: Adiantar N Parcelas ────────────────────────────────────────────────

function AdiantarParcelasModal({
  clienteNome,
  clienteId,
  pendingItems,
  onClose,
  onConfirm,
  isPending,
}: {
  clienteNome: string;
  clienteId: string;
  pendingItems: ContaClienteItem[];
  onClose: () => void;
  onConfirm: (ids: string[], clienteId: string) => void;
  isPending: boolean;
}) {
  const sorted = useMemo(() => sortByVencimento(pendingItems), [pendingItems]);
  const maxN = sorted.length;
  const [quantidade, setQuantidade] = useState(Math.min(1, maxN));

  const selected = sorted.slice(0, quantidade);
  const totalSelecionado = selected.reduce((s, i) => s + i.valor, 0);
  const totalPendente = pendingItems.reduce((s, i) => s + i.valor, 0);
  const saldoRestante =
    Math.round((totalPendente - totalSelecionado) * 100) / 100;

  const quickBtns = Array.from({ length: Math.min(maxN, 5) }, (_, i) => i + 1);
  if (maxN > 5 && !quickBtns.includes(maxN)) quickBtns.push(maxN);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-heading text-base font-semibold text-fg">
              Adiantar Parcelas
            </p>
            <p className="font-body text-xs text-muted mt-0.5">
              {clienteNome} · {maxN}{" "}
              {maxN === 1 ? "parcela pendente" : "parcelas pendentes"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Quantity selector */}
          <div>
            <label className="block font-body text-sm font-semibold text-fg mb-3">
              Quantas parcelas adiantar?
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {quickBtns.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantidade(n)}
                  className={`rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors cursor-pointer ${
                    quantidade === n
                      ? "bg-primary text-white"
                      : "border border-border text-fg hover:bg-slate-50"
                  }`}
                >
                  {n === maxN ? `${n} (Todas)` : n}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-muted">ou</span>
                <input
                  type="number"
                  min={1}
                  max={maxN}
                  value={quantidade}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(maxN, Number(e.target.value) || 1)
                    );
                    setQuantidade(v);
                  }}
                  className="h-10 w-20 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
                />
                <span className="font-body text-xs text-muted">
                  personali­zado
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-slate-50 border-b border-border px-4 py-2">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Parcelas que serão baixadas
              </p>
            </div>
            <div className="divide-y divide-border max-h-52 overflow-y-auto">
              {selected.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex-shrink-0">
                    ✓
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-fg truncate">
                      {item.descricao}
                    </p>
                    {item.data_vencimento && (
                      <p className="font-body text-xs text-muted">
                        Venc. {item.data_vencimento}
                      </p>
                    )}
                  </div>
                  <span className="font-body text-sm font-semibold text-fg flex-shrink-0">
                    {fmt(item.valor)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-slate-50 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-muted">
                  Total desta baixa
                </span>
                <span className="font-body text-sm font-semibold text-emerald-700">
                  {fmt(totalSelecionado)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-muted">
                  Saldo restante
                </span>
                <span
                  className={`font-body text-sm font-semibold ${saldoRestante > 0 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {saldoRestante > 0 ? fmt(saldoRestante) : "Quitado"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-fg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selected.length === 0 || isPending}
            onClick={() =>
              onConfirm(
                selected.map((i) => i.id),
                clienteId
              )
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 font-body text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending
              ? "Processando…"
              : `Baixar ${quantidade} ${quantidade === 1 ? "parcela" : "parcelas"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Pagamento por Valor ────────────────────────────────────────────────

function PagamentoParcialModal({
  clienteNome,
  clienteId,
  pendingItems,
  onClose,
  onConfirm,
  isPending,
}: {
  clienteNome: string;
  clienteId: string;
  pendingItems: ContaClienteItem[];
  onClose: () => void;
  onConfirm: (ids: string[], valorPago: number, clienteId: string) => void;
  isPending: boolean;
}) {
  const [rawInput, setRawInput] = useState("");
  const valorPago = parseMoneyInput(rawInput);
  const totalPendente = pendingItems.reduce((s, i) => s + i.valor, 0);
  const valorEfetivo = Math.min(valorPago, totalPendente);
  const dist = useMemo(
    () => calcDistribuicao(pendingItems, valorEfetivo),
    [pendingItems, valorEfetivo]
  );
  const saldoApos = Math.max(0, totalPendente - valorEfetivo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-heading text-base font-semibold text-fg">
              Pagamento por Valor
            </p>
            <p className="font-body text-xs text-muted mt-0.5">{clienteNome}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block font-body text-sm font-semibold text-fg mb-1.5">
              Valor recebido do cliente
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted">
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={rawInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setRawInput(digits ? fmtInput(digits) : "");
                }}
                className="h-11 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <p className="mt-1 font-body text-xs text-muted">
              Total pendente: {fmt(totalPendente)}
            </p>
          </div>

          {valorEfetivo > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-slate-50 border-b border-border px-4 py-2">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Como será distribuído
                </p>
              </div>
              <div className="divide-y divide-border max-h-52 overflow-y-auto">
                {dist.map((d) => (
                  <div key={d.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {d.status === "pago" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                          ✓
                        </span>
                      )}
                      {d.status === "parcial" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          ½
                        </span>
                      )}
                      {d.status === "sem_alteracao" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs">
                          –
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-fg truncate">
                        {d.descricao}
                      </p>
                      {d.status === "pago" && (
                        <p className="font-body text-xs text-emerald-700 mt-0.5">
                          Pago integralmente — {fmt(d.valorPago)}
                        </p>
                      )}
                      {d.status === "parcial" && (
                        <p className="font-body text-xs text-amber-700 mt-0.5">
                          {fmt(d.valorPago)} pago · {fmt(d.restante)} fica
                          pendente
                        </p>
                      )}
                      {d.status === "sem_alteracao" && (
                        <p className="font-body text-xs text-muted mt-0.5">
                          Sem alteração — {fmt(d.valorOriginal)} pendentes
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="font-body text-xs text-muted">
                  Saldo após confirmação
                </span>
                <span
                  className={`font-body text-sm font-semibold ${saldoApos > 0 ? "text-red-600" : "text-emerald-700"}`}
                >
                  {saldoApos > 0 ? fmt(saldoApos) : "Quitado"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-fg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={valorEfetivo <= 0 || isPending}
            onClick={() => {
              const ids = dist
                .filter((d) => d.status !== "sem_alteracao")
                .map((d) => d.id);
              onConfirm(ids, valorEfetivo, clienteId);
            }}
            className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Processando…" : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isAtrasado =
    status === "pendente" && false; /* computed per-item where needed */
  void isAtrasado;
  const classes =
    status === "pago"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  const label = status === "pago" ? "Pago" : "Pendente";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-body text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

// ── ClienteItemRow ────────────────────────────────────────────────────────────

function ClienteItemRow({
  item,
  onBaixa,
  onSelect,
  isSelected,
  isPending,
}: {
  item: ContaClienteItem;
  onBaixa: (id: string) => void;
  onSelect: (id: string, checked: boolean) => void;
  isSelected: boolean;
  isPending: boolean;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = parseVencimento(item.data_vencimento);
  const atrasado = item.status === "pendente" && venc !== null && venc < hoje;

  return (
    <tr
      className={`border-b border-border transition-colors ${
        item.status === "pago"
          ? "bg-slate-50/60 opacity-70"
          : isSelected
            ? "bg-primary/5"
            : atrasado
              ? "bg-red-50/50"
              : "bg-white"
      }`}
    >
      <td className="px-4 py-2.5 w-8">
        {item.status !== "pago" && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
        )}
      </td>
      <td className="pl-6 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded px-1.5 py-0.5 font-body text-[11px] font-semibold ${
              item.tipo === "entrada"
                ? "bg-blue-50 text-blue-700"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            {item.tipo === "entrada" ? "Receita" : "Despesa"}
          </span>
          <p className="font-body text-sm text-fg">{item.descricao}</p>
          {atrasado && (
            <span className="rounded px-1.5 py-0.5 font-body text-[11px] font-semibold bg-red-100 text-red-700">
              Atrasado
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {item.categoria && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-xs text-muted">
              {item.categoria}
            </span>
          )}
          {item.data_vencimento && (
            <span
              className={`font-body text-xs ${atrasado ? "text-red-600 font-semibold" : "text-muted"}`}
            >
              Venc. {item.data_vencimento}
            </span>
          )}
          {item.data_pagamento && (
            <span className="font-body text-xs text-emerald-600">
              Pago em {item.data_pagamento}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-body text-sm font-semibold text-fg">
          {fmt(item.valor)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          {item.status !== "pago" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onBaixa(item.id)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Dar baixa
            </button>
          )}
          <Link
            href={`/dashboard/financeiro/${item.id}/editar`}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
          >
            Editar
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── ClienteRows ───────────────────────────────────────────────────────────────

function ClienteRows({
  conta,
  isExpanded,
  onToggle,
  onBaixa,
  onSelect,
  selectedIds,
  isPending,
  onOpenAdiantar,
  onOpenParcial,
}: {
  conta: ContaCliente & { totalPendente: number; totalPago: number };
  isExpanded: boolean;
  onToggle: () => void;
  onBaixa: (id: string) => void;
  onSelect: (id: string, checked: boolean) => void;
  selectedIds: Set<string>;
  isPending: boolean;
  onOpenAdiantar: (
    clienteId: string,
    clienteNome: string,
    items: ContaClienteItem[]
  ) => void;
  onOpenParcial: (
    clienteId: string,
    clienteNome: string,
    items: ContaClienteItem[]
  ) => void;
}) {
  const pendingItems = conta.items.filter((i) => i.status !== "pago");

  return (
    <>
      <tr className="border-b border-border hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 w-8" />
        <td className="px-4 py-3">
          <p className="font-body font-semibold text-fg">{conta.client_name}</p>
          <p className="font-body text-xs text-muted">{conta.client_doc}</p>
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={`font-heading text-base font-semibold ${
              conta.totalPendente > 0 ? "text-red-600" : "text-muted"
            }`}
          >
            {fmt(conta.totalPendente)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-body font-semibold text-emerald-700">
            {fmt(conta.totalPago)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isExpanded ? "Recolher ▲" : `Expandir (${conta.items.length}) ▼`}
            </button>
            {pendingItems.length >= 1 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  onOpenAdiantar(
                    conta.client_id,
                    conta.client_name,
                    pendingItems
                  )
                }
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Adiantar Parcelas
              </button>
            )}
            {pendingItems.length >= 1 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  onOpenParcial(
                    conta.client_id,
                    conta.client_name,
                    pendingItems
                  )
                }
                className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Pgto. por Valor
              </button>
            )}
            <Link
              href={`/dashboard/clientes/${conta.client_id}`}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
            >
              Ver cliente
            </Link>
          </div>
        </td>
      </tr>
      {isExpanded &&
        conta.items.map((item) => (
          <ClienteItemRow
            key={item.id}
            item={item}
            onBaixa={onBaixa}
            onSelect={onSelect}
            isSelected={selectedIds.has(item.id)}
            isPending={isPending}
          />
        ))}
    </>
  );
}

// ── Main: ReceberContent ──────────────────────────────────────────────────────

interface Props {
  contasReceber: ContaCliente[];
  defaultCliente?: string;
}

export default function ReceberContent({
  contasReceber,
  defaultCliente,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [adiantarModal, setAdiantarModal] = useState<{
    clienteId: string;
    clienteNome: string;
    pendingItems: ContaClienteItem[];
  } | null>(null);
  const [parcialModal, setParcialModal] = useState<{
    clienteId: string;
    clienteNome: string;
    pendingItems: ContaClienteItem[];
  } | null>(null);

  // Filters
  const [search, setSearch] = useState(defaultCliente ?? "");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleBaixaSimples(id: string) {
    startTransition(async () => {
      await markAsPagoAction(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  function handleBaixaMultipla() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      await markMultiplePagoAction(ids);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handleAdiantarParcelas(ids: string[], clienteId: string) {
    void clienteId;
    startTransition(async () => {
      await markMultiplePagoAction(ids);
      setAdiantarModal(null);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handlePagamentoPorValor(
    ids: string[],
    valorPago: number,
    clienteId: string
  ) {
    startTransition(async () => {
      await pagamentoParcialAction({ ids, valorPago, clientId: clienteId });
      setParcialModal(null);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contasReceber
      .filter(
        (c) =>
          !q ||
          c.client_name.toLowerCase().includes(q) ||
          c.client_doc.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      )
      .map((c) => {
        const items =
          periodo === "todos"
            ? c.items
            : c.items.filter((item) =>
                matchesPeriodo(
                  parseVencimento(item.data_vencimento),
                  periodo,
                  dataInicio,
                  dataFim
                )
              );
        return {
          ...c,
          items,
          totalPendente: items
            .filter((i) => i.status !== "pago")
            .reduce((s, i) => s + i.valor, 0),
          totalPago: items
            .filter((i) => i.status === "pago")
            .reduce((s, i) => s + i.valor, 0),
        };
      })
      .filter((c) => periodo === "todos" || c.items.length > 0);
  }, [contasReceber, search, periodo, dataInicio, dataFim]);

  const totalPendente = filtered.reduce((s, c) => s + c.totalPendente, 0);
  const totalRecebido = filtered.reduce((s, c) => s + c.totalPago, 0);
  const clientesPendentes = filtered.filter((c) => c.totalPendente > 0).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            A Receber
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-red-600">
            {fmt(totalPendente)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {clientesPendentes}{" "}
            {clientesPendentes === 1 ? "cliente" : "clientes"} com saldo
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Já Recebido
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-emerald-700">
            {fmt(totalRecebido)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">no período</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Como dar baixa
          </p>
          <p className="mt-2 font-body text-xs text-muted leading-relaxed">
            <span className="font-semibold text-fg">Dar baixa</span> — parcela
            individual
            <br />
            <span className="font-semibold text-fg">Adiantar Parcelas</span> —
            escolha N parcelas
            <br />
            <span className="font-semibold text-fg">Pgto. por Valor</span> —
            informe o valor pago
            <br />
            <span className="font-semibold text-fg">Checkboxes</span> — seleção
            livre em lote
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit shadow-sm">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "mes_atual", label: "Este mês" },
              { key: "personalizado", label: "Personalizado" },
            ] as { key: Periodo; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodo(key)}
              className={`rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
                periodo === key
                  ? "bg-primary text-white font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            <span className="font-body text-xs text-muted">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            {(dataInicio || dataFim) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicio("");
                  setDataFim("");
                }}
                className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-muted hover:text-fg transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-body text-sm text-muted">
              {search
                ? `Nenhum cliente encontrado para "${search}"`
                : "Nenhum lançamento a receber"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted w-[30%]">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    A Receber
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Recebido
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted w-[35%]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((conta) => (
                  <ClienteRows
                    key={conta.client_id}
                    conta={conta}
                    isExpanded={expanded.has(conta.client_id)}
                    onToggle={() => toggleExpand(conta.client_id)}
                    onBaixa={handleBaixaSimples}
                    onSelect={handleSelect}
                    selectedIds={selectedIds}
                    isPending={isPending}
                    onOpenAdiantar={(id, nome, items) =>
                      setAdiantarModal({
                        clienteId: id,
                        clienteNome: nome,
                        pendingItems: items,
                      })
                    }
                    onOpenParcial={(id, nome, items) =>
                      setParcialModal({
                        clienteId: id,
                        clienteNome: nome,
                        pendingItems: items,
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl border border-border bg-white px-5 py-3 shadow-xl">
          <p className="font-body text-sm font-semibold text-fg">
            {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "lançamento" : "lançamentos"} selecionado
            {selectedIds.size > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="font-body text-xs text-muted hover:text-fg transition-colors cursor-pointer"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleBaixaMultipla}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-body text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending
              ? "Processando…"
              : `Baixar ${selectedIds.size} selecionado${selectedIds.size > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Modals */}
      {adiantarModal && (
        <AdiantarParcelasModal
          clienteId={adiantarModal.clienteId}
          clienteNome={adiantarModal.clienteNome}
          pendingItems={adiantarModal.pendingItems}
          onClose={() => setAdiantarModal(null)}
          onConfirm={handleAdiantarParcelas}
          isPending={isPending}
        />
      )}
      {parcialModal && (
        <PagamentoParcialModal
          clienteId={parcialModal.clienteId}
          clienteNome={parcialModal.clienteNome}
          pendingItems={parcialModal.pendingItems}
          onClose={() => setParcialModal(null)}
          onConfirm={handlePagamentoPorValor}
          isPending={isPending}
        />
      )}
    </div>
  );
}
