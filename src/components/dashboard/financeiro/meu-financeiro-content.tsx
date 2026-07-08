"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  LancamentoPessoal,
  ProcessoHonorario,
  EscritorioMes,
  FluxoMensalItem,
} from "@/lib/meu-financeiro-db";
import {
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CurrencyIcon,
  TrendUpIcon,
  TrendDownIcon,
  CheckCircleIcon,
} from "@/components/icons";

// ─── Constants ──────────────────────────────────────────────────────────────

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const CATEGORIAS_RECEITA = [
  { value: "freelance", label: "Freelance / Consultoria" },
  { value: "salario", label: "Salário / Pró-labore" },
  { value: "aluguel", label: "Aluguel / Imóvel" },
  { value: "investimento", label: "Investimento / Rendimento" },
  { value: "comissao", label: "Comissão" },
  { value: "bonus", label: "Bônus / Prêmio" },
  { value: "outros", label: "Outros" },
];

export const CATEGORIAS_DESPESA = [
  { value: "moradia", label: "Moradia" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "saude", label: "Saúde" },
  { value: "transporte", label: "Transporte" },
  { value: "educacao", label: "Educação" },
  { value: "lazer", label: "Lazer / Entretenimento" },
  { value: "vestuario", label: "Vestuário" },
  { value: "servicos", label: "Serviços (luz, água, internet)" },
  { value: "impostos", label: "Impostos / Taxas" },
  { value: "outros", label: "Outros" },
];

function getCatLabel(tipo: string, cat: string) {
  const lista = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  return lista.find((c) => c.value === cat)?.label ?? cat;
}

function getCatColor(tipo: string, cat: string): string {
  if (tipo === "receita") {
    const m: Record<string, string> = {
      freelance: "bg-emerald-100 text-emerald-700",
      salario: "bg-green-100 text-green-700",
      aluguel: "bg-teal-100 text-teal-700",
      investimento: "bg-cyan-100 text-cyan-700",
      comissao: "bg-blue-100 text-blue-700",
      bonus: "bg-purple-100 text-purple-700",
      outros: "bg-slate-100 text-slate-600",
    };
    return m[cat] ?? "bg-slate-100 text-slate-600";
  }
  const m: Record<string, string> = {
    moradia: "bg-red-100 text-red-700",
    alimentacao: "bg-orange-100 text-orange-700",
    saude: "bg-pink-100 text-pink-700",
    transporte: "bg-amber-100 text-amber-700",
    educacao: "bg-violet-100 text-violet-700",
    lazer: "bg-sky-100 text-sky-700",
    vestuario: "bg-indigo-100 text-indigo-700",
    servicos: "bg-yellow-100 text-yellow-800",
    impostos: "bg-slate-100 text-slate-600",
    outros: "bg-gray-100 text-gray-600",
  };
  return m[cat] ?? "bg-gray-100 text-gray-600";
}

