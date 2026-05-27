"use client";

import Link from "next/link";
import { useActionState, useState, useMemo, useRef, useEffect } from "react";
import {
  updateLancamentoAction,
  type LancamentoFormState,
} from "@/lib/lancamento-actions";
import type { Lancamento } from "@/lib/lancamentos-db";
import { SpinnerIcon } from "@/components/icons";

const CATEGORIAS: Record<string, string[]> = {
  entrada: ["Honorários", "Reembolso de Despesas", "Adiantamento", "Outros"],
  saida: [
    "Custas Processuais",
    "Despesas Operacionais",
    "Salário",
    "Aluguel",
    "Impostos",
    "Material de Escritório",
    "Outros",
  ],
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-white px-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectClass =
  "h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelClass = "block font-body text-sm font-semibold text-fg mb-1.5";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-heading text-base font-semibold text-fg">
        {children}
      </h2>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMoneyInput(raw: string): string {
  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx !== -1) {
    const intDigits = raw.slice(0, commaIdx).replace(/\D/g, "");
    const decDigits = raw
      .slice(commaIdx + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    const intNum = intDigits ? parseInt(intDigits, 10) : 0;
    return `${intNum.toLocaleString("pt-BR")},${decDigits}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("pt-BR");
}

function normalizeMoneyBlur(v: string): string {
  if (!v) return "";
  const commaIdx = v.indexOf(",");
  if (commaIdx === -1) return v + ",00";
  const dec = v
    .slice(commaIdx + 1)
    .padEnd(2, "0")
    .slice(0, 2);
  return v.slice(0, commaIdx + 1) + dec;
}

function parseMoney(display: string): string {
  if (!display) return "";
  return display.replace(/\./g, "").replace(",", ".");
}

function ddmmyyyyToISO(s: string): string {
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

interface ClientOption {
  id: string;
  name: string;
  doc: string;
}

interface ProcessoOption {
  id: string;
  client_id: string;
  tipo_acao: string;
  numero: string | null;
  valor_causa: number | null;
}

interface Props {
  lancamento: Lancamento;
  clients: ClientOption[];
  processos: ProcessoOption[];
}

export default function EditLancamentoForm({
  lancamento,
  clients,
  processos,
}: Props) {
  const boundAction = updateLancamentoAction.bind(null, lancamento.id);
  const [state, formAction, isPending] = useActionState<
    LancamentoFormState,
    FormData
  >(boundAction, null);

  // ── Tipo ───────────────────────────────────────────────────
  const [tipo, setTipo] = useState<"entrada" | "saida">(lancamento.tipo);

  // ── Vinculação ─────────────────────────────────────────────
  const initialClient = lancamento.client_id
    ? (clients.find((c) => c.id === lancamento.client_id) ?? {
        id: lancamento.client_id,
        name: lancamento.client_name ?? "",
        doc: "",
      })
    : null;

  const [clientSearch, setClientSearch] = useState("");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    initialClient
  );
  const [processoId, setProcessoId] = useState(lancamento.processo_id ?? "");
  const clientDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        clientDropRef.current &&
        !clientDropRef.current.contains(e.target as Node)
      ) {
        setClientDropOpen(false);
      }
    }
    if (clientDropOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [clientDropOpen]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients.slice(0, 8);
    const qDigits = q.replace(/\D/g, "");
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (qDigits && c.doc.replace(/\D/g, "").includes(qDigits))
      )
      .slice(0, 8);
  }, [clients, clientSearch]);

  const processosDoCliente = useMemo(
    () =>
      selectedClient
        ? processos.filter((p) => p.client_id === selectedClient.id)
        : processos,
    [selectedClient, processos]
  );

  const processoSelecionado = useMemo(
    () => processos.find((p) => p.id === processoId) ?? null,
    [processos, processoId]
  );

  // ── Categoria ──────────────────────────────────────────────
  const isCustomCategoria =
    lancamento.categoria !== null &&
    lancamento.categoria !== "" &&
    !CATEGORIAS[lancamento.tipo]?.includes(lancamento.categoria ?? "");

  const [categoria, setCategoria] = useState(
    isCustomCategoria ? "Outros" : (lancamento.categoria ?? "")
  );
  const [categoriaCustom, setCategoriaCustom] = useState(
    isCustomCategoria ? (lancamento.categoria ?? "") : ""
  );

  const finalCategoria = useMemo(
    () =>
      categoria === "Outros" && categoriaCustom.trim()
        ? categoriaCustom.trim()
        : categoria,
    [categoria, categoriaCustom]
  );

  const autoDescricao = useMemo(() => {
    const cat = finalCategoria || (tipo === "entrada" ? "Entrada" : "Saída");
    return selectedClient ? `${cat} — ${selectedClient.name}` : cat;
  }, [finalCategoria, selectedClient, tipo]);

  // ── Valores ────────────────────────────────────────────────
  const [valor, setValor] = useState(
    lancamento.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );

  const isPessoal = lancamento.remuneracao_id !== null;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <input type="hidden" name="descricao" value={autoDescricao} />
      <input type="hidden" name="valor" value={parseMoney(valor)} />
      <input type="hidden" name="categoria" value={finalCategoria} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ""} />

      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Aviso de parcelamento */}
      {lancamento.grupo_parcelas && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 font-body text-[11px] font-bold text-white">
            !
          </span>
          <div>
            <p className="font-body text-sm font-semibold text-amber-800">
              Lançamento parcelado —{" "}
              {lancamento.parcela_atual === 0
                ? "Entrada"
                : `Parcela ${lancamento.parcela_atual}/${lancamento.total_parcelas}`}
            </p>
            <p className="font-body text-xs text-amber-700 mt-0.5">
              Apenas esta parcela será alterada. Para editar todas, exclua o
              grupo e crie novamente.
            </p>
          </div>
        </div>
      )}

      {/* Aviso de remuneração */}
      {isPessoal && (
        <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-400 font-body text-[11px] font-bold text-white">
            R$
          </span>
          <p className="font-body text-sm text-purple-800">
            Este lançamento está vinculado a uma{" "}
            <strong>remuneração de pessoal</strong>. Alterações no status serão
            refletidas no registro de remuneração correspondente.
          </p>
        </div>
      )}

      {/* ── Tipo ── */}
      <div>
        <SectionTitle>Tipo de lançamento</SectionTitle>
        <div className="mt-4 flex gap-3">
          {(["entrada", "saida"] as const).map((t) => (
            <label
              key={t}
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors duration-150 ${
                tipo === t
                  ? t === "entrada"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-red-400 bg-red-50"
                  : "border-border hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  setCategoria("");
                  setCategoriaCustom("");
                }}
                className={
                  t === "entrada" ? "accent-emerald-600" : "accent-red-500"
                }
              />
              <div>
                <p className="font-body text-sm font-semibold text-fg">
                  {t === "entrada" ? "Entrada" : "Saída"}
                </p>
                <p className="font-body text-xs text-muted">
                  {t === "entrada"
                    ? "Honorários, reembolsos…"
                    : "Custas, despesas…"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Vinculação ── */}
      <div className="space-y-4">
        <SectionTitle>Vinculação ao cliente</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Client search */}
          <div ref={clientDropRef} className="relative">
            <label className={labelClass}>Cliente</label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                placeholder="Buscar por nome ou CPF/CNPJ…"
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={(e) => {
                  if (selectedClient) {
                    setSelectedClient(null);
                    setProcessoId("");
                  }
                  setClientSearch(e.target.value);
                  setClientDropOpen(true);
                }}
                onFocus={() => setClientDropOpen(true)}
                disabled={isPending}
                className={inputClass}
              />
              {selectedClient && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch("");
                    setProcessoId("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-body text-xs text-slate-600 hover:bg-slate-300"
                >
                  ×
                </button>
              )}
            </div>

            {clientDropOpen && !selectedClient && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch("");
                    setClientDropOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left font-body text-sm text-muted hover:bg-slate-50"
                >
                  Nenhum (sem vínculo)
                </button>
                {filteredClients.length === 0 ? (
                  <p className="px-4 py-3 font-body text-sm text-muted">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedClient(c);
                        setClientSearch("");
                        setClientDropOpen(false);
                        setProcessoId("");
                      }}
                      className="w-full px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                    >
                      <p className="font-body text-sm font-semibold text-fg">
                        {c.name}
                      </p>
                      <p className="font-body text-xs text-muted">{c.doc}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedClient && (
              <p className="mt-1.5 font-body text-xs text-muted">
                CPF/CNPJ: {selectedClient.doc}
              </p>
            )}
          </div>

          {/* Processo */}
          <Field label="Processo">
            <select
              name="processo_id"
              value={processoId}
              onChange={(e) => setProcessoId(e.target.value)}
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Nenhum</option>
              {processosDoCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero ? `${p.numero} — ` : ""}
                  {p.tipo_acao}
                </option>
              ))}
            </select>
          </Field>

          {processoSelecionado?.valor_causa != null && (
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Valor da causa
                </span>
                <span className="font-heading text-lg font-semibold text-blue-700">
                  {fmt(processoSelecionado.valor_causa)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dados ── */}
      <div className="space-y-4">
        <SectionTitle>Dados</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Field label="Categoria">
              <select
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setCategoriaCustom("");
                }}
                disabled={isPending}
                className={selectClass}
              >
                <option value="">Selecione…</option>
                {CATEGORIAS[tipo].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            {categoria === "Outros" && (
              <input
                type="text"
                placeholder="Digite a categoria…"
                value={categoriaCustom}
                onChange={(e) => setCategoriaCustom(e.target.value)}
                disabled={isPending}
                className={`${inputClass} mt-2`}
              />
            )}
          </div>

          <Field label="Status" required>
            <select
              name="status"
              defaultValue={lancamento.status}
              disabled={isPending}
              className={selectClass}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Valores e pagamento ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e pagamento</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(formatMoneyInput(e.target.value))}
                onBlur={() => setValor(normalizeMoneyBlur(valor))}
                disabled={isPending}
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>

          <Field label="Data de vencimento" required>
            <input
              name="data_vencimento"
              type="date"
              required
              defaultValue={ddmmyyyyToISO(lancamento.data_vencimento)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="observacoes"
            rows={3}
            defaultValue={lancamento.observacoes ?? ""}
            placeholder="Notas internas sobre este lançamento…"
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/financeiro"
          className="flex h-11 items-center rounded-lg border border-border px-5 font-body text-sm font-semibold text-muted transition-colors duration-150 hover:border-slate-300 hover:text-fg"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 items-center gap-2 rounded-lg bg-cta px-6 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isPending ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Salvando…
            </>
          ) : (
            "Salvar alterações"
          )}
        </button>
      </div>
    </form>
  );
}
