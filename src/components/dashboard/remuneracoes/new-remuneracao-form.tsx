"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  createRemuneracaoAction,
  type RemuneracaoFormState,
} from "@/lib/remuneracao-actions";
import {
  TIPO_LABELS,
  TIPO_DESCS,
  type TipoRemuneracao,
} from "@/lib/remuneracoes-types";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
import { SpinnerIcon } from "@/components/icons";

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

const TIPO_COLORS_CARD: Record<TipoRemuneracao, string> = {
  salario: "border-blue-400 bg-blue-50",
  comissao: "border-emerald-400 bg-emerald-50",
  bonificacao: "border-amber-400 bg-amber-50",
  adiantamento: "border-rose-400 bg-rose-50",
};

const TIPO_LIST: TipoRemuneracao[] = [
  "salario",
  "comissao",
  "bonificacao",
  "adiantamento",
];

interface ClientOption {
  id: string;
  name: string;
  doc: string;
}

interface Props {
  colaboradores: {
    id: string;
    nome: string;
    cargo: string;
    salario_mensal: number | null;
  }[];
  processos: {
    id: string;
    client_id: string;
    tipo_acao: string;
    numero: string | null;
  }[];
  clients: ClientOption[];
  defaultColaboradorId?: string;
  defaultTipo?: string;
}

