import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllRemuneracoes, getRemuneracaoKpis } from "@/lib/remuneracoes-db";
import RemuneracoesContent from "@/components/dashboard/remuneracoes/remuneracoes-content";

export const metadata = {
  title: "Remunerações — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function RemuneracoesPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "remuneracoes", "ver")) notFound();

  const [remuneracoes, kpis] = await Promise.all([
    getAllRemuneracoes(),
    getRemuneracaoKpis(),
  ]);

  const pendentes = remuneracoes.filter((r) => r.status === "pendente").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Remunerações
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {remuneracoes.length} lançamentos · {pendentes} pendentes de pagamento
        </p>
      </div>

      <RemuneracoesContent remuneracoes={remuneracoes} kpis={kpis} />
    </div>
  );
}
