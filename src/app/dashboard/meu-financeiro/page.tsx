import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getMeuFinanceiroInitial } from "@/lib/meu-financeiro-db";
import MeuFinanceiroContent from "@/components/dashboard/financeiro/meu-financeiro-content";

export const metadata = {
  title: "Meu Financeiro — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function MeuFinanceiroPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "meu_financeiro", "ver")) redirect("/dashboard");

  const dados = await getMeuFinanceiroInitial(session.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Meu Financeiro
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Controle financeiro pessoal — receitas, despesas e visão do escritório
        </p>
      </div>
      <MeuFinanceiroContent
        lancamentos={dados.lancamentos}
        honorariosEscritorio={dados.honorariosEscritorio}
        processosHonorarios={dados.processosHonorarios}
        escritorioMes={dados.escritorioMes}
        fluxoEscritorio={dados.fluxoEscritorio}
      />
    </div>
  );
}
