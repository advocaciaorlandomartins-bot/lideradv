"use client";

import { useState } from "react";
import {
  XMarkIcon,
  SlidersIcon,
  CheckIcon,
  UsersIcon,
  MapPinIcon,
  FolderOpenIcon,
  CalendarIcon,
} from "@/components/icons";

const ESTADOS_BR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const ORIGENS = [
  "Indicação",
  "Site / Internet",
  "Redes Sociais",
  "Publicidade",
  "Caminhada",
  "Parceria",
  "Outro",
];

export interface FiltroCliente {
  tipo: "" | "PF" | "PJ";
  status: "" | "ativo" | "inativo";
  estado: string;
  comProcessos: "" | "sim" | "nao";
  origemTipo: string;
  dataInicio: string;
  dataFim: string;
  cpfCnpj: string;
}

export const FILTRO_CLIENTE_INICIAL: FiltroCliente = {
  tipo: "",
  status: "",
  estado: "",
  comProcessos: "",
  origemTipo: "",
  dataInicio: "",
  dataFim: "",
  cpfCnpj: "",
};

export function countFiltrosCliente(f: FiltroCliente): number {
  return Object.values(f).filter((v) => v !== "").length;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filtros: FiltroCliente;
  onBuscar: (f: FiltroCliente) => void;
  onLimpar: () => void;
  savedFilters: Array<{ nome: string; filtros: FiltroCliente }>;
  onSaveFilter: (nome: string, f: FiltroCliente) => void;
  onDeleteSaved: (nome: string) => void;
}

const labelCls =
  "block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1";
const selectCls =
  "h-9 w-full cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const inputCls =
  "h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { val: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(({ val, label: lbl }) => (
          <button
            key={val}
            onClick={() => onChange(value === val ? "" : val)}
            className={`cursor-pointer rounded-full border px-3 py-1 font-body text-xs font-semibold transition-colors ${
              value === val
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted" />
        <span className="font-body text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </div>
  );
}

export default function ClientesFiltroModal({
  open,
  onClose,
  filtros,
  onBuscar,
  onLimpar,
  savedFilters,
  onSaveFilter,
  onDeleteSaved,
}: Props) {
  const [local, setLocal] = useState<FiltroCliente>(filtros);
  const [saveNome, setSaveNome] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  if (!open) return null;

  function set<K extends keyof FiltroCliente>(key: K, val: FiltroCliente[K]) {
    setLocal((prev) => ({ ...prev, [key]: val }));
  }

  function handleBuscar() {
    onBuscar(local);
    onClose();
  }

  function handleLimpar() {
    setLocal(FILTRO_CLIENTE_INICIAL);
    onLimpar();
  }

  function handleSave() {
    if (!saveNome.trim()) return;
    onSaveFilter(saveNome.trim(), local);
    setSaveNome("");
    setShowSaveInput(false);
  }

  const count = countFiltrosCliente(local);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <SlidersIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-fg">
                Filtrar Clientes
              </h2>
              {count > 0 && (
                <p className="font-body text-xs text-primary">
                  {count} {count === 1 ? "filtro ativo" : "filtros ativos"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Saved filters */}
        {savedFilters.length > 0 && (
          <div className="border-b border-border bg-slate-50 px-6 py-3">
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Filtros salvos
            </p>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map((sf) => (
                <div key={sf.nome} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setLocal(sf.filtros);
                      onBuscar(sf.filtros);
                      onClose();
                    }}
                    className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    {sf.nome}
                  </button>
                  <button
                    onClick={() => onDeleteSaved(sf.nome)}
                    className="cursor-pointer text-muted hover:text-red-500"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Identificação */}
          <Section title="Tipo de pessoa" icon={UsersIcon}>
            <RadioGroup
              label=""
              options={[
                { val: "PF", label: "Pessoa Física (PF)" },
                { val: "PJ", label: "Pessoa Jurídica (PJ)" },
              ]}
              value={local.tipo}
              onChange={(v) => set("tipo", v as FiltroCliente["tipo"])}
            />
          </Section>

          {/* Status */}
          <Section title="Status" icon={CheckIcon}>
            <RadioGroup
              label=""
              options={[
                { val: "ativo", label: "Ativo" },
                { val: "inativo", label: "Inativo" },
              ]}
              value={local.status}
              onChange={(v) => set("status", v as FiltroCliente["status"])}
            />
          </Section>

          {/* Localização */}
          <Section title="Localização" icon={MapPinIcon}>
            <div>
              <label className={labelCls}>Estado (UF)</label>
              <select
                value={local.estado}
                onChange={(e) => set("estado", e.target.value)}
                className={selectCls}
              >
                <option value="">Todos os estados</option>
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </Section>

          {/* Processos */}
          <Section title="Processos" icon={FolderOpenIcon}>
            <RadioGroup
              label="Possui processos"
              options={[
                { val: "sim", label: "Com processos" },
                { val: "nao", label: "Sem processos" },
              ]}
              value={local.comProcessos}
              onChange={(v) =>
                set("comProcessos", v as FiltroCliente["comProcessos"])
              }
            />
          </Section>

          {/* Origem */}
          <Section title="Origem e Identificação" icon={UsersIcon}>
            <div>
              <label className={labelCls}>Origem</label>
              <select
                value={local.origemTipo}
                onChange={(e) => set("origemTipo", e.target.value)}
                className={selectCls}
              >
                <option value="">Todas</option>
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>CPF / CNPJ</label>
              <input
                type="text"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={local.cpfCnpj}
                onChange={(e) => set("cpfCnpj", e.target.value)}
                className={inputCls}
              />
            </div>
          </Section>

          {/* Data de cadastro */}
          <Section title="Data de cadastro" icon={CalendarIcon}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>De</label>
                <input
                  type="date"
                  value={local.dataInicio}
                  onChange={(e) => set("dataInicio", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Até</label>
                <input
                  type="date"
                  value={local.dataFim}
                  onChange={(e) => set("dataFim", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-slate-50 px-6 py-4">
          {savedFilters.length < 10 && (
            <div className="mb-3">
              {showSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do filtro rápido…"
                    value={saveNome}
                    onChange={(e) => setSaveNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className={inputCls + " flex-1"}
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveNome.trim()}
                    className="cursor-pointer rounded-lg bg-primary px-3 font-body text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setShowSaveInput(false)}
                    className="cursor-pointer rounded-lg border border-border px-3 font-body text-sm text-muted"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="cursor-pointer font-body text-xs font-semibold text-primary hover:underline"
                >
                  + Salvar como filtro rápido
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleLimpar}
              className="cursor-pointer font-body text-sm font-semibold text-muted hover:text-red-500"
            >
              Limpar tudo
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
              >
                Cancelar
              </button>
              <button
                onClick={handleBuscar}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <SlidersIcon className="h-4 w-4" />
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