function getCatBarColor(cat: string): string {
  const m: Record<string, string> = {
    moradia: "#ef4444",
    alimentacao: "#f97316",
    saude: "#ec4899",
    transporte: "#f59e0b",
    educacao: "#8b5cf6",
    lazer: "#0ea5e9",
    vestuario: "#6366f1",
    servicos: "#eab308",
    impostos: "#64748b",
    outros: "#9ca3af",
  };
  return m[cat] ?? "#9ca3af";
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Form helpers ────────────────────────────────────────────────────────────

function formInicial(tipo: "receita" | "despesa", mesAtivo: string) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, "0");
  const [y, m] = mesAtivo.split("-");
  return {
    tipo,
    categoria: "",
    categoriaCustom: "",
    descricao: "",
    valor: "",
    data: `${y}-${m}-${dia}`,
    status: tipo === "receita" ? "a_receber" : "pendente",
    recorrente: false,
    periodicidade: "mensal",
  };
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  sub,
  value,
  color,
  icon: Icon,
  negative,
}: {
  label: string;
  sub: string;
  value: string;
  color: "blue" | "emerald" | "red" | "amber" | "teal";
  icon: React.ComponentType<{ className?: string }>;
  negative?: boolean;
}) {
  const ring: Record<string, string> = {
    blue: "ring-blue-200    bg-blue-50    text-blue-600",
    emerald: "ring-emerald-200 bg-emerald-50 text-emerald-600",
    red: "ring-red-200     bg-red-50     text-red-600",
    amber: "ring-amber-200   bg-amber-50   text-amber-600",
    teal: "ring-teal-200    bg-teal-50    text-teal-600",
  };
  const valColor: Record<string, string> = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    red: "text-red-700",
    amber: "text-amber-700",
    teal: "text-teal-700",
  };
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${ring[color]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={`font-heading text-lg font-bold tabular-nums ${negative ? "text-red-600" : valColor[color]}`}
      >
        {value}
      </p>
      <p className="mt-0.5 font-body text-[11px] text-muted">{sub}</p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  lancamentos: LancamentoPessoal[];
  honorariosEscritorio: number;
  processosHonorarios: ProcessoHonorario[];
  escritorioMes: EscritorioMes;
  fluxoEscritorio: FluxoMensalItem[];
}

type FiltroTipo = "todos" | "receita" | "despesa";

