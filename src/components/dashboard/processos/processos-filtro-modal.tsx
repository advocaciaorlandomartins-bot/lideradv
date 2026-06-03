"use client";

import { useState } from "react";
import {
  XMarkIcon,
  SlidersIcon,
  CheckIcon,
  GlobeAltIcon,
  UsersIcon,
  TagsIcon,
  CalendarIcon,
  UploadIcon,
  IdentificationIcon,
  ClipboardCheckIcon,
} from "@/components/icons";

const AREAS = [
  "Cível",
  "Criminal",
  "Trabalhista",
  "Família",
  "Previdenciário",
  "Tributário",
  "Administrativo",
  "Consumidor",
  "Imobiliário",
  "Empresarial",
  "Outro",
];

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

const JUSTICAS = [
  "Justiça dos Estados",
  "Justiça Federal",
  "Justiça do Trabalho",
  "Justiça Eleitoral",
  "Justiça Militar Estadual",
  "Justiça Militar da União",
  "Superior Tribunal de Justiça",
  "Supremo Tribunal Federal",
  "Tribunal Superior do Trabalho",
];

const INSTANCIAS = [
  "1ª Instância",
  "2ª Instância",
  "3ª Instância",
  "Turma Recursal",
  "STJ",
  "STF",
  "TST",
];

const TIPO_DATA_OPTIONS = [
  { value: "DATA_DA_CITACAO", label: "Data da citação" },
  { value: "DATA_DE_DISTRIBUICAO", label: "Data de distribuição" },
  { value: "DATA_DO_PROTOCOLO", label: "Data do protocolo" },
  { value: "DATA_DA_AUDIENCIA", label: "Data da audiência" },
  { value: "DATA_DO_JULGAMENTO", label: "Data do julgamento" },
  { value: "DATA_DO_RECURSO", label: "Data do recurso" },
];

const SITUACOES = [
  "Em curso",
  "Suspenso",
  "Sobrestado",
  "Arquivado",
  "Extinto sem resolução",
  "Transitado em julgado",
];

const RESULTADOS = [
  "Procedente",
  "Parcialmente procedente",
  "Improcedente",
  "Acordo",
  "Extinção sem julgamento",
  "Desistência",
  "Procedente em parte",
];

const MARCADORES_OPCOES = [
  "Urgente",
  "Monitorado",
  "Audiência marcada",
  "Aguardando sentença",
  "Recurso pendente",
  "Cliente VIP",
  "Em execução",
  "Acordo em negociação",
];

export interface FiltroAvancado {
  exibir: "habilitados" | "desabilitados";
  souResponsavel: boolean;
  estouEnvolvido: boolean;
  tipoProcesso: "" | "judicial" | "extrajudicial";
  monitoramento: "" | "habilitado" | "desabilitado";
  estado: string;
  justica: string;
  orgao: string;
  area: string;
  assunto: string;
  numeroProcesso: string;
  identificador: string;
  instancia: string;
  marcadores: string[];
  situacao: string;
  tipoData: string;
  dataInicio: string;
  dataFim: string;
  numeroOab: string;
  pastaFisica: string;
  resultado: string;
  cpfCnpj: string;
  valorAcaoMin: string;
  valorAcaoMax: string;
  sistema: string;
  carteira: string;
  nomeGrupo: string;
}

export const FILTRO_INICIAL: FiltroAvancado = {
  exibir: "habilitados",
  souResponsavel: false,
  estouEnvolvido: false,
  tipoProcesso: "",
  monitoramento: "",
  estado: "",
  justica: "",
  orgao: "",
  area: "",
  assunto: "",
  numeroProcesso: "",
  identificador: "",
  instancia: "",
  marcadores: [],
  situacao: "",
  tipoData: "DATA_DA_CITACAO",
  dataInicio: "",
  dataFim: "",
  numeroOab: "",
  pastaFisica: "",
  resultado: "",
  cpfCnpj: "",
  valorAcaoMin: "",
  valorAcaoMax: "",
  sistema: "",
  carteira: "",
  nomeGrupo: "",
};

export function countFiltrosAtivos(f: FiltroAvancado): number {
  return Object.entries(f).filter(([k, v]) => {
    if (k === "exibir" && v === "habilitados") return false;
    if (k === "tipoData" && v === "DATA_DA_CITACAO") return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== "" && v !== false;
  }).length;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filtros: FiltroAvancado;
  onBuscar: (f: FiltroAvancado) => void;
  onLimpar: () => void;
  savedFilters: Array<{ nome: string; filtros: FiltroAvancado }>;
  onSaveFilter: (nome: string, f: FiltroAvancado) => void;
  onLoadFilter: (f: FiltroAvancado) => void;
  onDeleteSavedFilter: (nome: string) => void;
}

