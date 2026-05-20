"use client";

import Link from "next/link";
import { useActionState, useState, useMemo } from "react";
import {
  createLancamentoAction,
  type LancamentoFormState,
} from "@/lib/lancamento-actions";
import { SpinnerIcon } from "@/components/icons";

const CATEGORIAS = {
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

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ClientOption {
  id: string;
  name: string;
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
}

export default function NewLancamentoForm({ clients, processos }: Props) {
  const [state, formAction, isPending] = useActionState<
    LancamentoFormState,
    FormData
  >(createLancamentoAction, null);

  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [clientId, setClientId] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [valor, setValor] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("2");
  const [parcelado, setParcelado] = useState(false);

  const processosDoCliente = useMemo(
    () =>
      clientId ? processos.filter((p) => p.client_id === clientId) : processos,
    [clientId, processos]
  );

  const processoSelecionado = useMemo(
    () => processos.find((p) => p.id === processoId) ?? null,
    [processos, processoId]
  );

  const previewParcelas = useMemo(() => {
    const v = parseFloat(valor);
    const e = parseFloat(valorEntrada) || 0;
    const n = parseInt(totalParcelas) || 1;
    if (!v || v <= 0) return null;
    const restante = v - e;
    if (restante <= 0) return null;
    return { entrada: e, valorParcela: restante / n, n };
  }, [valor, valorEntrada, totalParcelas]);

  function handleTipoChange(t: "entrada" | "saida") {
    setTipo(t);
  }

  function handleClienteChange(id: string) {
    setClientId(id);
    setProcessoId("");
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Hidden parcelado field */}
      <input type="hidden" name="parcelado" value={String(parcelado)} />

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
                onChange={() => handleTipoChange(t)}
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

      {/* ── Dados ── */}
      <div className="space-y-4">
        <SectionTitle>Dados</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              name="categoria"
              defaultValue=""
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

          <Field label="Status" required>
            <select
              name="status"
              defaultValue="pendente"
              disabled={isPending}
              className={selectClass}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Descrição" required>
              <input
                name="descricao"
                type="text"
                required
                placeholder="Ex: Honorários — Ação Trabalhista"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Vinculação ── */}
      <div className="space-y-4">
        <SectionTitle>Vinculação (opcional)</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <select
              name="client_id"
              value={clientId}
              onChange={(e) => handleClienteChange(e.target.value)}
              disabled={isPending}
              className={selectClass}
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

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

      {/* ── Valores ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e pagamento</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor total (R$)" required>
            <input
              name="valor"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Data de vencimento" required>
            <input
              name="data_vencimento"
              type="date"
              required
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          {/* Parcelado toggle */}
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-3">
              <div
                onClick={() => setParcelado((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                  parcelado ? "bg-primary" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    parcelado ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="font-body text-sm font-semibold text-fg">
                Parcelado
              </span>
            </label>
          </div>

          {parcelado && (
            <>
              <Field label="Valor de entrada (R$)">
                <input
                  name="valor_entrada"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={valorEntrada}
                  onChange={(e) => setValorEntrada(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>

              <Field label="Número de parcelas">
                <input
                  name="total_parcelas"
                  type="number"
                  min="1"
                  max="120"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                />
              </Field>

              {/* Preview */}
              {previewParcelas && (
                <div className="sm:col-span-2">
                  <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                      Resumo do parcelamento
                    </p>
                    <div className="flex flex-wrap gap-4">
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
                          {fmt(parseFloat(valor))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
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
