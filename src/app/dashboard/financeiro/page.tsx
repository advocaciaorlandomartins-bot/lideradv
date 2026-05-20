import Link from "next/link";
import { getAllLancamentos, getLancamentoKpis } from "@/lib/lancamentos-db";
import { getAllRemuneracoes, getRemuneracaoKpis } from "@/lib/remuneracoes-db";
import FinanceiroContent from "@/components/dashboard/financeiro/financeiro-content";
import RemuneracoesContent from "@/components/dashboard/remuneracoes/remuneracoes-content";
import { BanknotesIcon, CurrencyIcon } from "@/components/icons";

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

  const [lancamentos, lancamentoKpis] = await Promise.all([
    getAllLancamentos(),
    getLancamentoKpis(),
  ]);

  const [remuneracoes, remuneracaoKpis] = isRemuneracoes
    ? await Promise.all([getAllRemuneracoes(), getRemuneracaoKpis()])
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
        <Link
          href="/dashboard/financeiro"
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
            !isRemuneracoes
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
      </div>

      {/* Content */}
      {isRemuneracoes ? (
        <RemuneracoesContent
          remuneracoes={remuneracoes!}
          kpis={remuneracaoKpis!}
        />
      ) : (
        <FinanceiroContent lancamentos={lancamentos} kpis={lancamentoKpis} />
      )}
    </div>
  );
}