export default function MeuFinanceiroContent({
  lancamentos: inicial,
  honorariosEscritorio,
  processosHonorarios,
  escritorioMes,
  fluxoEscritorio,
}: Props) {
  const hoje = new Date();
  const mesHojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const [lancamentos, setLancamentos] = useState(inicial);
  const [mesAtivo, setMesAtivo] = useState(mesHojeISO);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<LancamentoPessoal | null>(null);
  const [form, setForm] = useState(formInicial("receita", mesHojeISO));
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [honorariosExpanded, setHorariosExpanded] = useState(false);

  // ── Derived ──
  const doMes = useMemo(
    () => lancamentos.filter((l) => l.data.startsWith(mesAtivo)),
    [lancamentos, mesAtivo]
  );

  const receitasMes = useMemo(
    () =>
      doMes
        .filter((l) => l.tipo === "receita")
        .reduce((s, l) => s + l.valor, 0),
    [doMes]
  );
  const despesasMes = useMemo(
    () =>
      doMes
        .filter((l) => l.tipo === "despesa")
        .reduce((s, l) => s + l.valor, 0),
    [doMes]
  );
  const saldoMes = receitasMes - despesasMes;
  const pendentesMes = useMemo(
    () =>
      doMes
        .filter((l) => l.tipo === "receita" && l.status === "a_receber")
        .reduce((s, l) => s + l.valor, 0),
    [doMes]
  );

  const listagem = useMemo(() => {
    const q = busca.toLowerCase();
    return doMes
      .filter((l) => {
        if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
        if (
          q &&
          !l.descricao.toLowerCase().includes(q) &&
          !getCatLabel(l.tipo, l.categoria).toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.data.localeCompare(a.data) ||
          b.created_at.localeCompare(a.created_at)
      );
  }, [doMes, filtroTipo, busca]);

  // 6 meses: 3 antes + atual + 2 à frente
  const fluxoData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 3 + i, 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const doI = lancamentos.filter((l) => l.data.startsWith(iso));
      return {
        iso,
        label: `${MESES_CURTO[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        Receitas: doI
          .filter((l) => l.tipo === "receita")
          .reduce((s, l) => s + l.valor, 0),
        Despesas: doI
          .filter((l) => l.tipo === "despesa")
          .reduce((s, l) => s + l.valor, 0),
      };
    });
  }, [lancamentos]);

  const categoriasData = useMemo(() => {
    const map = new Map<string, number>();
    doMes
      .filter((l) => l.tipo === "despesa")
      .forEach((l) =>
        map.set(l.categoria, (map.get(l.categoria) ?? 0) + l.valor)
      );
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([cat, total]) => ({
        cat,
        label: getCatLabel("despesa", cat),
        total,
      }));
  }, [doMes]);

  // Categorias customizadas usadas pelo usuário (extraídas dos lançamentos)
  const categoriasCustomReceita = useMemo(() => {
    const predefinidas = new Set(CATEGORIAS_RECEITA.map((c) => c.value));
    const custom = new Set<string>();
    lancamentos
      .filter((l) => l.tipo === "receita" && !predefinidas.has(l.categoria))
      .forEach((l) => custom.add(l.categoria));
    return Array.from(custom).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lancamentos]);

  const categoriasCustomDespesa = useMemo(() => {
    const predefinidas = new Set(CATEGORIAS_DESPESA.map((c) => c.value));
    const custom = new Set<string>();
    lancamentos
      .filter((l) => l.tipo === "despesa" && !predefinidas.has(l.categoria))
      .forEach((l) => custom.add(l.categoria));
    return Array.from(custom).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lancamentos]);

  // ── Helpers ──
  function navMes(delta: number) {
    const [y, m] = mesAtivo.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesAtivo(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const mesLabel = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return `${MESES_PT[m - 1]} ${y}`;
  };

  function abrirModal(tipo: "receita" | "despesa", item?: LancamentoPessoal) {
    setErro("");
    if (item) {
      setEditando(item);
      setForm({
        tipo: item.tipo,
        categoria: item.categoria,
        categoriaCustom: "",
        descricao: item.descricao,
        valor: String(item.valor),
        data: item.data,
        status: item.status,
        recorrente: item.recorrente,
        periodicidade: item.periodicidade ?? "mensal",
      });
    } else {
      setEditando(null);
      setForm(formInicial(tipo, mesAtivo));
    }
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditando(null);
    setErro("");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setField(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function salvar() {
    if (!form.descricao.trim()) {
      setErro("Informe a descrição.");
      return;
    }

    const catFinal =
      form.categoria === "nova_categoria"
        ? form.categoriaCustom.trim()
        : form.categoria;

    if (!catFinal) {
      setErro(
        form.categoria === "nova_categoria"
          ? "Digite o nome da nova categoria."
          : "Selecione a categoria."
      );
      return;
    }

    const parsed = parseFloat(String(form.valor).replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setErro("Informe um valor válido.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const body = {
        tipo: form.tipo,
        categoria: catFinal,
        descricao: form.descricao.trim(),
        valor: parsed,
        data: form.data,
        status: form.status,
        recorrente: form.recorrente,
        periodicidade: form.recorrente ? form.periodicidade : null,
      };

      let resp: Response;
      if (editando) {
        resp = await fetch(`/api/meu-financeiro/lancamentos/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        resp = await fetch("/api/meu-financeiro/lancamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Erro ao salvar");

      setLancamentos((prev) =>
        editando
          ? prev.map((l) => (l.id === editando.id ? data : l))
          : [data, ...prev]
      );
      fecharModal();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function deletar(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    setDeletando(id);
    try {
      await fetch(`/api/meu-financeiro/lancamentos/${id}`, {
        method: "DELETE",
      });
      setLancamentos((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletando(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Month nav + action buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navMes(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center font-heading text-base font-semibold text-fg">
            {mesLabel(mesAtivo)}
          </span>
          <button
            onClick={() => navMes(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          {mesAtivo !== mesHojeISO && (
            <button
              onClick={() => setMesAtivo(mesHojeISO)}
              className="rounded-lg border border-border px-2.5 py-1 font-body text-xs text-muted hover:text-fg"
            >
              Hoje
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => abrirModal("receita")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <PlusIcon className="h-4 w-4" /> Nova Receita
          </button>
          <button
            onClick={() => abrirModal("despesa")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <PlusIcon className="h-4 w-4" /> Nova Despesa
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Escritório"
          sub="Honorários estimados"
          value={fmt(honorariosEscritorio)}
          color="blue"
          icon={BanknotesIcon}
        />
        <KpiCard
          label="Receitas"
          sub={`Pessoais — ${mesLabel(mesAtivo)}`}
          value={fmt(receitasMes)}
          color="emerald"
          icon={TrendUpIcon}
        />
        <KpiCard
          label="Despesas"
          sub={`Pessoais — ${mesLabel(mesAtivo)}`}
          value={fmt(despesasMes)}
          color="red"
          icon={TrendDownIcon}
        />
        <KpiCard
          label="Saldo"
          sub="Receitas − Despesas"
          value={fmt(Math.abs(saldoMes))}
          color={saldoMes >= 0 ? "teal" : "red"}
          icon={CurrencyIcon}
          negative={saldoMes < 0}
        />
        <KpiCard
          label="A Receber"
          sub="Receitas ainda pendentes"
          value={fmt(pendentesMes)}
          color="amber"
          icon={CheckCircleIcon}
        />
      </div>

      {/* ── Escritório — Honorários ── */}
      <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex flex-1 items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 ring-1 ring-blue-200">
              <BuildingOfficeIcon className="h-3.5 w-3.5 text-blue-600" />
            </span>
            <span className="font-heading text-sm font-semibold text-blue-900">
              Meus Honorários e Remunerações
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-body text-[10px] font-semibold text-blue-500">
              dados do escritório · somente leitura
            </span>
          </div>
          <button
            onClick={() => setHorariosExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 font-body text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {honorariosExpanded
              ? "Ocultar detalhes"
              : "Ver processos e previsão"}
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ${honorariosExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Mini KPIs */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
          <div className="rounded-lg border border-blue-100 bg-white px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              Honorários — meus processos
            </p>
            <p className="mt-0.5 font-heading text-base font-bold tabular-nums text-blue-700">
              {fmt(honorariosEscritorio)}
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-white px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              Remuneração — a receber {MESES_CURTO[new Date().getMonth()]}
            </p>
            <p className="mt-0.5 font-heading text-base font-bold tabular-nums text-amber-600">
              {fmt(escritorioMes.aReceberMes)}
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-white px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              Remuneração — recebido {MESES_CURTO[new Date().getMonth()]}
            </p>
            <p className="mt-0.5 font-heading text-base font-bold tabular-nums text-emerald-600">
              {fmt(escritorioMes.recebidoMes)}
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-white px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              Total pendente do escritório
            </p>
            <p className="mt-0.5 font-heading text-base font-bold tabular-nums text-slate-700">
              {fmt(escritorioMes.totalAReceber)}
            </p>
          </div>
        </div>

        {/* Expanded content */}
        {honorariosExpanded && (
          <div className="space-y-5 border-t border-blue-100 px-4 py-4">
            {/* Tabela de processos */}
            <div>
              <h4 className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-blue-700">
                Processos ativos com honorários
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 font-body text-[10px] font-semibold text-blue-500">
                  {processosHonorarios.length}
                </span>
              </h4>
              {processosHonorarios.length === 0 ? (
                <p className="py-6 text-center font-body text-sm text-muted">
                  Nenhum processo ativo com honorários definidos.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-blue-100">
                  <table className="w-full min-w-[520px]">
                    <thead className="bg-blue-50/60">
                      <tr>
                        <th className="px-3 py-2 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                          Cliente
                        </th>
                        <th className="px-3 py-2 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                          Tipo de ação
                        </th>
                        <th className="px-3 py-2 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                          Modelo
                        </th>
                        <th className="px-3 py-2 text-right font-body text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                          Estimado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50 bg-white">
                      {processosHonorarios.map((p) => (
                        <tr
                          key={p.id}
                          className="transition-colors hover:bg-blue-50/40"
                        >
                          <td className="px-3 py-2.5 font-body text-sm font-semibold text-fg">
                            {p.client_name}
                          </td>
                          <td className="px-3 py-2.5 font-body text-xs text-muted">
                            {p.tipo_acao}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-body text-[10px] font-semibold text-blue-700">
                              {p.modelo_honorario === "fixo"
                                ? "Fixo"
                                : p.modelo_honorario === "percentual" &&
                                    p.percentual_honorario != null
                                  ? `${p.percentual_honorario}% s/ causa`
                                  : (p.modelo_honorario ?? "–")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-heading text-sm font-bold tabular-nums text-blue-700">
                            {fmt(p.honorario_estimado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-blue-50/60">
                      <tr className="border-t border-blue-200">
                        <td
                          colSpan={3}
                          className="px-3 py-2.5 font-body text-xs font-semibold text-blue-600"
                        >
                          Total estimado ({processosHonorarios.length} processo
                          {processosHonorarios.length !== 1 ? "s" : ""})
                        </td>
                        <td className="px-3 py-2.5 text-right font-heading text-sm font-bold tabular-nums text-blue-800">
                          {fmt(honorariosEscritorio)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Previsão mensal de entradas */}
            <div>
              <h4 className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-blue-700">
                Minhas remunerações previstas — próximos 6 meses
              </h4>
              {fluxoEscritorio.every((f) => f.entradas === 0) ? (
                <p className="py-4 text-center font-body text-sm text-muted">
                  Nenhuma remuneração pendente agendada nos próximos meses.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {fluxoEscritorio.map((f) => {
                    const isCurrent =
                      f.mesISO ===
                      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                    return (
                      <div
                        key={f.mesISO}
                        className={`flex flex-col items-center rounded-lg border px-2 py-3 transition-colors ${
                          isCurrent
                            ? "border-blue-300 bg-blue-100/60"
                            : "border-blue-100 bg-white"
                        }`}
                      >
                        <span
                          className={`font-body text-[10px] font-semibold uppercase ${isCurrent ? "text-blue-600" : "text-blue-400"}`}
                        >
                          {f.mes}
                          {isCurrent && (
                            <span className="ml-1 rounded-full bg-blue-500 px-1 py-0.5 text-[9px] text-white">
                              atual
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-1 font-heading text-sm font-bold tabular-nums ${f.entradas > 0 ? "text-blue-700" : "text-slate-300"}`}
                        >
                          {f.entradas > 0 ? fmt(f.entradas) : "–"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Fluxo 6 meses */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-fg">
              Fluxo mensal (6 meses)
            </h3>
            <div className="flex gap-3 font-body text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
                Receitas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Despesas
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fluxoData} barGap={3} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) =>
                  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                }
              />
              <Tooltip
                formatter={(v) => fmt(Number(v))}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Bar dataKey="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categorias despesas */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-heading text-sm font-semibold text-fg">
            Despesas por categoria — {mesLabel(mesAtivo)}
          </h3>
          {categoriasData.length === 0 ? (
            <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-center">
              <BanknotesIcon className="h-8 w-8 text-slate-300" />
              <p className="font-body text-sm text-muted">
                Sem despesas neste mês
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {categoriasData.map(({ cat, label, total }) => {
                const pct = despesasMes > 0 ? (total / despesasMes) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between">
                      <span className="font-body text-xs text-muted">
                        {label}
                      </span>
                      <span className="font-heading text-xs font-semibold text-fg">
                        {fmt(total)}
                        <span className="ml-1 font-normal text-muted">
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: getCatBarColor(cat),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction list ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        {/* List toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-0.5 rounded-lg border border-border bg-slate-50 p-0.5">
            {(["todos", "receita", "despesa"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`rounded-md px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
                  filtroTipo === t
                    ? "bg-white text-fg shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {t === "todos"
                  ? "Todos"
                  : t === "receita"
                    ? "Receitas"
                    : "Despesas"}
                {t !== "todos" && (
                  <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {doMes.filter((l) => l.tipo === t).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar lançamento..."
              className="h-8 w-full rounded-lg border border-border pl-8 pr-3 font-body text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary sm:w-52"
            />
          </div>
        </div>

        {/* Empty state */}
        {listagem.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <BanknotesIcon className="h-10 w-10 text-slate-200" />
            <div>
              <p className="font-body text-sm font-semibold text-fg">
                Nenhum lançamento em {mesLabel(mesAtivo)}
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                Use os botões acima para registrar suas receitas e despesas
                pessoais.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {listagem.map((l) => {
              const isRec = l.tipo === "receita";
              const isPago = l.status === "recebido" || l.status === "pago";
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                >
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${isRec ? "bg-emerald-500" : "bg-red-500"}`}
                  />

                  <span
                    className={`hidden flex-shrink-0 rounded-md px-2 py-0.5 font-body text-[11px] font-semibold sm:inline-block ${getCatColor(l.tipo, l.categoria)}`}
                  >
                    {getCatLabel(l.tipo, l.categoria)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm text-fg">
                      {l.descricao}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-body text-[11px] text-muted">
                        {new Date(l.data + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "short",
                          }
                        )}
                      </p>
                      {l.recorrente && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-body text-[10px] text-muted">
                          {l.periodicidade ?? "recorrente"}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`hidden flex-shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-semibold sm:inline-block ${isPago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {l.status === "recebido"
                      ? "Recebido"
                      : l.status === "pago"
                        ? "Pago"
                        : l.status === "a_receber"
                          ? "A receber"
                          : "Pendente"}
                  </span>

                  <span
                    className={`flex-shrink-0 font-heading text-sm font-bold tabular-nums ${isRec ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {isRec ? "+" : "−"}&nbsp;{fmt(l.valor)}
                  </span>

                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => abrirModal(l.tipo, l)}
                      title="Editar"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-200 hover:text-fg"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => deletar(l.id)}
                      disabled={deletando === l.id}
                      title="Excluir"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer totals */}
        {listagem.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border bg-slate-50 px-4 py-2.5 text-xs">
            <span className="font-body text-muted">
              {listagem.length} lançamento{listagem.length !== 1 ? "s" : ""}
            </span>
            {(filtroTipo === "todos" || filtroTipo === "receita") && (
              <span className="font-heading font-semibold text-emerald-600">
                Receitas:{" "}
                {fmt(
                  listagem
                    .filter((l) => l.tipo === "receita")
                    .reduce((s, l) => s + l.valor, 0)
                )}
              </span>
            )}
            {(filtroTipo === "todos" || filtroTipo === "despesa") && (
              <span className="font-heading font-semibold text-red-600">
                Despesas:{" "}
                {fmt(
                  listagem
                    .filter((l) => l.tipo === "despesa")
                    .reduce((s, l) => s + l.valor, 0)
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={fecharModal}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold text-fg">
                  {editando
                    ? "Editar lançamento"
                    : form.tipo === "receita"
                      ? "Nova Receita Pessoal"
                      : "Nova Despesa Pessoal"}
                </h2>
                <button
                  onClick={fecharModal}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-fg"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Tipo toggle (somente no cadastro) */}
              {!editando && (
                <div className="mb-4 flex gap-0.5 rounded-xl border border-border bg-slate-50 p-0.5">
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tipo: "receita",
                        categoria: "",
                        categoriaCustom: "",
                        status: "a_receber",
                      }))
                    }
                    className={`flex-1 rounded-lg py-2 font-body text-sm font-semibold transition-colors ${
                      form.tipo === "receita"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Receita
                  </button>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tipo: "despesa",
                        categoria: "",
                        categoriaCustom: "",
                        status: "pendente",
                      }))
                    }
                    className={`flex-1 rounded-lg py-2 font-body text-sm font-semibold transition-colors ${
                      form.tipo === "despesa"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Despesa
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block font-body text-xs font-semibold text-muted">
                    Categoria *
                  </label>
                  <select
                    value={form.categoria}
                    onChange={(e) => {
                      setField("categoria", e.target.value);
                      if (e.target.value !== "nova_categoria")
                        setField("categoriaCustom", "");
                    }}
                    className="h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Selecione a categoria...</option>
                    <optgroup label="Categorias padrão">
                      {(form.tipo === "receita"
                        ? CATEGORIAS_RECEITA
                        : CATEGORIAS_DESPESA
                      ).map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                    {(form.tipo === "receita"
                      ? categoriasCustomReceita
                      : categoriasCustomDespesa
                    ).length > 0 && (
                      <optgroup label="Minhas categorias">
                        {(form.tipo === "receita"
                          ? categoriasCustomReceita
                          : categoriasCustomDespesa
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="nova_categoria">＋ Nova categoria...</option>
                  </select>

                  {form.categoria === "nova_categoria" && (
                    <input
                      autoFocus
                      value={form.categoriaCustom}
                      onChange={(e) =>
                        setField("categoriaCustom", e.target.value)
                      }
                      placeholder={
                        form.tipo === "receita"
                          ? "Ex: Combustível, Honorário extra, Dividendo..."
                          : "Ex: Combustível, Academia, Veterinário..."
                      }
                      maxLength={80}
                      className="mt-2 h-9 w-full rounded-lg border border-primary px-3 font-body text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1 block font-body text-xs font-semibold text-muted">
                    Descrição *
                  </label>
                  <input
                    value={form.descricao}
                    onChange={(e) => setField("descricao", e.target.value)}
                    placeholder={
                      form.tipo === "receita"
                        ? "Ex: Consultoria empresa ABC, aluguel sala..."
                        : "Ex: Aluguel apartamento, conta de luz..."
                    }
                    className="h-9 w-full rounded-lg border border-border px-3 font-body text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-body text-xs font-semibold text-muted">
                      Valor (R$) *
                    </label>
                    <input
                      value={form.valor}
                      onChange={(e) => setField("valor", e.target.value)}
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      className="h-9 w-full rounded-lg border border-border px-3 font-body text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-body text-xs font-semibold text-muted">
                      Data *
                    </label>
                    <input
                      value={form.data}
                      onChange={(e) => setField("data", e.target.value)}
                      type="date"
                      className="h-9 w-full rounded-lg border border-border px-3 font-body text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-body text-xs font-semibold text-muted">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {form.tipo === "receita" ? (
                      <>
                        <option value="a_receber">A receber</option>
                        <option value="recebido">Recebido</option>
                      </>
                    ) : (
                      <>
                        <option value="pendente">Pendente / Em aberto</option>
                        <option value="pago">Pago</option>
                      </>
                    )}
                  </select>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-slate-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.recorrente}
                    onChange={(e) => setField("recorrente", e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border text-primary"
                  />
                  <div>
                    <span className="font-body text-sm font-semibold text-fg">
                      Lançamento recorrente
                    </span>
                    <p className="font-body text-[11px] text-muted">
                      Aluguel, assinaturas, salário, conta de luz...
                    </p>
                  </div>
                </label>

                {form.recorrente && (
                  <div>
                    <label className="mb-1 block font-body text-xs font-semibold text-muted">
                      Periodicidade
                    </label>
                    <select
                      value={form.periodicidade}
                      onChange={(e) =>
                        setField("periodicidade", e.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                )}

                {erro && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 font-body text-xs text-red-600">
                    {erro}
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={fecharModal}
                  className="flex-1 rounded-xl border border-border py-2.5 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className={`flex-1 rounded-xl py-2.5 font-body text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    form.tipo === "receita"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {salvando
                    ? "Salvando..."
                    : editando
                      ? "Salvar alterações"
                      : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
