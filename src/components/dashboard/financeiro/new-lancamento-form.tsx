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

type PaymentMode =
  | "avista"
  | "parcelado"
  | "recorrente"
  | "retroativo"
  | "mensalidade";

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
  origem_tipo?: string | null;
  indicador_id?: string | null;
  indicador_nome?: string | null;
  comissao_tipo?: string | null;
  comissao_valor?: number | null;
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
  defaultTipo?: "entrada" | "saida";
  defaultClientId?: string;
  defaultProcessoId?: string;
}

export default function NewLancamentoForm({
  clients,
  processos,
  salarioMinimo,
  defaultTipo = "entrada",
  defaultClientId,
  defaultProcessoId,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    LancamentoFormState,
    FormData
  >(createLancamentoAction, null);

  const [tipo, setTipo] = useState<"entrada" | "saida">(defaultTipo);

  // ── Vinculação ─────────────────────────────────────────────
  const initialClient = defaultClientId
    ? (clients.find((c) => c.id === defaultClientId) ?? null)
    : null;
  const [clientSearch, setClientSearch] = useState(initialClient?.name ?? "");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    initialClient
  );
  const [processoId, setProcessoId] = useState(defaultProcessoId ?? "");
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
    const cat = finalCategoria || (tipo === "entrada" ? "Receita" : "Despesa");
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
  const [salarioBase, setSalarioBase] = useState<"minimo" | "custom">("minimo");
  const [salarioCustomInput, setSalarioCustomInput] = useState("");
  const [jaRecebida, setJaRecebida] = useState(false);

  // ── Novos modos ────────────────────────────────────────────
  const [valorRetroativo, setValorRetroativo] = useState("");
  const [percentualAdv, setPercentualAdv] = useState("30");
  const [valorMensalidade, setValorMensalidade] = useState("");

  // ── Salário base ───────────────────────────────────────────
  const salarioBaseValor = useMemo(() => {
    if (salarioBase === "custom") {
      const v = parseFloat(parseMoney(salarioCustomInput));
      return v > 0 ? v : salarioMinimo;
    }
    return salarioMinimo;
  }, [salarioBase, salarioCustomInput, salarioMinimo]);

  const salarioValor = useMemo(() => {
    if (!salarioMode) return null;
    const n = parseFloat(numSalarios.replace(",", ".")) || 1;
    return (salarioBaseValor * n).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }, [salarioMode, numSalarios, salarioBaseValor]);

  // ── Cálculo Retroativo ─────────────────────────────────────
  const retroativoCalc = useMemo(() => {
    if (paymentMode !== "retroativo") return null;
    const vRetro = parseFloat(parseMoney(valorRetroativo)) || 0;
    const pct = parseFloat(percentualAdv) || 0;
    const percValor = Math.round(vRetro * (pct / 100) * 100) / 100;
    const salarioPart = salarioMode
      ? Math.round(
          (parseFloat(numSalarios.replace(",", ".")) || 0) *
            salarioBaseValor *
            100
        ) / 100
      : 0;
    const total = percValor + salarioPart;
    return { vRetro, pct, percValor, salarioPart, total };
  }, [
    paymentMode,
    valorRetroativo,
    percentualAdv,
    salarioMode,
    numSalarios,
    salarioBaseValor,
  ]);

  // ── Valor efetivo (base para cálculos) ─────────────────────
  const effectiveValor =
    paymentMode === "retroativo" && retroativoCalc != null
      ? retroativoCalc.total > 0
        ? retroativoCalc.total.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : ""
      : salarioMode
        ? (salarioValor ?? "")
        : valor;

  // ── Cálculo Mensalidade fixa ───────────────────────────────
  const mensalidadeCalc = useMemo(() => {
    if (paymentMode !== "mensalidade") return null;
    const total = parseFloat(parseMoney(effectiveValor)) || 0;
    const mens = parseFloat(parseMoney(valorMensalidade)) || 0;
    if (!total || !mens || mens <= 0) return null;
    const numParcelas = Math.ceil(total / mens);
    return { total, mens, numParcelas };
  }, [paymentMode, effectiveValor, valorMensalidade]);

  // ── Preview Parcelado (inclui modo retroativo) ─────────────
  const previewParcelas = useMemo(() => {
    if (paymentMode !== "parcelado" && paymentMode !== "retroativo")
      return null;
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

  // ── Comissão de indicador ──────────────────────────────────
  const commissionInfo = useMemo(() => {
    if (tipo !== "entrada") return null;
    if (!processoId) return null;
    if (!selectedClient?.indicador_id) return null;
    if (!selectedClient.comissao_tipo || selectedClient.comissao_valor == null)
      return null;
    const baseValor = parseFloat(parseMoney(effectiveValor)) || 0;
    let comissaoValorCalculado = 0;
    if (selectedClient.comissao_tipo === "percentual") {
      comissaoValorCalculado =
        baseValor * (selectedClient.comissao_valor / 100);
    } else {
      comissaoValorCalculado = selectedClient.comissao_valor;
    }
    return {
      indicador_id: selectedClient.indicador_id,
      indicador_nome: selectedClient.indicador_nome ?? "",
      comissao_tipo: selectedClient.comissao_tipo,
      comissao_valor_config: selectedClient.comissao_valor,
      comissao_calculada: comissaoValorCalculado,
    };
  }, [tipo, processoId, selectedClient, effectiveValor]);

  // ── Número total de parcelas para modo mensalidade ─────────
  const totalParcelasEfetivo =
    paymentMode === "mensalidade" && mensalidadeCalc
      ? String(mensalidadeCalc.numParcelas)
      : totalParcelas;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Hidden fields */}
      <input type="hidden" name="payment_mode" value={paymentMode} />
      <input
        type="hidden"
        name="parcelado"
        value={String(
          paymentMode === "parcelado" || paymentMode === "retroativo"
        )}
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
      <input type="hidden" name="total_parcelas" value={totalParcelasEfetivo} />
      <input
        type="hidden"
        name="valor_mensalidade"
        value={parseMoney(valorMensalidade)}
      />
      <input
        type="hidden"
        name="indicador_id"
        value={commissionInfo?.indicador_id ?? ""}
      />
      <input
        type="hidden"
        name="comissao_tipo"
        value={commissionInfo?.comissao_tipo ?? ""}
      />
      <input
        type="hidden"
        name="comissao_valor_config"
        value={
          commissionInfo?.comissao_valor_config != null
            ? String(commissionInfo.comissao_valor_config)
            : ""
        }
      />

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
                  {t === "entrada" ? "Receita" : "Despesa"}
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

          {commissionInfo && (
            <div className="sm:col-span-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Comissão do indicador — será criada automaticamente
                  {(paymentMode === "parcelado" ||
                    paymentMode === "retroativo" ||
                    paymentMode === "mensalidade") &&
                  totalParcelasEfetivo
                    ? ` (${totalParcelasEfetivo}× parcelas)`
                    : ""}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="font-body text-xs text-amber-600">
                      Indicador
                    </span>
                    <p className="font-body text-sm font-semibold text-fg">
                      {commissionInfo.indicador_nome}
                    </p>
                  </div>
                  <div>
                    <span className="font-body text-xs text-amber-600">
                      Regra
                    </span>
                    <p className="font-body text-sm font-semibold text-fg">
                      {commissionInfo.comissao_tipo === "percentual"
                        ? `${commissionInfo.comissao_valor_config}%`
                        : fmt(commissionInfo.comissao_valor_config)}
                    </p>
                  </div>
                  {commissionInfo.comissao_calculada > 0 && (
                    <>
                      <div>
                        <span className="font-body text-xs text-amber-600">
                          Total da comissão
                        </span>
                        <p className="font-heading text-base font-semibold text-amber-800">
                          {fmt(commissionInfo.comissao_calculada)}
                        </p>
                      </div>
                      {(paymentMode === "parcelado" ||
                        paymentMode === "retroativo" ||
                        paymentMode === "mensalidade") &&
                        parseInt(totalParcelasEfetivo) > 1 && (
                          <div>
                            <span className="font-body text-xs text-amber-600">
                              Por parcela
                            </span>
                            <p className="font-heading text-sm font-semibold text-amber-700">
                              {fmt(
                                Math.round(
                                  (commissionInfo.comissao_calculada /
                                    parseInt(totalParcelasEfetivo)) *
                                    100
                                ) / 100
                              )}
                            </p>
                          </div>
                        )}
                    </>
                  )}
                </div>
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

          <Field label="Data de vencimento">
            <input
              name="data_vencimento"
              type="date"
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
          {/* ── Modo de pagamento — linha 1: modos padrão ── */}
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
                  onClick={() => {
                    setPaymentMode(m.key);
                    setValorRetroativo("");
                    setValorMensalidade("");
                  }}
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

            {/* ── Linha 2: modos especiais ── */}
            <div className="mt-2 flex gap-2">
              {(
                [
                  {
                    key: "retroativo",
                    label: "Retroativo + Parcelado",
                    desc: "% sobre retroativo + salários",
                  },
                  {
                    key: "mensalidade",
                    label: "Mensalidade Fixa",
                    desc: "total em salários ÷ parcela fixa",
                  },
                ] as { key: PaymentMode; label: string; desc: string }[]
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setPaymentMode(m.key);
                    setValor("");
                    setSalarioMode(false);
                    setSalarioBase("minimo");
                    setSalarioCustomInput("");
                  }}
                  disabled={isPending}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 font-body transition-colors duration-150 ${
                    paymentMode === m.key
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-border text-muted hover:border-slate-300 hover:text-fg"
                  }`}
                >
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p
                    className={`text-[11px] font-normal ${paymentMode === m.key ? "text-violet-500" : "text-slate-400"}`}
                  >
                    {m.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Grid de campos ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* ── Campos exclusivos do modo RETROATIVO ── */}
            {paymentMode === "retroativo" && (
              <>
                <Field label="Valor retroativo a receber pelo cliente" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorRetroativo}
                      onChange={(e) =>
                        setValorRetroativo(formatMoneyInput(e.target.value))
                      }
                      onBlur={() =>
                        setValorRetroativo(normalizeMoneyBlur(valorRetroativo))
                      }
                      disabled={isPending}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                <Field label="Percentual do advogado (%)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={percentualAdv}
                      onChange={(e) => setPercentualAdv(e.target.value)}
                      disabled={isPending}
                      className={`${inputClass} max-w-[120px]`}
                    />
                    <span className="font-body text-sm text-muted">%</span>
                    {retroativoCalc && retroativoCalc.vRetro > 0 && (
                      <span className="font-body text-sm font-semibold text-violet-700">
                        = {fmt(retroativoCalc.percValor)}
                      </span>
                    )}
                  </div>
                </Field>
              </>
            )}

            {/* ── Toggle salário mínimo ── */}
            {tipo === "entrada" && (
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-border px-4 py-3.5 transition-colors hover:border-slate-300">
                  <div
                    onClick={() => {
                      setSalarioMode((v) => !v);
                      if (salarioMode) {
                        setValor("");
                        setSalarioBase("minimo");
                        setSalarioCustomInput("");
                      }
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
                      {paymentMode === "retroativo"
                        ? "Acrescentar salários mínimos ao honorário"
                        : paymentMode === "mensalidade"
                          ? "Total baseado em salários mínimos"
                          : "Baseado em salário mínimo vigente"}
                    </p>
                    <p className="font-body text-xs text-muted">
                      SM atual: {fmt(salarioMinimo)}{" "}
                      {paymentMode === "retroativo"
                        ? "— componente adicional ao percentual"
                        : "— calcular automaticamente"}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {tipo === "entrada" && salarioMode && (
              <div className="sm:col-span-2 space-y-3">
                {/* Seletor de base salarial */}
                <div>
                  <label className={labelClass}>Base do cálculo</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSalarioBase("minimo");
                        setSalarioCustomInput("");
                      }}
                      disabled={isPending}
                      className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                        salarioBase === "minimo"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                          : "border-border text-muted hover:border-slate-300 hover:text-fg"
                      }`}
                    >
                      SM vigente — {fmt(salarioMinimo)}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSalarioBase("custom")}
                      disabled={isPending}
                      className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                        salarioBase === "custom"
                          ? "border-primary bg-blue-50 text-primary"
                          : "border-border text-muted hover:border-slate-300 hover:text-fg"
                      }`}
                    >
                      Salário do cliente
                    </button>

                    {salarioBase === "custom" && (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={salarioCustomInput}
                          onChange={(e) =>
                            setSalarioCustomInput(
                              formatMoneyInput(e.target.value)
                            )
                          }
                          onBlur={() =>
                            setSalarioCustomInput(
                              normalizeMoneyBlur(salarioCustomInput)
                            )
                          }
                          disabled={isPending}
                          className={`${inputClass} pl-10 w-44`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantidade × base = total */}
                <div>
                  <label className={labelClass}>Quantidade de salários</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={numSalarios}
                      onChange={(e) =>
                        setNumSalarios(e.target.value.replace(/[^0-9.,]/g, ""))
                      }
                      disabled={isPending}
                      className={`${inputClass} max-w-[120px]`}
                    />
                    <span className="font-body text-sm text-muted">
                      ×{" "}
                      {salarioBase === "custom" &&
                      parseFloat(parseMoney(salarioCustomInput)) > 0
                        ? fmt(parseFloat(parseMoney(salarioCustomInput)))
                        : fmt(salarioMinimo)}
                    </span>
                    {salarioValor && (
                      <span className="font-body text-sm font-semibold text-emerald-700">
                        ={" "}
                        {fmt(
                          (parseFloat(numSalarios.replace(",", ".")) || 0) *
                            salarioBaseValor
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Resumo do cálculo retroativo ── */}
            {paymentMode === "retroativo" &&
              retroativoCalc &&
              retroativoCalc.total > 0 && (
                <div className="sm:col-span-2">
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">
                      Composição do honorário
                    </p>
                    <div className="flex flex-wrap gap-5">
                      <div>
                        <span className="font-body text-xs text-muted">
                          {retroativoCalc.pct}% do retroativo
                        </span>
                        <p className="font-heading text-base font-semibold text-fg">
                          {fmt(retroativoCalc.percValor)}
                        </p>
                      </div>
                      {retroativoCalc.salarioPart > 0 && (
                        <div>
                          <span className="font-body text-xs text-muted">
                            + {parseFloat(numSalarios.replace(",", ".")) || 0}×{" "}
                            {salarioBase === "custom" ? "sal. cliente" : "SM"}
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {fmt(retroativoCalc.salarioPart)}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="font-body text-xs font-semibold text-violet-600">
                          Total do honorário
                        </span>
                        <p className="font-heading text-xl font-bold text-violet-700">
                          {fmt(retroativoCalc.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* ── Valor total (oculto no modo retroativo) ── */}
            {paymentMode !== "retroativo" && (
              <Field
                label={
                  paymentMode === "mensalidade"
                    ? "Valor total cobrado"
                    : "Valor total"
                }
                required
              >
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
            )}

            {/* ── Campos do modo PARCELADO e RETROATIVO ── */}
            {(paymentMode === "parcelado" || paymentMode === "retroativo") && (
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

            {/* ── Campos do modo MENSALIDADE FIXA ── */}
            {paymentMode === "mensalidade" && (
              <>
                <Field
                  label="Mensalidade do cliente (valor fixo da parcela)"
                  required
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorMensalidade}
                      onChange={(e) =>
                        setValorMensalidade(formatMoneyInput(e.target.value))
                      }
                      onBlur={() =>
                        setValorMensalidade(
                          normalizeMoneyBlur(valorMensalidade)
                        )
                      }
                      disabled={isPending}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                {mensalidadeCalc && (
                  <div className="sm:col-span-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-amber-700 mb-3">
                        Plano de pagamento
                      </p>
                      <div className="flex flex-wrap gap-6 items-end">
                        <div>
                          <span className="font-body text-xs text-muted">
                            Total cobrado
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {fmt(mensalidadeCalc.total)}
                          </p>
                        </div>
                        <div className="text-muted font-body text-lg">÷</div>
                        <div>
                          <span className="font-body text-xs text-muted">
                            Mensalidade
                          </span>
                          <p className="font-heading text-base font-semibold text-fg">
                            {fmt(mensalidadeCalc.mens)}
                          </p>
                        </div>
                        <div className="text-muted font-body text-lg">=</div>
                        <div>
                          <span className="font-body text-xs font-semibold text-amber-700">
                            Total de parcelas
                          </span>
                          <p className="font-heading text-2xl font-bold text-amber-800">
                            {mensalidadeCalc.numParcelas}×
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2">
                        <p className="font-body text-sm font-semibold text-amber-900">
                          O cliente ficará devendo{" "}
                          <strong>
                            {mensalidadeCalc.numParcelas} parcelas
                          </strong>{" "}
                          de <strong>{fmt(mensalidadeCalc.mens)}</strong>
                        </p>
                        <p className="font-body text-xs text-amber-700 mt-0.5">
                          Serão criados {mensalidadeCalc.numParcelas}{" "}
                          lançamentos mensais de {fmt(mensalidadeCalc.mens)}{" "}
                          cada
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Campos do modo RECORRENTE ── */}
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
