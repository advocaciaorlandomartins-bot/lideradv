"use client";

import Link from "next/link";
import { useActionState, useState, useMemo, useRef, useEffect } from "react";
import {
  createLancamentoAction,
  type LancamentoFormState,
} from "@/lib/lancamento-actions";
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

const PERIODICIDADES = [
  { key: "mensal", label: "Mensalmente" },
  { key: "semanal", label: "Semanalmente" },
  { key: "anual", label: "Anualmente" },
];

type PaymentMode = "avista" | "parcelado" | "recorrente";

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
  clients: ClientOption[];
  processos: ProcessoOption[];
  salarioMinimo: number;
}

export default function NewLancamentoForm({
  clients,
  processos,
  salarioMinimo,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    LancamentoFormState,
    FormData
  >(createLancamentoAction, null);

  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");

  // ── Vinculação ─────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    null
  );
  const [processoId, setProcessoId] = useState("");
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
  const [categoria, setCategoria] = useState("");
  const [categoriaCustom, setCategoriaCustom] = useState("");

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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("avista");
  const [valor, setValor] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("2");
  const [periodicidade, setPeriodicidade] = useState("mensal");
  const [numRecorrencias, setNumRecorrencias] = useState("12");
  const [salarioMode, setSalarioMode] = useState(false);
  const [numSalarios, setNumSalarios] = useState("1");
  const [jaRecebida, setJaRecebida] = useState(false);

  const salarioValor = useMemo(() => {
    if (!salarioMode) return null;
    const n = parseFloat(numSalarios) || 1;
    return (salarioMinimo * n).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }, [salarioMode, numSalarios, salarioMinimo]);

  const effectiveValor = salarioMode ? (salarioValor ?? "") : valor;

  const previewParcelas = useMemo(() => {
    if (paymentMode !== "parcelado") return null;
    const v = parseFloat(parseMoney(effectiveValor));
    const e = parseFloat(parseMoney(valorEntrada)) || 0;
    const n = parseInt(totalParcelas) || 1;
    if (!v || v <= 0) return null;
    const restante = v - e;
    if (restante <= 0) return null;
    return { entrada: e, valorParcela: restante / n, n };
  }, [paymentMode, effectiveValor, valorEntrada, totalParcelas]);

  const previewRecorrente = useMemo(() => {
    if (paymentMode !== "recorrente") return null;
    const v = parseFloat(parseMoney(effectiveValor));
    const n = parseInt(numRecorrencias) || 12;
    if (!v || v <= 0) return null;
    return {
      valorTotal: v * n,
      n,
      periodo: PERIODICIDADES.find((p) => p.key === periodicidade)?.label ?? "",
    };
  }, [paymentMode, effectiveValor, numRecorrencias, periodicidade]);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Hidden fields */}
      <input type="hidden" name="payment_mode" value={paymentMode} />
      <input
        type="hidden"
        name="parcelado"
        value={String(paymentMode === "parcelado")}
      />
      <input type="hidden" name="descricao" value={autoDescricao} />
      <input type="hidden" name="valor" value={parseMoney(effectiveValor)} />
      <input
        type="hidden"
        name="valor_entrada"
        value={parseMoney(valorEntrada)}
      />
      <input type="hidden" name="categoria" value={finalCategoria} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ""} />
      <input
        type="hidden"
        name="status"
        value={jaRecebida ? "pago" : "pendente"}
      />
      <input
        type="hidden"
        name="recorrente"
        value={String(paymentMode === "recorrente")}
      />
      <input type="hidden" name="periodicidade" value={periodicidade} />
      <input type="hidden" name="num_recorrencias" value={numRecorrencias} />

      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {state.error}
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
                  setSalarioMode(false);
                  setJaRecebida(false);
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

          <Field label="Data de vencimento" required>
            <input
              name="data_vencimento"
              type="date"
              required
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── Valores e pagamento ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e pagamento</SectionTitle>
        <div className="mt-4 space-y-4">
          {/* Modo de pagamento */}
          <div>
            <label className={labelClass}>Modo de pagamento</label>
            <div className="flex gap-2">
              {(
                [
                  { key: "avista", label: "À vista" },
                  { key: "parcelado", label: "Parcelado" },
                  { key: "recorrente", label: "Recorrente" },
                ] as { key: PaymentMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMode(m.key)}
                  disabled={isPending}
                  className={`flex-1 rounded-lg border-2 px-3 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                    paymentMode === m.key
                      ? "border-primary bg-blue-50 text-primary"
                      : "border-border text-muted hover:border-slate-300 hover:text-fg"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Salário mínimo toggle */}
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-4 py-3.5 transition-colors hover:border-slate-300">
                <div
                  onClick={() => {
                    setSalarioMode((v) => !v);
                    if (salarioMode) setValor("");
                  }}
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                    salarioMode ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      salarioMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-fg">
                    Baseado em salário mínimo vigente
                  </p>
                  <p className="font-body text-xs text-muted">
                    SM atual: {fmt(salarioMinimo)} — calcular automaticamente
                  </p>
                </div>
              </label>
            </div>

            {salarioMode && (
              <Field label="Quantidade de salários mínimos">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={numSalarios}
                    onChange={(e) =>
                      setNumSalarios(e.target.value.replace(/[^0-9.,]/g, ""))
                    }
                    disabled={isPending}
                    className={`${inputClass} max-w-[140px]`}
                  />
                  <span className="font-body text-sm text-muted">
                    × {fmt(salarioMinimo)}
                  </span>
                </div>
              </Field>
            )}

            {/* Valor total */}
            <Field label="Valor total" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={effectiveValor}
                  onChange={(e) => {
                    if (!salarioMode)
                      setValor(formatMoneyInput(e.target.value));
                  }}
                  onBlur={() => {
                    if (!salarioMode) setValor(normalizeMoneyBlur(valor));
                  }}
                  readOnly={salarioMode}
                  disabled={isPending}
                  className={`${inputClass} pl-10 ${salarioMode ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold" : ""}`}
                />
              </div>
            </Field>

            {/* Parcelado */}
            {paymentMode === "parcelado" && (
              <>
                <Field label="Valor de entrada">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorEntrada}
                      onChange={(e) =>
                        setValorEntrada(formatMoneyInput(e.target.value))
                      }
                      onBlur={() =>
                        setValorEntrada(normalizeMoneyBlur(valorEntrada))
                      }
                      disabled={isPending}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                <Field label="Número de parcelas">
                  <input
                    name="total_parcelas"
                    type="number"
                    min="2"
                    max="120"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                {previewParcelas && (
                  <div className="sm:col-span-2">
                    <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                        Resumo do parcelamento
                      </p>
                      <div className="flex flex-wrap gap-6">
                        {previewParcelas.entrada > 0 && (
                          <div>
                            <span className="font-body text-xs text-muted">
                              Entrada
                            </span>
                            <p className="font-heading text-base font-semibold text-fg">
                              {fmt(previewParcelas.entrada)}
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="font-body text-xs text-muted">
                            {previewParcelas.n}× parcelas
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {fmt(previewParcelas.valorParcela)}
                          </p>
                        </div>
                        <div>
                          <span className="font-body text-xs text-muted">
                            Total
                          </span>
                          <p className="font-heading text-base font-semibold text-primary">
                            {fmt(parseFloat(parseMoney(effectiveValor)) || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Recorrente */}
            {paymentMode === "recorrente" && (
              <>
                <Field label="Repetir a cada">
                  <select
                    value={periodicidade}
                    onChange={(e) => setPeriodicidade(e.target.value)}
                    disabled={isPending}
                    className={selectClass}
                  >
                    {PERIODICIDADES.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Número de recorrências">
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={numRecorrencias}
                    onChange={(e) => setNumRecorrencias(e.target.value)}
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>

                {previewRecorrente && (
                  <div className="sm:col-span-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                        Resumo da recorrência
                      </p>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <span className="font-body text-xs text-muted">
                            Valor por período
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {fmt(parseFloat(parseMoney(effectiveValor)) || 0)}
                          </p>
                        </div>
                        <div>
                          <span className="font-body text-xs text-muted">
                            {previewRecorrente.n}×{" "}
                            {previewRecorrente.periodo.toLowerCase()}
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {previewRecorrente.n} lançamentos criados
                          </p>
                        </div>
                        <div>
                          <span className="font-body text-xs text-muted">
                            Total previsto
                          </span>
                          <p className="font-heading text-base font-semibold text-primary">
                            {fmt(previewRecorrente.valorTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Já recebida / paga */}
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors duration-150 ${
              jaRecebida
                ? tipo === "entrada"
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-red-300 bg-red-50"
                : "border-border hover:border-slate-300"
            }`}
          >
            <div
              onClick={() => setJaRecebida((v) => !v)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                jaRecebida
                  ? tipo === "entrada"
                    ? "bg-emerald-500"
                    : "bg-red-500"
                  : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  jaRecebida ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-fg">
                {tipo === "entrada" ? "Já recebida" : "Já paga"}
              </p>
              <p className="font-body text-xs text-muted">
                Registrar este lançamento como{" "}
                {tipo === "entrada" ? "recebido" : "pago"} na data de hoje
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <SectionTitle>Observações</SectionTitle>
        <div className="mt-4">
          <textarea
            name="observacoes"
            rows={3}
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
            "Salvar lançamento"
          )}
        </button>
      </div>
    </form>
  );
}
