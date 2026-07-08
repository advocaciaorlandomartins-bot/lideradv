import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getMeuFinanceiroDados } from "@/lib/lancamentos-db";
import MeuFinanceiroContent from "@/components/dashboard/financeiro/meu-financeiro-content";

export const metadata = {
  title: "Meu Financeiro — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function MeuFinanceiroPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "meu_financeiro", "ver")) redirect("/dashboard");

  const dados = await getMeuFinanceiroDados();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Meu Financeiro
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Sua visão pessoal de honorários, receitas e despesas
        </p>
      </div>
      <MeuFinanceiroContent dados={dados} />
    </div>
  );
}
