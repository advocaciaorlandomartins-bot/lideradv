import Link from "next/link";
import {
  getAllLancamentos,
  getLancamentoKpis,
  getContasAReceber,
  getMonthlyChart,
  getLancamentosSaida,
} from "@/lib/lancamentos-db";
import { getAllRemuneracoes, getRemuneracaoKpis } from "@/lib/remuneracoes-db";
import FinanceiroContent from "@/components/dashboard/financeiro/financeiro-content";
import RemuneracoesContent from "@/components/dashboard/remuneracoes/remuneracoes-content";
import ResumoContent from "@/components/dashboard/financeiro/resumo-content";
import ReceberContent from "@/components/dashboard/financeiro/receber-content";
import PagarContent from "@/components/dashboard/financeiro/pagar-content";
import {
  BanknotesIcon,
  CurrencyIcon,
  ClipboardListIcon,
  PlusIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Financeiro — LiderAdv",
};

export const dynamic = "force-dynamic";

type Tab = "resumo" | "receber" | "pagar" | "remuneracoes" | "historico";

function resolveTab(raw: string | undefined): Tab {
  if (
    raw === "receber" ||
    raw === "pagar" ||
    raw === "remuneracoes" ||
    raw === "historico"
  )
    return raw;
  return "resumo";
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cliente?: string }>;
}) {
  const { tab: rawTab, cliente: defaultCliente } = await searchParams;
  const tab = resolveTab(rawTab);

  const session = await getSession();
  const canEdit = !!session && hasPermission(session, "financeiro", "editar");

  // Carrega apenas os dados necessários para cada aba
  const [lancamentoKpis, remuneracaoKpis, chartData] =
    tab === "resumo"
      ? await Promise.all([
          getLancamentoKpis(),
          getRemuneracaoKpis(),
          getMonthlyChart(),
        ])
      : [null, null, []];

  const [remuneracoes, remKpis] =
    tab === "remuneracoes"
      ? await Promise.all([getAllRemuneracoes(), getRemuneracaoKpis()])
      : [null, null];

  const [allLancamentos, allKpis] =
    tab === "historico"
      ? await Promise.all([getAllLancamentos(), getLancamentoKpis()])
      : [null, null];

  const contasReceber = tab === "receber" ? await getContasAReceber() : null;
  const despesas = tab === "pagar" ? await getLancamentosSaida() : null;

  const tabDef: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "resumo",
      label: "Visão Geral",
      icon: <BanknotesIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "receber",
      label: "A Receber",
      icon: <TrendUpIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "pagar",
      label: "A Pagar",
      icon: <TrendDownIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "remuneracoes",
      label: "Remunerações",
      icon: <CurrencyIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "historico",
      label: "Histórico",
      icon: <ClipboardListIcon className="h-4 w-4 flex-shrink-0" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            Financeiro
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Gestão de receitas, despesas e folha de pagamento
          </p>
        </div>

        {/* Botões de ação — um por aba, sem duplicatas */}
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            {tab === "receber" && (
              <Link
                href="/dashboard/financeiro/novo?tipo=entrada"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
              >
                <PlusIcon className="h-4 w-4" />
                Nova Receita
              </Link>
            )}
            {tab === "pagar" && (
              <Link
                href="/dashboard/financeiro/novo?tipo=saida"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap"
              >
                <PlusIcon className="h-4 w-4" />
                Nova Despesa
              </Link>
            )}
            {tab === "remuneracoes" && (
              <Link
                href="/dashboard/remuneracoes/nova"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-purple-700 whitespace-nowrap"
              >
                <PlusIcon className="h-4 w-4" />
                Nova Remuneração
              </Link>
            )}
            {tab === "historico" && (
              <>
                <Link
                  href="/dashboard/financeiro/novo?tipo=entrada"
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
                >
                  <PlusIcon className="h-4 w-4" />
                  Nova Receita
                </Link>
                <Link
                  href="/dashboard/financeiro/novo?tipo=saida"
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap"
                >
                  <PlusIcon className="h-4 w-4" />
                  Nova Despesa
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
          {tabDef.map(({ key, label, icon }) => (
            <Link
              key={key}
              href={
                key === "resumo"
                  ? "/dashboard/financeiro"
                  : `/dashboard/financeiro?tab=${key}`
              }
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-sm font-semibold transition-colors duration-150 sm:gap-2 sm:px-4 sm:py-2 whitespace-nowrap ${
                tab === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {icon}
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "resumo" && (
        <ResumoContent
          lancamentoKpis={lancamentoKpis!}
          remuneracaoKpis={remuneracaoKpis!}
          chartData={chartData}
        />
      )}
      {tab === "receber" && (
        <ReceberContent
          contasReceber={contasReceber!}
          defaultCliente={defaultCliente}
        />
      )}
      {tab === "pagar" && (
        <PagarContent despesas={despesas!} canEdit={canEdit} />
      )}
      {tab === "remuneracoes" && (
        <RemuneracoesContent remuneracoes={remuneracoes!} kpis={remKpis!} />
      )}
      {tab === "historico" && (
        <FinanceiroContent
          lancamentos={allLancamentos!}
          kpis={allKpis!}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
