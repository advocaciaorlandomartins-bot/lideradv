import Link from "next/link";
import {
  getAllLancamentos,
  getLancamentoKpis,
  getContasAReceber,
} from "@/lib/lancamentos-db";
import {
  getAllRemuneracoes,
  getRemuneracaoKpis,
  getContasAPagar,
} from "@/lib/remuneracoes-db";
import FinanceiroContent from "@/components/dashboard/financeiro/financeiro-content";
import RemuneracoesContent from "@/components/dashboard/remuneracoes/remuneracoes-content";
import ContasContent from "@/components/dashboard/financeiro/contas-content";
import {
  BanknotesIcon,
  CurrencyIcon,
  ClipboardListIcon,
  PlusIcon,
} from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Financeiro — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const isRemuneracoes = tab === "remuneracoes";
  const isContas = tab === "contas";

  const session = await getSession();
  const canEdit = !!session && hasPermission(session, "financeiro", "editar");

  const [lancamentos, lancamentoKpis] = await Promise.all([
    getAllLancamentos(),
    getLancamentoKpis(),
  ]);

  const [remuneracoes, remuneracaoKpis] = isRemuneracoes
    ? await Promise.all([getAllRemuneracoes(), getRemuneracaoKpis()])
    : [null, null];

  const [contasReceber, contasPagar] = isContas
    ? await Promise.all([getContasAReceber(), getContasAPagar()])
    : [null, null];

  const total = lancamentos.length;
  const pendentes = lancamentos.filter((l) => l.status === "pendente").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Financeiro
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} lançamentos · {pendentes} pendentes
        </p>
      </div>

      {/* Tabs + botões de cadastro completo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
          <Link
            href="/dashboard/financeiro"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
              !isRemuneracoes && !isContas
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <BanknotesIcon className="h-4 w-4" />
            Lançamentos
          </Link>
          <Link
            href="/dashboard/financeiro?tab=remuneracoes"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
              isRemuneracoes
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <CurrencyIcon className="h-4 w-4" />
            Remunerações
          </Link>
          <Link
            href="/dashboard/financeiro?tab=contas"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
              isContas
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <ClipboardListIcon className="h-4 w-4" />
            Contas
          </Link>
        </div>

        {canEdit && !isRemuneracoes && !isContas && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Content */}
      {isRemuneracoes ? (
        <RemuneracoesContent
          remuneracoes={remuneracoes!}
          kpis={remuneracaoKpis!}
        />
      ) : isContas ? (
        <ContasContent
          contasReceber={contasReceber!}
          contasPagar={contasPagar!}
        />
      ) : (
        <FinanceiroContent
          lancamentos={lancamentos}
          kpis={lancamentoKpis}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
