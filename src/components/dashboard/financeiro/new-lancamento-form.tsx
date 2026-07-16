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

type PaymentMode = "avista" | "parcelado" | "retroativo" | "mensalidade";

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
  redirectTo?: string;
  cancelAguardando?: string;
  valorInicial?: string;
}

export default function NewLancamentoForm({
  clients,
  processos,
  salarioMinimo,
  defaultTipo = "entrada",
  defaultClientId,
  defaultProcessoId,
  redirectTo,
  cancelAguardando,
  valorInicial,
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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("retroativo");
  const [valor, setValor] = useState(() => {
    if (!valorInicial) return "";
    const n = parseFloat(valorInicial);
    if (isNaN(n)) return "";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  });
  const [valorEntrada, setValorEntrada] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [valorEntradaMensalidade, setValorEntradaMensalidade] = useState("");
  const [numSalarios, setNumSalarios] = useState("1");
  const [salarioBase, setSalarioBase] = useState<
    "none" | "minimo" | "custom" | "recorrente"
  >("none");
  const [salarioCustomInput, setSalarioCustomInput] = useState("");
  const [jaRecebida, setJaRecebida] = useState(false);
  const [aguardandoResultado, setAguardandoResultado] = useState(false);
  const [comissaoModoPag, setComissaoModoPag] = useState<"auto" | "avista">(
    "avista"
  );
  const [comissaoValorCustomInput, setComissaoValorCustomInput] = useState("");

  // ── Novos modos ────────────────────────────────────────────
  const [valorRetroativo, setValorRetroativo] = useState("");
  const [percentualAdv, setPercentualAdv] = useState("30");
  const [valorMensalidade, setValorMensalidade] = useState("");
  const [percentualSalario, setPercentualSalario] = useState("");

  // ── Meses a gerar (modo recorrente) ────────────────────────
  const [mesesGerar, setMesesGerar] = useState("12");

  // ── Salário base ───────────────────────────────────────────
  const salarioMode = salarioBase === "minimo" || salarioBase === "custom";

  const salarioBaseValor = useMemo(() => {
    if (salarioBase === "custom") {
      const v = parseFloat(parseMoney(salarioCustomInput));
      return v > 0 ? v : salarioMinimo;
    }
    return salarioMinimo;
  }, [salarioBase, salarioCustomInput, salarioMinimo]);

  const pctSalario = parseFloat(percentualSalario) || 0;
  const salarioMensal =
    pctSalario > 0 ? salarioBaseValor * (pctSalario / 100) : salarioBaseValor;

  const salarioValor = useMemo(() => {
    if (salarioBase === "none") return null;
    const n = parseFloat(numSalarios.replace(",", ".")) || 1;
    return (salarioMensal * n).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });
  }, [salarioBase, numSalarios, salarioMensal]);

  // ── Cálculo Retroativo ─────────────────────────────────────
  const retroativoCalc = useMemo(() => {
    if (paymentMode !== "retroativo") return null;
    const vRetro = parseFloat(parseMoney(valorRetroativo)) || 0;
    const pct = parseFloat(percentualAdv) || 0;
    const percValor = Math.round(vRetro * (pct / 100) * 100) / 100;
    const salarioPart =
      salarioBase !== "none"
        ? Math.round(
            (parseFloat(numSalarios.replace(",", ".")) || 0) *
              salarioMensal *
              100
          ) / 100
        : 0;
    const total = percValor; // salarioPart é informativo — lançamento à parte
    return { vRetro, pct, percValor, salarioPart, total };
  }, [
    paymentMode,
    valorRetroativo,
    percentualAdv,
    salarioBase,
    numSalarios,
    salarioMensal,
  ]);

  // ── Valor efetivo (base para cálculos) ─────────────────────
  const effectiveValor = (() => {
    if (paymentMode === "mensalidade" && salarioBase === "recorrente") {
      const mens = parseFloat(parseMoney(valorMensalidade)) || 0;
      const meses = Math.max(1, parseInt(mesesGerar) || 12);
      const total = Math.round(meses * mens * 100) / 100;
      return total > 0
        ? total.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";
    }
    if (paymentMode === "retroativo" && retroativoCalc != null)
      return retroativoCalc.total > 0
        ? retroativoCalc.total.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : valor;
    return salarioMode ? (salarioValor ?? "") : valor;
  })();

  // ── Cálculo Mensalidade fixa ───────────────────────────────
  const mensalidadeCalc = useMemo(() => {
    if (paymentMode !== "mensalidade") return null;
    const total = parseFloat(parseMoney(effectiveValor)) || 0;
    const mens = parseFloat(parseMoney(valorMensalidade)) || 0;
    const entrada = parseFloat(parseMoney(valorEntradaMensalidade)) || 0;
    if (!total || !mens || mens <= 0) return null;
    const valorParcelar = entrada > 0 ? Math.max(total - entrada, 0) : total;
    const numParcelas =
      valorParcelar > 0 ? Math.max(1, Math.floor(valorParcelar / mens)) : 0;
    const valorUltimaParcela =
      numParcelas > 0
        ? Math.round((valorParcelar - (numParcelas - 1) * mens) * 100) / 100
        : 0;
    const ultimaDifere =
      numParcelas > 1 && Math.abs(valorUltimaParcela - mens) >= 0.01;
    return {
      total,
      mens,
      numParcelas,
      entrada,
      valorUltimaParcela,
      ultimaDifere,
    };
  }, [paymentMode, effectiveValor, valorMensalidade, valorEntradaMensalidade]);

  // ── Preview Parcelado (inclui modo retroativo) ─────────────
  const previewParcelas = useMemo(() => {
    if (paymentMode !== "parcelado" && paymentMode !== "retroativo")
      return null;
    // Retroativo: parcela o honorário mensal (salarioPart), não o retroativo
    const v =
      paymentMode === "retroativo"
        ? (retroativoCalc?.salarioPart ?? 0)
        : parseFloat(parseMoney(effectiveValor));
    const e = parseFloat(parseMoney(valorEntrada)) || 0;
    const n = parseInt(totalParcelas) || 1;
    if (!v || v <= 0) return null;
    const restante = v - e;
    if (restante <= 0) return null;
    return { entrada: e, valorParcela: restante / n, n, total: v };
  }, [
    paymentMode,
    effectiveValor,
    valorEntrada,
    totalParcelas,
    retroativoCalc,
  ]);

  // ── Comissão de indicador ──────────────────────────────────
  const commissionInfo = useMemo(() => {
    if (tipo !== "entrada") return null;
    if (!processoId) return null;
    if (!selectedClient?.indicador_id) return null;
    if (!selectedClient.comissao_tipo || selectedClient.comissao_valor == null)
      return null;
    // Usa valor total (retroativo + salário) como base da comissão
    const baseValor =
      paymentMode === "retroativo" && retroativoCalc
        ? retroativoCalc.percValor + retroativoCalc.salarioPart
        : parseFloat(parseMoney(effectiveValor)) || 0;
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
  }, [
    tipo,
    processoId,
    selectedClient,
    effectiveValor,
    paymentMode,
    retroativoCalc,
  ]);

  // ── Opção de pagamento da comissão ────────────────────────
  const comissaoValorCustomEffective =
    comissaoModoPag === "avista" && comissaoValorCustomInput
      ? parseMoney(comissaoValorCustomInput)
      : "";

  // ── Número total de parcelas para modo mensalidade ─────────
  const totalParcelasEfetivo =
    paymentMode === "mensalidade" && mensalidadeCalc
      ? String(mensalidadeCalc.numParcelas)
      : totalParcelas;

  // ── Valores corrigidos para submissão ao backend (modo retroativo) ──────
  // No modo retroativo: valor total = percValor + salarioPart;
  // a entrada enviada = percValor (retroativo vira entrada) + extraEntrada do usuário.
  // Quando não há salário, retroativo é avista.
  const retroHasSalario =
    paymentMode === "retroativo" &&
    retroativoCalc != null &&
    retroativoCalc.salarioPart > 0;

  const valorSubmit = (() => {
    if (!retroHasSalario) return parseMoney(effectiveValor);
    const total =
      (retroativoCalc?.percValor ?? 0) + (retroativoCalc?.salarioPart ?? 0);
    return String(Math.round(total * 100) / 100);
  })();

  const valorEntradaSubmit = (() => {
    if (!retroHasSalario) return parseMoney(valorEntrada);
    const extra = parseFloat(parseMoney(valorEntrada)) || 0;
    const entradaTotal = (retroativoCalc?.percValor ?? 0) + extra;
    return String(Math.round(entradaTotal * 100) / 100);
  })();

  // Retroativo sem salário → avista (não parcelado)
  const paymentModeSubmit =
    paymentMode === "retroativo" && !retroHasSalario ? "avista" : paymentMode;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Hidden fields */}
      {cancelAguardando && (
        <input
          type="hidden"
          name="cancel_aguardando"
          value={cancelAguardando}
        />
      )}
      <input type="hidden" name="payment_mode" value={paymentModeSubmit} />
      <input
        type="hidden"
        name="parcelado"
        value={String(
          paymentModeSubmit === "parcelado" ||
            paymentModeSubmit === "retroativo"
        )}
      />
      <input type="hidden" name="descricao" value={autoDescricao} />
      <input type="hidden" name="valor" value={valorSubmit} />
      <input
        type="hidden"
        name="valor_entrada"
        value={
          paymentMode === "mensalidade"
            ? parseMoney(valorEntradaMensalidade)
            : valorEntradaSubmit
        }
      />
      <input type="hidden" name="categoria" value={finalCategoria} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ""} />
      <input
        type="hidden"
        name="status"
        value={
          jaRecebida
            ? "pago"
            : aguardandoResultado && tipo === "entrada"
              ? "aguardando_resultado"
              : "pendente"
        }
      />
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
      <input
        type="hidden"
        name="comissao_modo_pagamento"
        value={commissionInfo ? comissaoModoPag : "auto"}
      />
      <input
        type="hidden"
        name="comissao_valor_custom"
        value={comissaoValorCustomEffective}
      />
      {redirectTo && (
        <input type="hidden" name="redirect_to" value={redirectTo} />
      )}

      {cancelAguardando && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-body text-sm font-semibold text-emerald-800">
            Registrando resultado do processo
          </p>
          <p className="mt-0.5 font-body text-xs text-emerald-700">
            Defina o valor final aprovado, a forma de pagamento e as datas. O
            lançamento &quot;Aguardando resultado&quot; será cancelado
            automaticamente ao salvar.
          </p>
        </div>
      )}

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
                  setSalarioBase("none");
                  setSalarioCustomInput("");
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

          {!aguardandoResultado && (
            <Field label="Data de vencimento">
              <input
                name="data_vencimento"
                type="date"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        {tipo === "entrada" && !jaRecebida && (
          <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
            <input
              type="checkbox"
              checked={aguardandoResultado}
              onChange={(e) => setAguardandoResultado(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 flex-shrink-0 cursor-pointer accent-amber-600"
            />
            <div>
              <p className="font-body text-sm font-semibold text-amber-900">
                Aguardando resultado — sem data de pagamento
              </p>
              <p className="font-body text-xs text-amber-700">
                Use quando o valor foi combinado mas a data depende do resultado
                (judicial ou administrativo)
              </p>
            </div>
          </label>
        )}
      </div>

      {/* ── Valores e pagamento ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e pagamento</SectionTitle>
        <div className="mt-4 space-y-4">
          {/* ── Modo de pagamento — linha 1: modos padrão ── */}
          <div>
            <label className={labelClass}>Modo de pagamento</label>

            {/* ── Linha 1: modos principais ── */}
            <div className="flex gap-2">
              {(
                [
                  {
                    key: "retroativo",
                    label: "Avista, Retroativo+Parcelado",
                    desc: "% s/ retroativo + mensal opcional",
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
                    setSalarioBase("none");
                    setSalarioCustomInput("");
                    setValorEntradaMensalidade("");
                    setComissaoModoPag("auto");
                    setComissaoValorCustomInput("");
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
                <Field label="Valor retroativo a receber pelo cliente">
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

            {/* ── Recorrente para despesas (Mensalidade Fixa) ── */}
            {tipo === "saida" && paymentMode === "mensalidade" && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Base do valor</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSalarioBase("none");
                      setValor("");
                    }}
                    disabled={isPending}
                    className={`rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                      salarioBase === "none"
                        ? "border-slate-400 bg-slate-100 text-slate-800"
                        : "border-border text-muted hover:border-slate-300 hover:text-fg"
                    }`}
                  >
                    Valor livre
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSalarioBase("recorrente");
                      setValor("");
                    }}
                    disabled={isPending}
                    className={`rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                      salarioBase === "recorrente"
                        ? "border-violet-500 bg-violet-50 text-violet-800"
                        : "border-border text-muted hover:border-slate-300 hover:text-fg"
                    }`}
                  >
                    Recorrente
                  </button>
                </div>
              </div>
            )}

            {/* ── Base salarial (receitas) ── */}
            {tipo === "entrada" && (
              <div className="sm:col-span-2 space-y-3">
                <div>
                  <label className={labelClass}>
                    {paymentMode === "retroativo"
                      ? "Honorário mensal sobre salários"
                      : "Base do valor"}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Valor livre */}
                    <button
                      type="button"
                      onClick={() => {
                        setSalarioBase("none");
                        setSalarioCustomInput("");
                        setValor("");
                      }}
                      disabled={isPending}
                      className={`rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                        salarioBase === "none"
                          ? "border-slate-400 bg-slate-100 text-slate-800"
                          : "border-border text-muted hover:border-slate-300 hover:text-fg"
                      }`}
                    >
                      {paymentMode === "retroativo"
                        ? "Sem pagamento mensal"
                        : "Valor livre"}
                    </button>

                    {/* 2. Recorrente — Mensalidade Fixa (receita OU despesa) */}
                    {paymentMode === "mensalidade" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSalarioBase("recorrente");
                          setSalarioCustomInput("");
                          setValor("");
                        }}
                        disabled={isPending}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 font-body text-sm font-semibold transition-colors duration-150 ${
                          salarioBase === "recorrente"
                            ? "border-violet-500 bg-violet-50 text-violet-800"
                            : "border-border text-muted hover:border-slate-300 hover:text-fg"
                        }`}
                      >
                        Recorrente
                      </button>
                    )}

                    {/* 3. SM vigente */}
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

                    {/* 4. Salário do cliente */}
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

                    {/* Campo de salário personalizado */}
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

                {/* Percentual + quantidade (só quando uma base está ativa) */}
                {salarioBase !== "none" && (
                  <div className="space-y-3">
                    {/* % sobre salário (opcional) */}
                    <div>
                      <label className={labelClass}>
                        Percentual sobre o salário{" "}
                        <span className="font-normal text-slate-400">
                          — deixe vazio para salário cheio
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="—"
                          value={percentualSalario}
                          onChange={(e) => setPercentualSalario(e.target.value)}
                          disabled={isPending}
                          className={`${inputClass} max-w-[120px]`}
                        />
                        <span className="font-body text-sm text-muted">%</span>
                        {pctSalario > 0 ? (
                          <span className="font-body text-sm font-semibold text-blue-700">
                            = {fmt(salarioMensal)}/mês
                          </span>
                        ) : (
                          <span className="font-body text-sm text-slate-400">
                            (salário cheio: {fmt(salarioBaseValor)}/mês)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantidade de meses / salários */}
                    <div>
                      <label className={labelClass}>
                        {paymentMode === "retroativo"
                          ? "Quantidade de meses"
                          : "Quantidade de salários"}
                      </label>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={numSalarios}
                          onChange={(e) =>
                            setNumSalarios(
                              e.target.value.replace(/[^0-9.,]/g, "")
                            )
                          }
                          disabled={isPending}
                          className={`${inputClass} max-w-[120px]`}
                        />
                        <span className="font-body text-sm text-muted">
                          × {fmt(salarioMensal)}
                        </span>
                        {salarioValor && (
                          <span className="font-body text-sm font-semibold text-emerald-700">
                            ={" "}
                            {fmt(
                              (parseFloat(numSalarios.replace(",", ".")) || 0) *
                                salarioMensal
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Entrada + Parcelas — só no modo retroativo */}
                    {paymentMode === "retroativo" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Valor de entrada</label>
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
                                setValorEntrada(
                                  formatMoneyInput(e.target.value)
                                )
                              }
                              onBlur={() =>
                                setValorEntrada(
                                  normalizeMoneyBlur(valorEntrada)
                                )
                              }
                              disabled={isPending}
                              className={`${inputClass} pl-10`}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Número de parcelas
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={totalParcelas}
                            onChange={(e) => setTotalParcelas(e.target.value)}
                            disabled={isPending}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Comissão do indicador ── */}
            {commissionInfo && (
              <div className="sm:col-span-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Comissão do indicador
                  </p>

                  <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
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
                      <div>
                        <span className="font-body text-xs text-amber-600">
                          Valor da comissão
                        </span>
                        <p className="font-heading text-lg font-bold text-amber-800">
                          {fmt(commissionInfo.comissao_calculada)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Como pagar — sempre visível quando há valor calculado */}
                  {commissionInfo.comissao_calculada > 0 && (
                    <div className="space-y-2.5 pt-1 border-t border-amber-200">
                      <p className="font-body text-xs font-semibold text-amber-800 pt-2">
                        Como pagar a comissão?
                      </p>

                      {/* Escolha acompanhar parcelas ou pagar à vista */}
                      {(paymentMode === "mensalidade" ||
                        (paymentMode === "retroativo" && retroHasSalario)) && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setComissaoModoPag("auto")}
                            disabled={isPending}
                            className={`flex-1 rounded-lg border-2 px-3 py-2 font-body text-xs font-semibold transition-colors duration-150 ${
                              comissaoModoPag === "auto"
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : "border-border text-muted hover:border-slate-300 hover:text-fg"
                            }`}
                          >
                            Acompanhar parcelas do cliente
                          </button>
                          <button
                            type="button"
                            onClick={() => setComissaoModoPag("avista")}
                            disabled={isPending}
                            className={`flex-1 rounded-lg border-2 px-3 py-2 font-body text-xs font-semibold transition-colors duration-150 ${
                              comissaoModoPag === "avista"
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : "border-border text-muted hover:border-slate-300 hover:text-fg"
                            }`}
                          >
                            À vista — valor acordado
                          </button>
                        </div>
                      )}

                      {/* Campo valor à vista (sempre quando avista) */}
                      {comissaoModoPag === "avista" && (
                        <div>
                          <label className="block font-body text-xs font-semibold text-amber-800 mb-1">
                            Valor da comissão à vista
                            <span className="font-normal text-amber-600 ml-1">
                              — pode ser menor se houver desconto
                            </span>
                          </label>
                          <div className="relative max-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={comissaoValorCustomInput}
                              onChange={(e) =>
                                setComissaoValorCustomInput(
                                  formatMoneyInput(e.target.value)
                                )
                              }
                              onBlur={() =>
                                setComissaoValorCustomInput(
                                  normalizeMoneyBlur(comissaoValorCustomInput)
                                )
                              }
                              disabled={isPending}
                              className={`${inputClass} pl-10`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Resumo */}
                      <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
                        {comissaoModoPag === "avista"
                          ? (() => {
                              const valorEfetivo = comissaoValorCustomInput
                                ? parseFloat(
                                    parseMoney(comissaoValorCustomInput)
                                  ) || commissionInfo.comissao_calculada
                                : commissionInfo.comissao_calculada;
                              return (
                                <p className="font-body text-xs font-semibold text-amber-900">
                                  1 remuneração à vista de{" "}
                                  <strong>{fmt(valorEfetivo)}</strong> para{" "}
                                  {commissionInfo.indicador_nome}
                                </p>
                              );
                            })()
                          : (() => {
                              const n = parseInt(totalParcelasEfetivo) || 1;
                              const totalVal = parseFloat(valorSubmit) || 0;
                              const entradaVal =
                                parseFloat(
                                  paymentMode === "mensalidade"
                                    ? parseMoney(valorEntradaMensalidade)
                                    : valorEntradaSubmit
                                ) || 0;
                              const parcelaVal =
                                paymentMode === "mensalidade"
                                  ? parseFloat(parseMoney(valorMensalidade)) ||
                                    0
                                  : totalVal > 0 && n > 0
                                    ? Math.round(
                                        ((totalVal - entradaVal) / n) * 100
                                      ) / 100
                                    : 0;
                              const calcC = (v: number) =>
                                commissionInfo.comissao_tipo === "percentual"
                                  ? Math.round(
                                      v *
                                        (commissionInfo.comissao_valor_config /
                                          100) *
                                        100
                                    ) / 100
                                  : totalVal > 0
                                    ? Math.round(
                                        commissionInfo.comissao_calculada *
                                          (v / totalVal) *
                                          100
                                      ) / 100
                                    : 0;
                              const commEntrada =
                                entradaVal > 0 ? calcC(entradaVal) : 0;
                              const commParcela = calcC(parcelaVal);
                              return (
                                <p className="font-body text-xs font-semibold text-amber-900">
                                  {commEntrada > 0 && (
                                    <>
                                      1 remuneração à vista de{" "}
                                      <strong>{fmt(commEntrada)}</strong>{" "}
                                      (entrada) +{" "}
                                    </>
                                  )}
                                  {n} {n > 1 ? "remunerações" : "remuneração"}{" "}
                                  de <strong>{fmt(commParcela)}</strong>
                                  {n > 1 ? "/parcela" : ""} para{" "}
                                  {commissionInfo.indicador_nome}
                                </p>
                              );
                            })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Resumo do cálculo retroativo ── */}
            {paymentMode === "retroativo" &&
              retroativoCalc &&
              retroativoCalc.percValor > 0 && (
                <div className="sm:col-span-2 space-y-2">
                  {/* Bloco 1: honorário retroativo — este lançamento */}
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">
                      Honorário retroativo — este lançamento
                    </p>
                    <div className="flex flex-wrap gap-5 items-end">
                      <div>
                        <span className="font-body text-xs text-muted">
                          {retroativoCalc.pct}% do retroativo (
                          {fmt(retroativoCalc.vRetro)})
                        </span>
                        <p className="font-heading text-xl font-bold text-violet-700">
                          {fmt(retroativoCalc.percValor)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: honorário mensal — informativo */}
                  {retroativoCalc.salarioPart > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                        Honorário mensal estimado — lançar separadamente
                      </p>
                      <div className="flex flex-wrap gap-5 items-end">
                        <div>
                          <span className="font-body text-xs text-muted">
                            Por mês{" "}
                            {pctSalario > 0
                              ? `(${pctSalario}% × ${salarioBase === "custom" ? "sal. cliente" : "SM"})`
                              : `(${salarioBase === "custom" ? "sal. cliente" : "SM vigente"} cheio)`}
                          </span>
                          <p className="font-heading text-base font-semibold text-amber-800">
                            {fmt(salarioMensal)}
                          </p>
                        </div>
                        <div>
                          <span className="font-body text-xs text-muted">
                            × {parseFloat(numSalarios.replace(",", ".")) || 0}{" "}
                            meses
                          </span>
                          <p className="font-heading text-base font-semibold text-amber-800">
                            {fmt(retroativoCalc.salarioPart)} total est.
                          </p>
                        </div>
                      </div>
                      <p className="font-body text-xs text-amber-600 mt-2">
                        Honorário mensal incluído neste lançamento. Defina o
                        número de parcelas mensais abaixo.
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* ── Valor total (oculto no retroativo calculado e no mensalidade recorrente) ── */}
            {(paymentMode !== "retroativo" ||
              !retroativoCalc ||
              retroativoCalc.percValor === 0) &&
              !(
                paymentMode === "mensalidade" && salarioBase === "recorrente"
              ) && (
                <Field
                  label={
                    paymentMode === "mensalidade"
                      ? "Valor total cobrado"
                      : "Valor total"
                  }
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

            {/* ── Campos do modo PARCELADO (entrada + parcelas) ── */}
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
                    type="number"
                    min="1"
                    max="120"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                    disabled={isPending}
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {/* ── Resumo de recebimento (parcelado e retroativo) ── */}
            {(paymentMode === "parcelado" || paymentMode === "retroativo") &&
              previewParcelas && (
                <div className="sm:col-span-2">
                  <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-3">
                      Resumo de recebimento
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      {/* Retroativo (se houver) */}
                      {paymentMode === "retroativo" &&
                        retroativoCalc &&
                        retroativoCalc.percValor > 0 && (
                          <>
                            <div>
                              <span className="font-body text-xs text-muted">
                                Retroativo
                              </span>
                              <p className="font-heading text-base font-semibold text-violet-700">
                                {fmt(retroativoCalc.percValor)}
                              </p>
                            </div>
                            <span className="font-body text-sm text-muted mb-1">
                              +
                            </span>
                          </>
                        )}

                      {/* Entrada (se houver) */}
                      {previewParcelas.entrada > 0 && (
                        <>
                          <div>
                            <span className="font-body text-xs text-muted">
                              Entrada
                            </span>
                            <p className="font-heading text-base font-semibold text-fg">
                              {fmt(previewParcelas.entrada)}
                            </p>
                          </div>
                          <span className="font-body text-sm text-muted mb-1">
                            +
                          </span>
                        </>
                      )}

                      {/* Parcelas mensais */}
                      <div>
                        <span className="font-body text-xs text-muted">
                          {previewParcelas.n}× parcelas
                        </span>
                        <p className="font-heading text-base font-semibold text-fg">
                          {fmt(previewParcelas.valorParcela)}
                        </p>
                      </div>

                      {/* = Total geral */}
                      <span className="font-body text-sm text-muted mb-1">
                        =
                      </span>
                      <div>
                        <span className="font-body text-xs font-semibold text-muted">
                          Total bruto
                        </span>
                        <p className="font-heading text-xl font-bold text-primary">
                          {fmt(
                            (paymentMode === "retroativo" && retroativoCalc
                              ? retroativoCalc.percValor
                              : 0) +
                              previewParcelas.entrada +
                              previewParcelas.n * previewParcelas.valorParcela
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Dedução da comissão */}
                    {commissionInfo &&
                      commissionInfo.comissao_calculada > 0 &&
                      (() => {
                        const comissaoEfetiva =
                          comissaoModoPag === "avista" &&
                          comissaoValorCustomInput
                            ? parseFloat(
                                parseMoney(comissaoValorCustomInput)
                              ) || commissionInfo.comissao_calculada
                            : commissionInfo.comissao_calculada;
                        const totalBruto =
                          (paymentMode === "retroativo" && retroativoCalc
                            ? retroativoCalc.percValor
                            : 0) +
                          previewParcelas.entrada +
                          previewParcelas.n * previewParcelas.valorParcela;
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-end gap-x-4 gap-y-1">
                            <div>
                              <span className="font-body text-xs text-muted">
                                − Comissão ({commissionInfo.indicador_nome})
                              </span>
                              <p className="font-body text-sm font-semibold text-red-500">
                                {fmt(comissaoEfetiva)}
                              </p>
                            </div>
                            <span className="font-body text-sm text-muted mb-1">
                              =
                            </span>
                            <div>
                              <span className="font-body text-xs font-semibold text-muted">
                                Líquido para o escritório
                              </span>
                              <p className="font-heading text-xl font-bold text-emerald-600">
                                {fmt(totalBruto - comissaoEfetiva)}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                </div>
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

                {salarioBase === "recorrente" ? (
                  <Field label="Gerar quantos meses agora?" required>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={mesesGerar}
                        onChange={(e) => setMesesGerar(e.target.value)}
                        disabled={isPending}
                        className={`${inputClass} max-w-[120px]`}
                      />
                      <span className="font-body text-sm text-muted">
                        meses
                      </span>
                      {parseFloat(parseMoney(valorMensalidade)) > 0 && (
                        <span className="font-body text-sm font-semibold text-emerald-700">
                          ={" "}
                          {(
                            Math.max(1, parseInt(mesesGerar) || 12) *
                            (parseFloat(parseMoney(valorMensalidade)) || 0)
                          ).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}{" "}
                          total
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-body text-xs text-primary">
                      Você pode criar mais meses depois — basta lançar novamente
                      para o mesmo cliente.
                    </p>
                  </Field>
                ) : (
                  <Field label="Valor de entrada (opcional)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted select-none">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={valorEntradaMensalidade}
                        onChange={(e) =>
                          setValorEntradaMensalidade(
                            formatMoneyInput(e.target.value)
                          )
                        }
                        onBlur={() =>
                          setValorEntradaMensalidade(
                            normalizeMoneyBlur(valorEntradaMensalidade)
                          )
                        }
                        disabled={isPending}
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </Field>
                )}

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
                        {mensalidadeCalc.entrada > 0 && (
                          <>
                            <div className="text-muted font-body text-lg">
                              −
                            </div>
                            <div>
                              <span className="font-body text-xs text-muted">
                                Entrada
                              </span>
                              <p className="font-heading text-base font-semibold text-fg">
                                {fmt(mensalidadeCalc.entrada)}
                              </p>
                            </div>
                          </>
                        )}
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
                          {salarioBase === "recorrente" ? (
                            <>
                              <strong>
                                {mensalidadeCalc.numParcelas} mensalidades
                              </strong>{" "}
                              de <strong>{fmt(mensalidadeCalc.mens)}</strong> —
                              contrato aberto
                            </>
                          ) : (
                            <>
                              {mensalidadeCalc.entrada > 0 && (
                                <>
                                  Entrada de{" "}
                                  <strong>
                                    {fmt(mensalidadeCalc.entrada)}
                                  </strong>{" "}
                                  +{" "}
                                </>
                              )}
                              <strong>
                                {mensalidadeCalc.numParcelas} parcelas
                              </strong>{" "}
                              de <strong>{fmt(mensalidadeCalc.mens)}</strong>
                              {mensalidadeCalc.ultimaDifere && (
                                <>
                                  {" "}
                                  (última:{" "}
                                  <strong>
                                    {fmt(mensalidadeCalc.valorUltimaParcela)}
                                  </strong>
                                  )
                                </>
                              )}
                            </>
                          )}
                        </p>
                        <p className="font-body text-xs text-amber-700 mt-0.5">
                          {salarioBase === "recorrente"
                            ? `Serão criados ${mensalidadeCalc.numParcelas} lançamentos mensais de ${fmt(mensalidadeCalc.mens)} cada. Adicione mais meses quando necessário.`
                            : mensalidadeCalc.entrada > 0
                              ? `Entrada de ${fmt(mensalidadeCalc.entrada)} + ${mensalidadeCalc.numParcelas} lançamentos mensais de ${fmt(mensalidadeCalc.mens)} cada${mensalidadeCalc.ultimaDifere ? ` (última: ${fmt(mensalidadeCalc.valorUltimaParcela)})` : ""}`
                              : `Serão criados ${mensalidadeCalc.numParcelas} lançamentos mensais de ${fmt(mensalidadeCalc.mens)} cada${mensalidadeCalc.ultimaDifere ? ` (última: ${fmt(mensalidadeCalc.valorUltimaParcela)})` : ""}`}
                        </p>
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