const labelCls =
  "block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1";
const inputCls =
  "h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const selectCls =
  "h-9 w-full cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

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

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <div
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
          checked ? "border-primary bg-primary" : "border-border bg-white"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && <CheckIcon className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="font-body text-sm text-fg">{label}</span>
    </label>
  );
}

export default function ProcessosFiltroModal({
  open,
  onClose,
  filtros,
  onBuscar,
  onLimpar,
  savedFilters,
  onSaveFilter,
  onLoadFilter,
  onDeleteSavedFilter,
}: Props) {
  const [local, setLocal] = useState<FiltroAvancado>(filtros);
  const [saveNome, setSaveNome] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  if (!open) return null;

  function set<K extends keyof FiltroAvancado>(key: K, val: FiltroAvancado[K]) {
    setLocal((prev) => ({ ...prev, [key]: val }));
  }

  function toggleMarcador(m: string) {
    setLocal((prev) => ({
      ...prev,
      marcadores: prev.marcadores.includes(m)
        ? prev.marcadores.filter((x) => x !== m)
        : [...prev.marcadores, m],
    }));
  }

  function handleBuscar() {
    onBuscar(local);
    onClose();
  }

  function handleLimpar() {
    setLocal(FILTRO_INICIAL);
    onLimpar();
  }

  function handleSaveFilter() {
    if (!saveNome.trim()) return;
    onSaveFilter(saveNome.trim(), local);
    setSaveNome("");
    setShowSaveInput(false);
  }

  const count = countFiltrosAtivos(local);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <SlidersIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-fg">
                Filtros Avançados
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
                      onLoadFilter(sf.filtros);
                    }}
                    className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {sf.nome}
                  </button>
                  <button
                    onClick={() => onDeleteSavedFilter(sf.nome)}
                    className="cursor-pointer text-muted hover:text-red-500"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Geral */}
          <Section title="Geral" icon={ClipboardCheckIcon}>
            <div className="space-y-2">
              <div>
                <label className={labelCls}>Exibir</label>
                <div className="flex gap-4">
                  {(
                    [
                      { val: "habilitados", label: "Habilitados" },
                      { val: "desabilitados", label: "Desabilitados" },
                    ] as const
                  ).map(({ val, label }) => (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                          local.exibir === val
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                        onClick={() => set("exibir", val)}
                      >
                        {local.exibir === val && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-body text-sm text-fg">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Envolvimento</label>
                <div className="flex gap-6">
                  <CheckboxField
                    label="Sou responsável"
                    checked={local.souResponsavel}
                    onChange={(v) => set("souResponsavel", v)}
                  />
                  <CheckboxField
                    label="Estou envolvido"
                    checked={local.estouEnvolvido}
                    onChange={(v) => set("estouEnvolvido", v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select
                    value={local.tipoProcesso}
                    onChange={(e) =>
                      set(
                        "tipoProcesso",
                        e.target.value as FiltroAvancado["tipoProcesso"]
                      )
                    }
                    className={selectCls}
                  >
                    <option value="">Todos</option>
                    <option value="judicial">Judicial</option>
                    <option value="extrajudicial">Extrajudicial</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Monitoramento</label>
                  <select
                    value={local.monitoramento}
                    onChange={(e) =>
                      set(
                        "monitoramento",
                        e.target.value as FiltroAvancado["monitoramento"]
                      )
                    }
                    className={selectCls}
                  >
                    <option value="">Todos</option>
                    <option value="habilitado">Habilitado</option>
                    <option value="desabilitado">Desabilitado</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          {/* Processo */}
          <Section title="Processo" icon={IdentificationIcon}>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>Área</label>
                <select
                  value={local.area}
                  onChange={(e) => set("area", e.target.value)}
                  className={selectCls}
                >
                  <option value="">Todas as áreas</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Número do Processo</label>
                  <input
                    type="text"
                    placeholder="0000000-00.0000.0.00.0000"
                    value={local.numeroProcesso}
                    onChange={(e) => set("numeroProcesso", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Identificador / Pasta</label>
                  <input
                    type="text"
                    placeholder="Código interno…"
                    value={local.identificador}
                    onChange={(e) => set("identificador", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Assunto</label>
                  <input
                    type="text"
                    placeholder="Ex: Pensão por morte…"
                    value={local.assunto}
                    onChange={(e) => set("assunto", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Pasta física</label>
                  <input
                    type="text"
                    placeholder="Localização física…"
                    value={local.pastaFisica}
                    onChange={(e) => set("pastaFisica", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Situação</label>
                  <select
                    value={local.situacao}
                    onChange={(e) => set("situacao", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Selecione…</option>
                    {SITUACOES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Resultado</label>
                  <select
                    value={local.resultado}
                    onChange={(e) => set("resultado", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Selecione…</option>
                    {RESULTADOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          {/* Localização judicial */}
          <Section title="Localização Judicial" icon={GlobeAltIcon}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Estado</label>
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
              <div>
                <label className={labelCls}>Instância</label>
                <select
                  value={local.instancia}
                  onChange={(e) => set("instancia", e.target.value)}
                  className={selectCls}
                >
                  <option value="">Todas</option>
                  {INSTANCIAS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Justiça</label>
              <select
                value={local.justica}
                onChange={(e) => set("justica", e.target.value)}
                className={selectCls}
              >
                <option value="">Todas</option>
                {JUSTICAS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Órgão</label>
              <input
                type="text"
                placeholder="Nome, sigla, cidade ou estado…"
                value={local.orgao}
                onChange={(e) => set("orgao", e.target.value)}
                className={inputCls}
              />
            </div>
          </Section>

          {/* Envolvidos */}
          <Section title="Envolvidos e Responsáveis" icon={UsersIcon}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>CPF/CNPJ do Cliente</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={local.cpfCnpj}
                  onChange={(e) => set("cpfCnpj", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Número OAB</label>
                <input
                  type="text"
                  placeholder="OAB/SP 000000"
                  value={local.numeroOab}
                  onChange={(e) => set("numeroOab", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sistema</label>
                <input
                  type="text"
                  placeholder="Ex: PJe, e-SAJ…"
                  value={local.sistema}
                  onChange={(e) => set("sistema", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Carteira</label>
                <input
                  type="text"
                  placeholder="Nome da carteira…"
                  value={local.carteira}
                  onChange={(e) => set("carteira", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Nome do grupo</label>
              <input
                type="text"
                placeholder="Grupo de trabalho…"
                value={local.nomeGrupo}
                onChange={(e) => set("nomeGrupo", e.target.value)}
                className={inputCls}
              />
            </div>
          </Section>

          {/* Data e valor */}
          <Section title="Data e Valor" icon={CalendarIcon}>
            <div>
              <label className={labelCls}>Filtrar pela data</label>
              <select
                value={local.tipoData}
                onChange={(e) => set("tipoData", e.target.value)}
                className={selectCls}
              >
                {TIPO_DATA_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data início</label>
                <input
                  type="date"
                  value={local.dataInicio}
                  onChange={(e) => set("dataInicio", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data fim</label>
                <input
                  type="date"
                  value={local.dataFim}
                  onChange={(e) => set("dataFim", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Valor da ação</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Mínimo (R$)"
                  value={local.valorAcaoMin}
                  onChange={(e) => set("valorAcaoMin", e.target.value)}
                  className={inputCls}
                />
                <input
                  type="number"
                  placeholder="Máximo (R$)"
                  value={local.valorAcaoMax}
                  onChange={(e) => set("valorAcaoMax", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </Section>

          {/* Marcadores */}
          <Section title="Marcadores" icon={TagsIcon}>
            <div className="flex flex-wrap gap-2">
              {MARCADORES_OPCOES.map((m) => {
                const sel = local.marcadores.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMarcador(m)}
                    className={`cursor-pointer rounded-full border px-3 py-1 font-body text-xs font-semibold transition-colors ${
                      sel
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Upload planilha */}
          <Section title="Filtrar via planilha" icon={UploadIcon}>
            <div className="rounded-xl border-2 border-dashed border-border bg-slate-50 px-4 py-6 text-center">
              <UploadIcon className="mx-auto mb-2 h-8 w-8 text-muted" />
              <p className="font-body text-sm font-semibold text-fg">
                Arraste um arquivo .XLSX ou clique para selecionar
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                Máximo 3.000 processos por planilha
              </p>
              <input type="file" accept=".xlsx,.xls" className="hidden" />
              <button className="mt-3 cursor-pointer rounded-lg border border-border bg-white px-4 py-1.5 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary">
                Selecionar arquivo
              </button>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-slate-50 px-6 py-4">
          {/* Save filter */}
          {savedFilters.length < 10 && (
            <div className="mb-3">
              {showSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do filtro rápido…"
                    value={saveNome}
                    onChange={(e) => setSaveNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveFilter()}
                    className={inputCls + " flex-1"}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveFilter}
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
                  {savedFilters.length > 0 && ` (${savedFilters.length}/10)`}
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
