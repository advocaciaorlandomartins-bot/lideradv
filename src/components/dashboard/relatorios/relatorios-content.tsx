"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type {
  RelatorioLancamento,
  RelatorioResumo,
  RelatorioRemuneracao,
  FluxoMensal,
  ColaboradorOption,
  ClienteParaRecibo,
  RelatorioJuridico,
} from "@/lib/relatorios-db";
import type { EscritorioConfig } from "@/lib/escritorio-db";
import {
  PrinterIcon,
  ChartBarIcon,
  BanknotesIcon,
  UsersIcon,
  UserPlusIcon,
  CalendarIcon as FluxoIcon,
  ScalesIcon,
} from "@/components/icons";

type Tab =
  | "painel"
  | "extrato"
  | "clientes"
  | "folha"
  | "fluxo"
  | "recibo"
  | "juridico";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-700",
  pago: "bg-emerald-50 text-emerald-700",
  cancelado: "bg-slate-100 text-slate-500",
};
const TIPO_LABELS: Record<string, string> = {
  entrada: "Receita",
  saida: "Despesa",
};
const TIPO_COLORS: Record<string, string> = {
  entrada: "bg-emerald-50 text-emerald-700",
  saida: "bg-red-50 text-red-600",
};
const REM_TIPO_LABELS: Record<string, string> = {
  salario: "Salário",
  comissao: "Comissão",
  bonificacao: "Bonificação",
  adiantamento: "Adiantamento",
};
const REM_TIPO_COLORS: Record<string, string> = {
  salario: "bg-blue-50 text-blue-700",
  comissao: "bg-violet-50 text-violet-700",
  bonificacao: "bg-emerald-50 text-emerald-700",
  adiantamento: "bg-amber-50 text-amber-700",
};

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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-1 pt-3">
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
            {pageWindow().map((n, i) =>
              n === "…" ? (
                <span
                  key={`e${i}`}
                  className="flex h-7 w-7 items-center justify-center font-body text-xs text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => onPage(n as number)}
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

interface Props {
  lancamentos: RelatorioLancamento[];
  resumo: RelatorioResumo;
  remuneracoes: RelatorioRemuneracao[];
  fluxo: FluxoMensal[];
  colaboradores: ColaboradorOption[];
  escritorio: EscritorioConfig;
  clientesComDados: ClienteParaRecibo[];
  juridico: RelatorioJuridico;
  permissoes: Record<string, string[]>;
}

const inputClass =
  "h-9 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const selectClass =
  "h-9 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 px-4 py-3.5">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
}
function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-body text-xs font-semibold text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
function PrintBtn({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick ?? (() => window.print())}
      className="flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-4 font-body text-sm font-semibold text-muted hover:border-slate-300 hover:text-fg transition-colors cursor-pointer"
    >
      <PrinterIcon className="h-4 w-4" />
      Imprimir
    </button>
  );
}
function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 items-center px-3 font-body text-sm text-muted hover:text-fg transition-colors cursor-pointer"
    >
      Limpar
    </button>
  );
}
function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-slate-50 py-14 text-center">
      <PrinterIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p className="font-body text-sm font-semibold text-muted">{msg}</p>
    </div>
  );
}
function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted leading-tight truncate">
        {label}
      </p>
      <p
        className={`mt-1 font-heading text-sm sm:text-base font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis ${color}`}
        title={fmt(value)}
      >
        {fmt(value)}
      </p>
      {sub && <p className="mt-0.5 font-body text-xs text-muted">{sub}</p>}
    </div>
  );
}
function LancamentosTable({ rows }: { rows: RelatorioLancamento[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [rows]);

  if (rows.length === 0)
    return (
      <EmptyState msg="Nenhum lançamento encontrado para os filtros selecionados." />
    );

  const totalEntradas = rows
    .filter((r) => r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const totalSaidas = rows
    .filter((r) => r.tipo === "saida")
    .reduce((s, r) => s + r.valor, 0);
  const saldo = totalEntradas - totalSaidas;
  const paginated = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <span className="font-body text-xs text-muted">
          {rows.length} lançamento{rows.length !== 1 ? "s" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
          <span className="font-body text-xs text-emerald-600 whitespace-nowrap">
            Receitas: {fmt(totalEntradas)}
          </span>
          <span className="font-body text-xs text-red-600 whitespace-nowrap">
            Despesas: {fmt(totalSaidas)}
          </span>
          <span
            className={`font-body text-sm font-semibold whitespace-nowrap ${saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            Saldo: {saldo < 0 ? "-" : ""}
            {fmt(Math.abs(saldo))}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              {[
                "Vencimento",
                "Tipo",
                "Descrição",
                "Cliente",
                "Valor",
                "Status",
                "Pagamento",
              ].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-body text-xs font-semibold uppercase tracking-wide text-muted ${h === "Valor" ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((r) => (
              <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3 font-body text-sm text-muted whitespace-nowrap">
                  {r.data_vencimento}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 font-body text-xs font-semibold ${TIPO_COLORS[r.tipo] ?? ""}`}
                  >
                    {TIPO_LABELS[r.tipo] ?? r.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 font-body text-sm text-fg max-w-[200px]">
                  <span className="block truncate">{r.descricao}</span>
                  {r.categoria && (
                    <span className="font-body text-xs text-muted">
                      {r.categoria}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-body text-sm text-muted">
                  {r.client_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-body text-sm font-semibold whitespace-nowrap">
                  <span
                    className={
                      r.tipo === "entrada" ? "text-emerald-600" : "text-red-600"
                    }
                  >
                    {r.tipo === "saida" ? "- " : ""}
                    {fmt(r.valor)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-semibold ${STATUS_COLORS[r.status] ?? ""}`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-body text-sm text-muted whitespace-nowrap">
                  {r.data_pagamento ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-slate-50">
              <td
                colSpan={4}
                className="px-4 py-3 font-body text-sm font-semibold text-muted"
              >
                {rows.length} lançamento{rows.length !== 1 ? "s" : ""}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold">
                <span
                  className={saldo >= 0 ? "text-emerald-600" : "text-red-600"}
                >
                  {saldo < 0 ? "-" : ""}
                  {fmt(Math.abs(saldo))}
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
    </div>
  );
}

// ── Painel ────────────────────────────────────────────────────────────────────
function PainelTab({
  resumo,
  fluxo,
  lancamentos,
}: {
  resumo: RelatorioResumo;
  fluxo: FluxoMensal[];
  lancamentos: RelatorioLancamento[];
}) {
  const recentes = lancamentos.slice(0, 8);
  const maxFluxo = Math.max(
    ...fluxo.map((f) => Math.max(f.receitas, f.despesas)),
    1
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Recebido"
          value={resumo.total_entradas}
          color="text-emerald-600"
        />
        <KpiCard
          label="Pago (saídas)"
          value={resumo.total_saidas}
          color="text-red-600"
        />
        <KpiCard
          label="Saldo Líquido"
          value={resumo.saldo_liquido}
          color={
            resumo.saldo_liquido >= 0 ? "text-emerald-600" : "text-red-600"
          }
        />
        <KpiCard
          label="A Receber"
          value={resumo.pendente_entradas}
          sub="em aberto"
          color="text-amber-600"
        />
        <KpiCard
          label="A Pagar"
          value={resumo.pendente_saidas}
          sub="em aberto"
          color="text-amber-600"
        />
        <KpiCard
          label="Remunerações"
          value={resumo.total_remuneracoes}
          sub="pagas"
          color="text-violet-600"
        />
      </div>
      {fluxo.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h3 className="font-heading text-sm font-semibold text-fg mb-5">
            Fluxo de Caixa — Últimos {fluxo.length} meses
          </h3>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 min-w-[600px] h-40">
              {fluxo.map((f) => (
                <div
                  key={f.mes_iso}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="flex items-end gap-0.5 h-28 w-full">
                    <div
                      className="flex-1 bg-emerald-400 rounded-t opacity-80"
                      style={{
                        height: `${(f.receitas / maxFluxo) * 100}%`,
                        minHeight: f.receitas > 0 ? "2px" : "0",
                      }}
                      title={`Receitas: ${fmt(f.receitas)}`}
                    />
                    <div
                      className="flex-1 bg-red-400 rounded-t opacity-80"
                      style={{
                        height: `${(f.despesas / maxFluxo) * 100}%`,
                        minHeight: f.despesas > 0 ? "2px" : "0",
                      }}
                      title={`Despesas: ${fmt(f.despesas)}`}
                    />
                  </div>
                  <span className="font-body text-[10px] text-muted whitespace-nowrap">
                    {f.mes_label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-5 justify-end">
            <span className="flex items-center gap-1.5 font-body text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              Receitas pagas
            </span>
            <span className="flex items-center gap-1.5 font-body text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />
              Despesas pagas
            </span>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="font-heading text-sm font-semibold text-fg mb-4">
          Últimos lançamentos
        </h3>
        <LancamentosTable rows={recentes} />
      </div>
    </div>
  );
}

// ── Extrato Geral ─────────────────────────────────────────────────────────────
function ExtratoTab({ lancamentos }: { lancamentos: RelatorioLancamento[] }) {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const parseDate = useCallback((br: string): Date | null => {
    if (!br) return null;
    const [d, m, y] = br.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00`);
  }, []);
  const filtered = useMemo(
    () =>
      lancamentos.filter((r) => {
        if (filtroTipo && r.tipo !== filtroTipo) return false;
        if (filtroStatus && r.status !== filtroStatus) return false;
        if (filtroBusca) {
          const q = filtroBusca.toLowerCase();
          if (
            !r.descricao.toLowerCase().includes(q) &&
            !(r.client_name ?? "").toLowerCase().includes(q) &&
            !(r.categoria ?? "").toLowerCase().includes(q)
          )
            return false;
        }
        if (filtroInicio) {
          const d = parseDate(r.data_vencimento);
          if (d && d < new Date(filtroInicio + "T00:00:00")) return false;
        }
        if (filtroFim) {
          const d = parseDate(r.data_vencimento);
          if (d && d > new Date(filtroFim + "T23:59:59")) return false;
        }
        return true;
      }),
    [
      lancamentos,
      filtroTipo,
      filtroStatus,
      filtroBusca,
      filtroInicio,
      filtroFim,
      parseDate,
    ]
  );
  return (
    <div className="space-y-5">
      <FilterBar>
        <FilterField label="Busca">
          <input
            type="search"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="Descrição, cliente…"
            className={`${inputClass} w-52`}
          />
        </FilterField>
        <FilterField label="Tipo">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="entrada">Receitas</option>
            <option value="saida">Despesas</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </FilterField>
        <FilterField label="De">
          <input
            type="date"
            value={filtroInicio}
            onChange={(e) => setFiltroInicio(e.target.value)}
            className={inputClass}
          />
        </FilterField>
        <FilterField label="Até">
          <input
            type="date"
            value={filtroFim}
            onChange={(e) => setFiltroFim(e.target.value)}
            className={inputClass}
          />
        </FilterField>
        <PrintBtn />
        <ClearBtn
          onClick={() => {
            setFiltroTipo("");
            setFiltroStatus("");
            setFiltroInicio("");
            setFiltroFim("");
            setFiltroBusca("");
          }}
        />
      </FilterBar>
      <LancamentosTable rows={filtered} />
    </div>
  );
}

// ── Por Cliente ───────────────────────────────────────────────────────────────
function ClientesTab({
  lancamentos,
  clientesComDados,
}: {
  lancamentos: RelatorioLancamento[];
  clientesComDados: ClienteParaRecibo[];
}) {
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const parseDate = useCallback((br: string): Date | null => {
    if (!br) return null;
    const [d, m, y] = br.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00`);
  }, []);
  const clienteSelecionado = clientesComDados.find(
    (c) => c.id === filtroCliente
  );
  const filtered = useMemo(() => {
    if (!filtroCliente) return [];
    return lancamentos.filter((r) => {
      if (r.client_name !== clienteSelecionado?.name) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroInicio) {
        const d = parseDate(r.data_vencimento);
        if (d && d < new Date(filtroInicio + "T00:00:00")) return false;
      }
      if (filtroFim) {
        const d = parseDate(r.data_vencimento);
        if (d && d > new Date(filtroFim + "T23:59:59")) return false;
      }
      return true;
    });
  }, [
    lancamentos,
    filtroCliente,
    filtroStatus,
    filtroInicio,
    filtroFim,
    clienteSelecionado,
    parseDate,
  ]);
  return (
    <div className="space-y-5">
      <FilterBar>
        <FilterField label="Buscar cliente (nome ou CPF/CNPJ)">
          <ClienteBusca
            clientes={clientesComDados}
            value={filtroCliente}
            onChange={(id) => {
              setFiltroCliente(id);
              setFiltroStatus("");
              setFiltroInicio("");
              setFiltroFim("");
            }}
          />
        </FilterField>
        {filtroCliente && (
          <>
            <FilterField label="Status">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </FilterField>
            <FilterField label="De">
              <input
                type="date"
                value={filtroInicio}
                onChange={(e) => setFiltroInicio(e.target.value)}
                className={inputClass}
              />
            </FilterField>
            <FilterField label="Até">
              <input
                type="date"
                value={filtroFim}
                onChange={(e) => setFiltroFim(e.target.value)}
                className={inputClass}
              />
            </FilterField>
            <PrintBtn />
          </>
        )}
      </FilterBar>
      {filtroCliente ? (
        <div className="space-y-4">
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Total Recebido",
                  value: filtered
                    .filter((r) => r.tipo === "entrada" && r.status === "pago")
                    .reduce((s, r) => s + r.valor, 0),
                  color: "text-emerald-600",
                },
                {
                  label: "A Receber",
                  value: filtered
                    .filter(
                      (r) => r.tipo === "entrada" && r.status === "pendente"
                    )
                    .reduce((s, r) => s + r.valor, 0),
                  color: "text-amber-600",
                },
                {
                  label: "Despesas",
                  value: filtered
                    .filter((r) => r.tipo === "saida")
                    .reduce((s, r) => s + r.valor, 0),
                  color: "text-red-600",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-sm min-w-0"
                >
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </p>
                  <p
                    className={`mt-1 font-heading text-base sm:text-xl font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight ${color}`}
                    title={fmt(value)}
                  >
                    {fmt(value)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <LancamentosTable rows={filtered} />
        </div>
      ) : (
        <EmptyState msg="Selecione um cliente para visualizar os lançamentos." />
      )}
    </div>
  );
}

// ── Folha de Pagamento ────────────────────────────────────────────────────────
function FolhaTab({
  remuneracoes,
  colaboradores,
}: {
  remuneracoes: RelatorioRemuneracao[];
  colaboradores: ColaboradorOption[];
}) {
  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(
    () =>
      remuneracoes.filter((r) => {
        if (filtroColaborador && r.colaborador_id !== filtroColaborador)
          return false;
        if (filtroTipo && r.tipo !== filtroTipo) return false;
        if (filtroStatus && r.status !== filtroStatus) return false;
        if (filtroInicio && r.competencia) {
          const [m, y] = r.competencia.split("/");
          if (new Date(`${y}-${m}-01`) < new Date(filtroInicio + "-01"))
            return false;
        }
        if (filtroFim && r.competencia) {
          const [m, y] = r.competencia.split("/");
          if (new Date(`${y}-${m}-01`) > new Date(filtroFim + "-01"))
            return false;
        }
        return true;
      }),
    [
      remuneracoes,
      filtroColaborador,
      filtroTipo,
      filtroStatus,
      filtroInicio,
      filtroFim,
    ]
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [filtroColaborador, filtroTipo, filtroStatus, filtroInicio, filtroFim]);

  const totalPago = filtered
    .filter((r) => r.status === "pago")
    .reduce((s, r) => s + r.valor, 0);
  const totalPendente = filtered
    .filter((r) => r.status === "pendente")
    .reduce((s, r) => s + r.valor, 0);
  const paginatedFiltered = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const byColaborador = useMemo(() => {
    const map = new Map<string, RelatorioRemuneracao[]>();
    for (const r of filtered) {
      if (!map.has(r.colaborador_id)) map.set(r.colaborador_id, []);
      map.get(r.colaborador_id)!.push(r);
    }
    return map;
  }, [filtered]);
  return (
    <div className="space-y-5">
      <FilterBar>
        <FilterField label="Colaborador">
          <select
            value={filtroColaborador}
            onChange={(e) => setFiltroColaborador(e.target.value)}
            className={`${selectClass} w-52`}
          >
            <option value="">Todos</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Tipo">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="salario">Salário</option>
            <option value="comissao">Comissão</option>
            <option value="bonificacao">Bonificação</option>
            <option value="adiantamento">Adiantamento</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </FilterField>
        <FilterField label="Competência de">
          <input
            type="month"
            value={filtroInicio}
            onChange={(e) => setFiltroInicio(e.target.value)}
            className={inputClass}
          />
        </FilterField>
        <FilterField label="até">
          <input
            type="month"
            value={filtroFim}
            onChange={(e) => setFiltroFim(e.target.value)}
            className={inputClass}
          />
        </FilterField>
        <PrintBtn />
        <ClearBtn
          onClick={() => {
            setFiltroColaborador("");
            setFiltroTipo("");
            setFiltroStatus("");
            setFiltroInicio("");
            setFiltroFim("");
          }}
        />
      </FilterBar>
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Pago",
              value: totalPago,
              color: "text-emerald-600",
            },
            {
              label: "Pendente",
              value: totalPendente,
              color: "text-amber-600",
            },
            {
              label: "Total Geral",
              value: totalPago + totalPendente,
              color: "text-violet-600",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-sm min-w-0"
            >
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
              </p>
              <p
                className={`mt-1 font-heading text-base sm:text-xl font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight ${color}`}
                title={fmt(value)}
              >
                {fmt(value)}
              </p>
            </div>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState msg="Nenhuma remuneração encontrada." />
      ) : filtroColaborador ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                {[
                  "Competência",
                  "Tipo",
                  "Fonte",
                  "Descrição",
                  "Valor",
                  "Status",
                  "Pagamento",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 font-body text-xs font-semibold uppercase tracking-wide text-muted ${h === "Valor" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedFiltered.map((r) => (
                <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3 font-body text-sm text-muted whitespace-nowrap">
                    {r.competencia ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-body text-xs font-semibold ${REM_TIPO_COLORS[r.tipo] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {REM_TIPO_LABELS[r.tipo] ?? r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted max-w-[160px] truncate">
                    {r.fonte}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-fg max-w-[180px] truncate">
                    {r.descricao ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm font-semibold text-violet-600 whitespace-nowrap">
                    {fmt(r.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-semibold ${STATUS_COLORS[r.status] ?? ""}`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted whitespace-nowrap">
                    {r.data_pagamento ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-slate-50">
                <td
                  colSpan={4}
                  className="px-4 py-3 font-body text-sm font-semibold text-muted"
                >
                  {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3 text-right font-body text-sm font-semibold text-violet-600">
                  {fmt(filtered.reduce((s, r) => s + r.valor, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byColaborador.entries()).map(([colId, items]) => {
            const first = items[0];
            const total = items.reduce((s, r) => s + r.valor, 0);
            const pago = items
              .filter((r) => r.status === "pago")
              .reduce((s, r) => s + r.valor, 0);
            return (
              <div
                key={colId}
                className="rounded-xl border border-border bg-white overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-b border-border">
                  <div>
                    <span className="font-heading text-sm font-semibold text-fg">
                      {first.colaborador_nome}
                    </span>
                    <span className="ml-2 font-body text-xs text-muted">
                      {first.colaborador_cargo}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-body text-xs text-emerald-600">
                      Pago: {fmt(pago)}
                    </span>
                    <span className="font-heading text-sm font-bold text-violet-600">
                      Total: {fmt(total)}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto text-sm">
                    <tbody className="divide-y divide-border">
                      {items.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-primary/5 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-body text-xs text-muted whitespace-nowrap w-24">
                            {r.competencia ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 w-28">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 font-body text-xs font-semibold ${REM_TIPO_COLORS[r.tipo] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {REM_TIPO_LABELS[r.tipo] ?? r.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-body text-xs text-muted max-w-[180px] truncate">
                            {r.fonte}
                          </td>
                          <td className="px-4 py-2.5 font-body text-xs text-fg max-w-[200px] truncate">
                            {r.descricao ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-body text-sm font-semibold text-violet-600 whitespace-nowrap">
                            {fmt(r.valor)}
                          </td>
                          <td className="px-4 py-2.5 w-24">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-semibold ${STATUS_COLORS[r.status] ?? ""}`}
                            >
                              {STATUS_LABELS[r.status] ?? r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-body text-xs text-muted whitespace-nowrap">
                            {r.data_pagamento ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fluxo de Caixa ────────────────────────────────────────────────────────────
function FluxoTab({ fluxo }: { fluxo: FluxoMensal[] }) {
  if (fluxo.length === 0)
    return <EmptyState msg="Nenhum dado de fluxo disponível." />;
  const totalReceitas = fluxo.reduce((s, f) => s + f.receitas, 0);
  const totalDespesas = fluxo.reduce((s, f) => s + f.despesas, 0);
  const totalAReceber = fluxo.reduce((s, f) => s + f.a_receber, 0);
  const totalAPagar = fluxo.reduce((s, f) => s + f.a_pagar, 0);
  const saldoGeral = totalReceitas - totalDespesas;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {
            label: "Receitas pagas",
            value: totalReceitas,
            color: "text-emerald-600",
          },
          {
            label: "Despesas pagas",
            value: totalDespesas,
            color: "text-red-600",
          },
          { label: "A receber", value: totalAReceber, color: "text-amber-600" },
          { label: "A pagar", value: totalAPagar, color: "text-amber-600" },
          {
            label: "Saldo líquido",
            value: saldoGeral,
            color: saldoGeral >= 0 ? "text-emerald-600" : "text-red-600",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-sm min-w-0"
          >
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted leading-tight">
              {label}
            </p>
            <p
              className={`mt-1 font-heading text-sm sm:text-lg font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight ${color}`}
              title={fmt(value)}
            >
              {fmt(value)}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              {[
                "Mês",
                "Receitas",
                "Despesas",
                "Saldo mês",
                "A Receber",
                "A Pagar",
                "Projeção",
              ].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-body text-xs font-semibold uppercase tracking-wide text-muted ${h === "Mês" ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fluxo.map((f) => {
              const projecao =
                f.receitas + f.a_receber - f.despesas - f.a_pagar;
              return (
                <tr
                  key={f.mes_iso}
                  className="hover:bg-primary/5 transition-colors"
                >
                  <td className="px-4 py-3 font-body text-sm font-semibold text-fg whitespace-nowrap">
                    {f.mes_label}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm text-emerald-600 whitespace-nowrap">
                    {fmt(f.receitas)}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm text-red-600 whitespace-nowrap">
                    {fmt(f.despesas)}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm font-semibold whitespace-nowrap">
                    <span
                      className={
                        f.saldo >= 0 ? "text-emerald-700" : "text-red-700"
                      }
                    >
                      {f.saldo < 0 ? "-" : ""}
                      {fmt(Math.abs(f.saldo))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm text-amber-600 whitespace-nowrap">
                    {f.a_receber > 0 ? fmt(f.a_receber) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm text-amber-600 whitespace-nowrap">
                    {f.a_pagar > 0 ? fmt(f.a_pagar) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm font-semibold whitespace-nowrap">
                    <span
                      className={
                        projecao >= 0 ? "text-slate-600" : "text-red-600"
                      }
                    >
                      {projecao < 0 ? "-" : ""}
                      {fmt(Math.abs(projecao))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-slate-50">
              <td className="px-4 py-3 font-body text-sm font-semibold text-muted">
                {fluxo.length} {fluxo.length === 1 ? "mês" : "meses"}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold text-emerald-600">
                {fmt(totalReceitas)}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold text-red-600">
                {fmt(totalDespesas)}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold">
                <span
                  className={
                    saldoGeral >= 0 ? "text-emerald-700" : "text-red-700"
                  }
                >
                  {fmt(saldoGeral)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold text-amber-600">
                {fmt(totalAReceber)}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold text-amber-600">
                {fmt(totalAPagar)}
              </td>
              <td className="px-4 py-3 text-right font-body text-sm font-semibold">
                <span
                  className={
                    totalReceitas +
                      totalAReceber -
                      totalDespesas -
                      totalAPagar >=
                    0
                      ? "text-slate-700"
                      : "text-red-700"
                  }
                >
                  {fmt(
                    totalReceitas + totalAReceber - totalDespesas - totalAPagar
                  )}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="font-body text-xs text-muted px-1">
        * Projeção = receitas pagas + a receber − despesas pagas − a pagar do
        mês.
      </p>
    </div>
  );
}

// ── Recibo ao Cliente ─────────────────────────────────────────────────────────

function buildReciboHtml(
  cliente: ClienteParaRecibo,
  lancamentos: RelatorioLancamento[],
  escritorio: EscritorioConfig,
  periodo: string
): string {
  const totalPago = lancamentos
    .filter((r) => r.status === "pago" && r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const totalPendente = lancamentos
    .filter((r) => r.status === "pendente" && r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const totalDespesas = lancamentos
    .filter((r) => r.tipo === "saida")
    .reduce((s, r) => s + r.valor, 0);
  const saldoDevedor = totalPendente;

  const contato = [escritorio.telefone, escritorio.email, escritorio.site]
    .filter(Boolean)
    .join(" | ");
  const localizacao = [
    escritorio.endereco,
    escritorio.cidade && escritorio.estado
      ? `${escritorio.cidade}/${escritorio.estado}`
      : (escritorio.cidade ?? escritorio.estado ?? ""),
  ]
    .filter(Boolean)
    .join(", ");

  // Fundo timbrado: imagem de fundo que repete em todas as páginas via position:fixed no print
  const hasFundo =
    !!escritorio.fundo_timbrado &&
    !escritorio.fundo_timbrado.startsWith("data:application/pdf");
  // height:100vh (não 100%) evita que o Chrome gere uma página em branco extra
  const fundoBgEl = hasFundo
    ? `<img src="${escritorio.fundo_timbrado}" style="position:fixed;top:0;left:0;width:100%;height:100vh;z-index:-1;object-fit:cover;pointer-events:none;" alt="" />`
    : "";

  // Margens configuradas (mm)
  const mt = escritorio.margem_topo ?? 25;
  const mr = escritorio.margem_direita ?? 25;
  const mb = escritorio.margem_inferior ?? 28;
  const ml = escritorio.margem_esquerda ?? 25;

  const logoHtml = escritorio.logo_url
    ? `<img src="${escritorio.logo_url}" alt="Logo" style="max-height:60px;max-width:120px;object-fit:contain;" />`
    : `<div style="width:50px;height:50px;background:#1E3A8A;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;">${escritorio.nome.charAt(0)}</div>`;

  // Cabeçalho manual só quando não há fundo timbrado (o fundo já contém o timbrado)
  const headerHtml = hasFundo
    ? ""
    : (() => {
        const t = escritorio.modelo_timbrado;
        if (t === "centralizado")
          return `
      <div style="text-align:center;padding-bottom:16px;">
        <div style="display:flex;justify-content:center;margin-bottom:10px;">${logoHtml}</div>
        <div style="font-size:18px;font-weight:700;color:#1E3A8A;letter-spacing:0.5px;">${escritorio.nome}</div>
        ${escritorio.oab ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">OAB: ${escritorio.oab}</div>` : ""}
        ${contato ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">${contato}</div>` : ""}
        ${localizacao ? `<div style="font-size:10px;color:#94a3b8;">${localizacao}</div>` : ""}
        <div style="border-bottom:2px solid #1E3A8A;margin-top:14px;"></div>
      </div>`;
        if (t === "executivo")
          return `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;">
        <div>
          <div style="font-size:20px;font-weight:700;color:#1E3A8A;">${escritorio.nome}</div>
          ${escritorio.oab ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">OAB: ${escritorio.oab}</div>` : ""}
          ${contato ? `<div style="font-size:10px;color:#94a3b8;margin-top:6px;">${contato}</div>` : ""}
          ${localizacao ? `<div style="font-size:10px;color:#94a3b8;">${localizacao}</div>` : ""}
        </div>
        ${logoHtml}
      </div>
      <div style="border-bottom:2px solid #1E3A8A;"></div>`;
        if (t === "compacto")
          return `
      <div style="background:#1E3A8A;padding:12px 0;display:flex;align-items:center;gap:14px;margin-bottom:8px;">
        ${escritorio.logo_url ? `<img src="${escritorio.logo_url}" alt="Logo" style="max-height:36px;filter:brightness(0)invert(1);" />` : ""}
        <div style="flex:1;">
          <span style="font-size:15px;font-weight:700;color:white;">${escritorio.nome}</span>
          ${escritorio.oab ? `<span style="font-size:10px;color:#93c5fd;margin-left:10px;">OAB: ${escritorio.oab}</span>` : ""}
        </div>
        <div style="font-size:10px;color:#bfdbfe;text-align:right;">${contato}</div>
      </div>`;
        // classico (default)
        return `
      <div style="display:flex;align-items:center;gap:16px;padding-bottom:16px;">
        ${logoHtml}
        <div style="flex:1;">
          <div style="font-size:18px;font-weight:700;color:#1E3A8A;">${escritorio.nome}</div>
          ${escritorio.oab ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">OAB: ${escritorio.oab}${escritorio.cnpj ? ` &nbsp;·&nbsp; CNPJ: ${escritorio.cnpj}` : ""}</div>` : ""}
          ${contato ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">${contato}</div>` : ""}
          ${localizacao ? `<div style="font-size:10px;color:#94a3b8;">${localizacao}</div>` : ""}
        </div>
      </div>
      <div style="border-bottom:2px solid #1E3A8A;"></div>`;
      })();

  const rowsHtml = [...lancamentos]
    .sort((a, b) => {
      const [da, ma, ya] = a.data_vencimento.split("/");
      const [db, mb, yb] = b.data_vencimento.split("/");
      return (
        new Date(`${ya}-${ma}-${da}T12:00:00`).getTime() -
        new Date(`${yb}-${mb}-${db}T12:00:00`).getTime()
      );
    })
    .map((r, idx) => {
      const isPago = r.status === "pago";
      const isEntrada = r.tipo === "entrada";
      const valorColor = isEntrada ? "#15803d" : "#dc2626";
      const rowBg = idx % 2 === 0 ? "transparent" : "#f8fafc";
      return `
      <tr style="background:${rowBg};">
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#0f172a;font-weight:600;white-space:nowrap;">${r.data_vencimento}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">
          <span style="background:${isEntrada ? "#dcfce7" : "#fee2e2"};color:${isEntrada ? "#166534" : "#991b1b"};padding:2px 7px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.3px;">${isEntrada ? "Honorário" : "Despesa"}</span>
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#0f172a;font-weight:500;max-width:200px;">${r.descricao}${r.processo_tipo ? ` <span style="color:#64748b;font-size:9px;">(${r.processo_tipo})</span>` : ""}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;text-align:right;white-space:nowrap;color:${valorColor};">${isEntrada ? "" : "−"}${fmt(r.valor)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:center;">
          <span style="background:${isPago ? "#dcfce7" : "#fef3c7"};color:${isPago ? "#166534" : "#92400e"};padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;">${isPago ? "Pago" : "Pendente"}</span>
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:${isPago ? "#374151" : "#94a3b8"};font-weight:${isPago ? "600" : "400"};white-space:nowrap;">${r.data_pagamento ?? "—"}</td>
      </tr>`;
    })
    .join("");

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Demonstrativo — ${cliente.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; color: #1e293b; }

    /* Cabeçalho da tabela repete em cada página impressa */
    thead { display: table-header-group; }
    /* Evita quebra de linha no meio de uma linha da tabela */
    tbody tr { page-break-inside: avoid; break-inside: avoid; }
    /* Evita quebrar o resumo/rodapé no meio */
    .no-break { page-break-inside: avoid; break-inside: avoid; }

    /* Visualização na tela: simula folha A4 com sombra */
    @media screen {
      body { background: #94a3b8; padding: 24px 0 48px; }
      .page {
        position: relative;
        background: white;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      }
      .no-print { margin-bottom: 20px; text-align: center; }
    }

    /* Impressão */
    @media print {
      body { background: transparent; padding: 0; }
      .no-print { display: none !important; }
      ${
        hasFundo
          ? /* Com timbrado: @page sem margem para a imagem cobrir a folha inteira;
               height:100vh evita página em branco extra que height:100% causa no Chrome */
            `.page { width: 100%; padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; background: transparent; }
      @page { margin: 0; size: A4; }`
          : /* Sem timbrado: @page cuida das margens */
            `.page { width: 100%; padding: 0; background: transparent; }
      @page { margin: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; size: A4; }`
      }
    }

    .btn {
      background: #1E3A8A; color: white; border: none;
      padding: 10px 28px; border-radius: 6px; font-size: 14px;
      cursor: pointer; font-family: Arial, sans-serif;
    }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>

  <div class="page">
    ${fundoBgEl}
    ${headerHtml}

    <div style="text-align:center;margin:${hasFundo ? "0 0 10px" : "10px 0"};padding-top:${hasFundo ? "0" : "8px"};">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#1E3A8A;text-transform:uppercase;border-bottom:2px solid #1E3A8A;display:inline-block;padding-bottom:3px;">Demonstrativo Financeiro</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Referência: <strong>${periodo}</strong></div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:10px;">
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:4px;">Dados do Cliente</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;">${cliente.name}</div>
        <div style="font-size:10px;color:#374151;margin-top:1px;">${cliente.type === "PF" ? "CPF" : "CNPJ"}: ${cliente.doc}</div>
        ${cliente.phone ? `<div style="font-size:10px;color:#374151;">${cliente.phone}</div>` : ""}
        ${cliente.city ? `<div style="font-size:10px;color:#374151;">${cliente.city}${cliente.state ? `/${cliente.state}` : ""}</div>` : ""}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:7px 12px;text-align:center;">
          <div style="font-size:8px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Total Pago</div>
          <div style="font-size:14px;font-weight:700;color:#15803d;margin-top:1px;">${fmt(totalPago)}</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:7px 12px;text-align:center;">
          <div style="font-size:8px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:1px;">Saldo Devedor</div>
          <div style="font-size:14px;font-weight:700;color:#92400e;margin-top:1px;">${fmt(saldoDevedor)}</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr style="background:#1E3A8A;color:white;">
          <th style="padding:5px 8px;text-align:left;font-size:9px;font-weight:600;letter-spacing:0.5px;white-space:nowrap;">Vencimento</th>
          <th style="padding:5px 8px;text-align:left;font-size:9px;font-weight:600;letter-spacing:0.5px;">Tipo</th>
          <th style="padding:5px 8px;text-align:left;font-size:9px;font-weight:600;letter-spacing:0.5px;">Descrição</th>
          <th style="padding:5px 8px;text-align:right;font-size:9px;font-weight:600;letter-spacing:0.5px;">Valor</th>
          <th style="padding:5px 8px;text-align:center;font-size:9px;font-weight:600;letter-spacing:0.5px;">Status</th>
          <th style="padding:5px 8px;text-align:left;font-size:9px;font-weight:600;letter-spacing:0.5px;white-space:nowrap;">Pagamento</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f1f5f9;border-top:2px solid #1E3A8A;">
          <td colspan="3" style="padding:5px 8px;font-size:10px;font-weight:700;color:#0f172a;">${lancamentos.length} lançamento${lancamentos.length !== 1 ? "s" : ""}</td>
          <td style="padding:5px 8px;text-align:right;font-size:12px;font-weight:700;color:#1E3A8A;">${fmt(lancamentos.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.valor, 0))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    <div class="no-break" style="margin-top:10px;border:1px solid #e2e8f0;border-radius:5px;padding:8px 12px;">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:1px;margin-bottom:6px;">Resumo Financeiro</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:10px;color:#374151;font-weight:500;">Honorários lançados</span><span style="font-size:10px;font-weight:700;color:#0f172a;">${fmt(lancamentos.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.valor, 0))}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:10px;color:#166534;font-weight:500;">Pagamentos recebidos</span><span style="font-size:10px;font-weight:700;color:#166534;">${fmt(lancamentos.filter((r) => r.tipo === "entrada" && r.status === "pago").reduce((s, r) => s + r.valor, 0))}</span></div>
      ${totalDespesas > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:10px;color:#991b1b;font-weight:500;">Despesas / Custos</span><span style="font-size:10px;font-weight:700;color:#991b1b;">${fmt(totalDespesas)}</span></div>` : ""}
      <div style="border-top:2px solid #e2e8f0;margin:6px 0;"></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-size:11px;font-weight:700;color:#92400e;">Saldo devedor</span><span style="font-size:13px;font-weight:800;color:#92400e;">${fmt(saldoDevedor)}</span></div>
    </div>

    <div class="no-break" style="margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:8px;color:#94a3b8;line-height:1.6;">
        Documento gerado em ${today}<br/>
        Este demonstrativo é meramente informativo.
      </div>
      <div style="text-align:center;">
        <div style="border-top:1px solid #1e293b;width:190px;padding-top:4px;font-size:9px;color:#475569;line-height:1.5;">
          ${escritorio.nome}${escritorio.oab ? `<br/>OAB ${escritorio.oab}` : ""}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function ClienteBusca({
  clientes,
  value,
  onChange,
}: {
  clientes: ClienteParaRecibo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selecionado = clientes.find((c) => c.id === value);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return clientes.slice(0, 8);
    return clientes
      .filter((c) => {
        const nomeMatch = c.name.toLowerCase().includes(busca.toLowerCase());
        const docMatch = c.doc
          .replace(/\D/g, "")
          .includes(busca.replace(/\D/g, ""));
        return nomeMatch || docMatch;
      })
      .slice(0, 10);
  }, [clientes, busca]);

  function selecionar(c: ClienteParaRecibo) {
    onChange(c.id);
    setBusca("");
    setAberto(false);
  }

  function limpar() {
    onChange("");
    setBusca("");
    setAberto(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="relative">
      {selecionado ? (
        <div className="flex h-9 items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 pr-2">
          <span className="font-body text-sm font-semibold text-fg flex-1 truncate max-w-[220px]">
            {selecionado.name}
          </span>
          <span className="font-body text-xs text-muted whitespace-nowrap">
            {selecionado.doc}
          </span>
          <button
            onClick={limpar}
            className="ml-1 flex h-5 w-5 items-center justify-center rounded text-muted hover:text-fg hover:bg-slate-200 transition-colors cursor-pointer flex-shrink-0"
            title="Limpar seleção"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Digite nome ou CPF/CNPJ…"
          className={`${inputClass} w-72`}
          autoComplete="off"
        />
      )}

      {aberto && !selecionado && (
        <div className="absolute left-0 top-10 z-50 w-80 rounded-xl border border-border bg-white shadow-xl overflow-hidden">
          {sugestoes.length === 0 ? (
            <div className="px-4 py-3 font-body text-sm text-muted">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {sugestoes.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={() => selecionar(c)}
                    className="w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <p className="font-body text-sm font-semibold text-fg leading-tight">
                      {c.name}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {c.type === "PF" ? "CPF" : "CNPJ"}: {c.doc}
                      {c.city ? ` · ${c.city}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ReciboTab({
  lancamentos,
  clientesComDados,
  escritorio,
}: {
  lancamentos: RelatorioLancamento[];
  clientesComDados: ClienteParaRecibo[];
  escritorio: EscritorioConfig;
}) {
  const [clienteId, setClienteId] = useState("");
  const [periodoTipo, setPeriodoTipo] = useState<
    "mes" | "todos" | "personalizado"
  >("mes");
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const cliente = clientesComDados.find((c) => c.id === clienteId);

  const parseDate = useCallback((br: string): Date | null => {
    if (!br) return null;
    const [d, m, y] = br.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00`);
  }, []);

  const filtered = useMemo(() => {
    if (!clienteId || !cliente) return [];
    return lancamentos.filter((r) => {
      if (r.client_name !== cliente.name) return false;
      if (periodoTipo === "mes") {
        const [y, m] = mesRef.split("-");
        const d = parseDate(r.data_vencimento);
        if (!d) return false;
        return d.getFullYear() === Number(y) && d.getMonth() + 1 === Number(m);
      }
      if (periodoTipo === "personalizado") {
        if (dataInicio) {
          const d = parseDate(r.data_vencimento);
          if (d && d < new Date(dataInicio + "T00:00:00")) return false;
        }
        if (dataFim) {
          const d = parseDate(r.data_vencimento);
          if (d && d > new Date(dataFim + "T23:59:59")) return false;
        }
      }
      return true;
    });
  }, [
    lancamentos,
    clienteId,
    cliente,
    periodoTipo,
    mesRef,
    dataInicio,
    dataFim,
    parseDate,
  ]);

  const periodo =
    periodoTipo === "mes"
      ? (() => {
          const [y, m] = mesRef.split("-");
          return `${m}/${y}`;
        })()
      : periodoTipo === "todos"
        ? "Todo o período"
        : `${dataInicio ? new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR") : "…"} a ${dataFim ? new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR") : "…"}`;

  const totalPago = filtered
    .filter((r) => r.status === "pago" && r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const totalPendente = filtered
    .filter((r) => r.status === "pendente" && r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const totalGeral = filtered
    .filter((r) => r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);

  function handleImprimir() {
    if (!cliente) return;
    const html = buildReciboHtml(cliente, filtered, escritorio, periodo);
    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <FilterBar>
        <FilterField label="Buscar cliente (nome ou CPF/CNPJ)">
          <ClienteBusca
            clientes={clientesComDados}
            value={clienteId}
            onChange={setClienteId}
          />
        </FilterField>

        {clienteId && (
          <>
            <FilterField label="Período">
              <div className="flex gap-1">
                {(["mes", "todos", "personalizado"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPeriodoTipo(t)}
                    className={`h-9 px-3 rounded-lg font-body text-sm font-semibold transition-colors cursor-pointer ${periodoTipo === t ? "bg-primary text-white" : "border border-border bg-white text-muted hover:text-fg"}`}
                  >
                    {t === "mes"
                      ? "Este mês"
                      : t === "todos"
                        ? "Todos"
                        : "Personalizado"}
                  </button>
                ))}
              </div>
            </FilterField>

            {periodoTipo === "mes" && (
              <FilterField label="Mês de referência">
                <input
                  type="month"
                  value={mesRef}
                  onChange={(e) => setMesRef(e.target.value)}
                  className={inputClass}
                />
              </FilterField>
            )}
            {periodoTipo === "personalizado" && (
              <>
                <FilterField label="De">
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className={inputClass}
                  />
                </FilterField>
                <FilterField label="Até">
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className={inputClass}
                  />
                </FilterField>
              </>
            )}

            <button
              onClick={handleImprimir}
              disabled={filtered.length === 0}
              className="flex h-9 items-center gap-2 rounded-lg bg-primary px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PrinterIcon className="h-4 w-4" />
              Gerar Recibo
            </button>
          </>
        )}
      </FilterBar>

      {!clienteId && (
        <EmptyState msg="Selecione um cliente para gerar o demonstrativo financeiro." />
      )}

      {clienteId && filtered.length === 0 && (
        <EmptyState msg="Nenhum lançamento encontrado para o período selecionado." />
      )}

      {clienteId && filtered.length > 0 && (
        <>
          {/* Resumo KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Total Pago
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-emerald-700">
                {fmt(totalPago)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-amber-700">
                Saldo Devedor
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-amber-800">
                {fmt(totalPendente)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Total Lançado
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">
                {fmt(totalGeral)}
              </p>
            </div>
          </div>

          {/* Preview simplificado */}
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-heading text-sm font-semibold text-fg">
                  Pré-visualização — {cliente?.name}
                </p>
                <p className="font-body text-xs text-muted mt-0.5">
                  Referência: {periodo} · {filtered.length} lançamento
                  {filtered.length !== 1 ? "s" : ""}
                </p>
                {escritorio.fundo_timbrado &&
                  !escritorio.fundo_timbrado.startsWith(
                    "data:application/pdf"
                  ) && (
                    <p className="font-body text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Papel timbrado cadastrado será aplicado na impressão
                    </p>
                  )}
                {escritorio.fundo_timbrado?.startsWith(
                  "data:application/pdf"
                ) && (
                  <p className="font-body text-xs text-amber-600 mt-1">
                    Fundo em PDF: será impresso separadamente — use PNG/JPG para
                    fundo automático.
                  </p>
                )}
              </div>
              <button
                onClick={handleImprimir}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <PrinterIcon className="h-4 w-4" />
                Abrir e Imprimir
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary">
                    {[
                      "Vencimento",
                      "Tipo",
                      "Descrição",
                      "Valor",
                      "Status",
                      "Pagamento",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 font-body text-xs font-semibold text-white ${h === "Valor" ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-body text-xs text-muted whitespace-nowrap">
                        {r.data_vencimento}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-body text-xs font-semibold ${TIPO_COLORS[r.tipo] ?? ""}`}
                        >
                          {r.tipo === "entrada" ? "Honorário" : "Despesa"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-body text-xs text-fg max-w-[200px] truncate">
                        {r.descricao}
                      </td>
                      <td className="px-3 py-2.5 text-right font-body text-xs font-semibold whitespace-nowrap">
                        <span
                          className={
                            r.tipo === "entrada"
                              ? "text-emerald-600"
                              : "text-red-600"
                          }
                        >
                          {fmt(r.valor)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-semibold ${STATUS_COLORS[r.status] ?? ""}`}
                        >
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-body text-xs text-muted whitespace-nowrap">
                        {r.data_pagamento ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── JuridicoTab ───────────────────────────────────────────────────────────────

const STATUS_PROCESSO_LABELS: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  encerrado: "Encerrado",
};
const STATUS_PROCESSO_COLORS: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700",
  suspenso: "bg-amber-50 text-amber-700",
  arquivado: "bg-slate-100 text-slate-500",
  encerrado: "bg-blue-50 text-blue-700",
};

function JuridicoTab({ juridico }: { juridico: RelatorioJuridico }) {
  const {
    por_area,
    controles,
    processos_por_status,
    total_processos,
    total_clientes,
    novos_clientes_mes,
  } = juridico;

  return (
    <div className="space-y-6">
      {/* KPIs de topo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total Processos
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-fg">
            {total_processos}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total Clientes
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-fg">
            {total_clientes}
          </p>
          <p className="mt-0.5 font-body text-xs text-emerald-600">
            +{novos_clientes_mes} este mês
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Compliance Prazos
          </p>
          <p
            className={`mt-1 font-heading text-2xl font-bold ${controles.compliance_pct >= 80 ? "text-emerald-600" : controles.compliance_pct >= 60 ? "text-amber-600" : "text-red-600"}`}
          >
            {controles.compliance_pct}%
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {controles.concluidos_no_prazo} de{" "}
            {controles.concluidos_no_prazo + controles.concluidos_atrasados}{" "}
            concluídos
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Prazos Vencidos
          </p>
          <p
            className={`mt-1 font-heading text-2xl font-bold ${controles.vencidos > 0 ? "text-red-600" : "text-emerald-600"}`}
          >
            {controles.vencidos}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {controles.pendentes} pendentes
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Processos por status */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-heading text-sm font-bold text-fg">
            Processos por Status
          </h3>
          <div className="space-y-2">
            {processos_por_status.map(({ status, total }) => {
              const pct =
                total_processos > 0
                  ? Math.round((total / total_processos) * 100)
                  : 0;
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-semibold ${STATUS_PROCESSO_COLORS[status] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {STATUS_PROCESSO_LABELS[status] ?? status}
                    </span>
                    <span className="font-body text-xs text-muted">
                      {total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controle de prazos */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-heading text-sm font-bold text-fg">
            Controle de Prazos
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Concluídos no prazo",
                value: controles.concluidos_no_prazo,
                color: "text-emerald-600",
                bar: "bg-emerald-500",
              },
              {
                label: "Concluídos com atraso",
                value: controles.concluidos_atrasados,
                color: "text-amber-600",
                bar: "bg-amber-400",
              },
              {
                label: "Pendentes",
                value: controles.pendentes,
                color: "text-blue-600",
                bar: "bg-blue-500",
              },
              {
                label: "Vencidos",
                value: controles.vencidos,
                color: "text-red-600",
                bar: "bg-red-500",
              },
            ].map(({ label, value, color, bar }) => {
              const pct =
                controles.total > 0
                  ? Math.round((value / controles.total) * 100)
                  : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-body text-xs text-slate-600">
                      {label}
                    </span>
                    <span className={`font-body text-xs font-bold ${color}`}>
                      {value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full transition-all ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Taxa de êxito por área */}
      {por_area.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-heading text-sm font-bold text-fg">
              Taxa de Êxito por Área
            </h3>
            <p className="mt-0.5 font-body text-xs text-muted">
              Baseado em processos com resultado registrado
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-body text-xs font-semibold text-muted">
                    Área
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-muted">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-muted">
                    Ativos
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-emerald-600">
                    Ganhos
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-red-500">
                    Perdas
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-amber-600">
                    Acordos
                  </th>
                  <th className="px-4 py-2.5 text-right font-body text-xs font-semibold text-muted">
                    Taxa Êxito
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {por_area.map((a) => (
                  <tr
                    key={a.area}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-body text-sm font-semibold text-fg">
                      {a.area}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm text-muted">
                      {a.total}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm text-muted">
                      {a.ativos}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-semibold text-emerald-600">
                      {a.ganhos}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-semibold text-red-500">
                      {a.perdidos}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-semibold text-amber-600">
                      {a.acordo}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.ganhos + a.perdidos + a.acordo === 0 ? (
                        <span className="font-body text-xs text-muted">—</span>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-bold ${a.taxa_exito >= 70 ? "bg-emerald-50 text-emerald-700" : a.taxa_exito >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}
                        >
                          {a.taxa_exito}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

type TabMeta = {
  key: Tab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  subKey: string | null;
};

const ALL_TABS: TabMeta[] = [
  {
    key: "painel",
    label: "Painel",
    description: "Visão geral",
    icon: ChartBarIcon,
    subKey: null,
  },
  {
    key: "extrato",
    label: "Extrato",
    description: "Todos os lançamentos",
    icon: BanknotesIcon,
    subKey: "relatorios_extrato",
  },
  {
    key: "clientes",
    label: "Por Cliente",
    description: "Extrato por cliente",
    icon: UsersIcon,
    subKey: "relatorios_clientes",
  },
  {
    key: "folha",
    label: "Folha",
    description: "Remunerações",
    icon: UserPlusIcon,
    subKey: "relatorios_folha",
  },
  {
    key: "fluxo",
    label: "Fluxo de Caixa",
    description: "Projeção mensal",
    icon: FluxoIcon,
    subKey: "relatorios_fluxo",
  },
  {
    key: "recibo",
    label: "Recibo",
    description: "Demonstrativo ao cliente",
    icon: PrinterIcon,
    subKey: "relatorios_recibo",
  },
  {
    key: "juridico",
    label: "Jurídico",
    description: "Êxito e compliance",
    icon: ScalesIcon,
    subKey: null,
  },
];

function canSeeTab(
  subKey: string | null,
  permissoes: Record<string, string[]>
): boolean {
  if (!subKey) return true;
  const direct = permissoes[subKey];
  if (direct !== undefined) return direct.includes("ver");
  return (permissoes["relatorios"] ?? []).includes("ver");
}

export default function RelatoriosContent({
  lancamentos,
  resumo,
  remuneracoes,
  fluxo,
  colaboradores,
  escritorio,
  clientesComDados,
  juridico,
  permissoes,
}: Props) {
  const visibleTabs = ALL_TABS.filter(({ subKey }) =>
    canSeeTab(subKey, permissoes)
  );
  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.key ?? "painel");

  const activeTab = visibleTabs.some((t) => t.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "painel");
  const activeMeta = visibleTabs.find((t) => t.key === activeTab)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-4">
      {/* ── Tab cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {visibleTabs.map(({ key, label, description, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 px-3 py-3 text-left transition-all duration-150 cursor-pointer ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-primary/10" : "bg-slate-100"}`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? "text-primary" : "text-slate-500"}`}
                />
              </div>
              <div>
                <p
                  className={`font-body text-sm font-semibold leading-tight ${active ? "text-primary" : "text-fg"}`}
                >
                  {label}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-muted leading-tight">
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Active tab panel ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ActiveIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              {activeMeta.label}
            </h2>
            <p className="font-body text-xs text-muted">
              {activeMeta.description}
            </p>
          </div>
        </div>

        {/* Panel body */}
        <div className="p-5">
          {activeTab === "painel" && (
            <PainelTab
              resumo={resumo}
              fluxo={fluxo}
              lancamentos={lancamentos}
            />
          )}
          {activeTab === "extrato" && <ExtratoTab lancamentos={lancamentos} />}
          {activeTab === "clientes" && (
            <ClientesTab
              lancamentos={lancamentos}
              clientesComDados={clientesComDados}
            />
          )}
          {activeTab === "folha" && (
            <FolhaTab
              remuneracoes={remuneracoes}
              colaboradores={colaboradores}
            />
          )}
          {activeTab === "fluxo" && <FluxoTab fluxo={fluxo} />}
          {activeTab === "recibo" && (
            <ReciboTab
              lancamentos={lancamentos}
              clientesComDados={clientesComDados}
              escritorio={escritorio}
            />
          )}
          {activeTab === "juridico" && <JuridicoTab juridico={juridico} />}
        </div>
      </div>
    </div>
  );
}