export default function NewRemuneracaoForm({
  colaboradores,
  processos,
  clients,
  defaultColaboradorId,
  defaultTipo,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    RemuneracaoFormState,
    FormData
  >(createRemuneracaoAction, null);

  const [selectedTipo, setSelectedTipo] = useState<TipoRemuneracao | "">(
    (defaultTipo as TipoRemuneracao) ?? ""
  );
  const [valorInput, setValorInput] = useState("");

  // Collaborator search state
  const initialColab = defaultColaboradorId
    ? (colaboradores.find((c) => c.id === defaultColaboradorId) ?? null)
    : null;
  const [colabSearch, setColabSearch] = useState(initialColab?.nome ?? "");
  const [colabDropOpen, setColabDropOpen] = useState(false);
  const [selectedColab, setSelectedColab] = useState<
    (typeof colaboradores)[number] | null
  >(initialColab);
  const colabDropRef = useRef<HTMLDivElement>(null);
  const colabInputRef = useRef<HTMLInputElement>(null);

  // Client search state (used when tipo = comissão)
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    null
  );
  const clientDropRef = useRef<HTMLDivElement>(null);

  // Auto-focus collaborator search input when tipo changes to comissão
  useEffect(() => {
    if (selectedTipo === "comissao") {
      colabInputRef.current?.focus();
    }
  }, [selectedTipo]);

  // Close collaborator dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        colabDropRef.current &&
        !colabDropRef.current.contains(e.target as Node)
      ) {
        setColabDropOpen(false);
      }
    }
    if (colabDropOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [colabDropOpen]);

  // Close client dropdown on outside click
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

  const filteredColaboradores = useMemo(() => {
    const q = colabSearch.toLowerCase().trim();
    if (!q) return colaboradores.slice(0, 8);
    return colaboradores
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (CARGO_LABELS[c.cargo as CargoColaborador] ?? c.cargo)
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 8);
  }, [colaboradores, colabSearch]);

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

  const showCompetencia =
    selectedTipo === "salario" ||
    selectedTipo === "comissao" ||
    selectedTipo === "adiantamento";
  const showProcesso = selectedTipo === "comissao";

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <input
        type="hidden"
        name="colaborador_id"
        value={selectedColab?.id ?? ""}
      />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ""} />
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* ── Tipo ── */}
      <div className="space-y-4">
        <SectionTitle>Tipo de remuneração</SectionTitle>
        <input type="hidden" name="tipo" value={selectedTipo} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIPO_LIST.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setSelectedTipo(tipo);
                if (tipo === "salario" && selectedColab?.salario_mensal) {
                  setValorInput(String(selectedColab.salario_mensal));
                }
                if (tipo !== "comissao") {
                  setSelectedClient(null);
                  setClientSearch("");
                }
              }}
              disabled={isPending}
              className={`rounded-xl border-2 p-5 text-left transition-all duration-150 cursor-pointer ${
                selectedTipo === tipo
                  ? TIPO_COLORS_CARD[tipo]
                  : "border-border bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-body text-sm font-semibold text-fg">
                {TIPO_LABELS[tipo]}
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                {TIPO_DESCS[tipo]}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Colaborador ── */}
      <div className="space-y-4">
        <SectionTitle>Colaborador</SectionTitle>
        <div className="mt-4">
          <label className={labelClass}>
            Colaborador<span className="ml-0.5 text-red-500">*</span>
          </label>
          <div ref={colabDropRef} className="relative">
            <div className="relative">
              <input
                ref={colabInputRef}
                type="text"
                autoComplete="off"
                placeholder="Buscar por nome ou cargo…"
                value={selectedColab ? selectedColab.nome : colabSearch}
                onChange={(e) => {
                  if (selectedColab) setSelectedColab(null);
                  setColabSearch(e.target.value);
                  setColabDropOpen(true);
                }}
                onFocus={() => setColabDropOpen(true)}
                disabled={isPending}
                className={inputClass}
              />
              {selectedColab && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedColab(null);
                    setColabSearch("");
                    setValorInput("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-body text-xs text-slate-600 hover:bg-slate-300"
                >
                  ×
                </button>
              )}
            </div>

            {colabDropOpen && !selectedColab && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                {filteredColaboradores.length === 0 ? (
                  <p className="px-4 py-3 font-body text-sm text-muted">
                    Nenhum colaborador encontrado
                  </p>
                ) : (
                  filteredColaboradores.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedColab(c);
                        setColabSearch("");
                        setColabDropOpen(false);
                        if (selectedTipo === "salario" && c.salario_mensal) {
                          setValorInput(String(c.salario_mensal));
                        } else if (selectedTipo === "salario") {
                          setValorInput("");
                        }
                      }}
                      className="w-full px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                    >
                      <p className="font-body text-sm font-semibold text-fg">
                        {c.nome}
                      </p>
                      <p className="font-body text-xs text-muted">
                        {CARGO_LABELS[c.cargo as CargoColaborador] ?? c.cargo}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedColab && (
              <p className="mt-1.5 font-body text-xs text-muted">
                {CARGO_LABELS[selectedColab.cargo as CargoColaborador] ??
                  selectedColab.cargo}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Valores ── */}
      <div className="space-y-4">
        <SectionTitle>Valores e datas</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor (R$)" required>
            <input
              name="valor"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              required
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          {showCompetencia && (
            <Field label="Competência (mês/ano)">
              <input
                name="competencia"
                type="month"
                disabled={isPending}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Data de pagamento">
            <input
              name="data_pagamento"
              type="date"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Status">
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
        </div>
      </div>

      {/* ── Cliente + Processo (comissão) ── */}
      {showProcesso && (
        <div className="space-y-4">
          <SectionTitle>Cliente e processo vinculado</SectionTitle>
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
                    if (selectedClient) setSelectedClient(null);
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
            <Field label="Processo (opcional)">
              <select
                name="processo_id"
                defaultValue=""
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
          </div>
        </div>
      )}

      {/* ── Descrição ── */}
      <div>
        <SectionTitle>
          {selectedTipo === "bonificacao"
            ? "Motivo / Justificativa"
            : "Descrição"}
        </SectionTitle>
        <div className="mt-4">
          <textarea
            name="descricao"
            rows={3}
            placeholder={
              selectedTipo === "bonificacao"
                ? "Ex: Meta batida em Março, Premiação por desempenho…"
                : selectedTipo === "comissao"
                  ? "Ex: 10% sobre honorários do processo XYZ…"
                  : selectedTipo === "adiantamento"
                    ? "Ex: Adiantamento de salário solicitado em 15/05…"
                    : "Observações sobre o salário…"
            }
            disabled={isPending}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/financeiro?tab=remuneracoes"
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
            "Lançar remuneração"
          )}
        </button>
      </div>
    </form>
  );
}
