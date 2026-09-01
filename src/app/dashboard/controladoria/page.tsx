import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getRankingDetalhado } from "@/lib/pontuacao";
import {
  getCargaColaboradores,
  getCapacidadeResumo,
} from "@/lib/controladoria-db";
import ControladoriaContent from "@/components/dashboard/controladoria/controladoria-content";

export const metadata = {
  title: "Controladoria — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ControladoriaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) notFound();

  const [ranking, carga, capacidade] = await Promise.all([
    getRankingDetalhado(30),
    getCargaColaboradores(),
    getCapacidadeResumo(8),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">
          Controladoria
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Ranking de produtividade, carga da equipe e vazão de trabalho — a
          visão que atravessa todas as outras.
        </p>
      </div>
      <ControladoriaContent
        ranking={ranking}
        carga={carga}
        capacidade={capacidade}
      />
    </div>
  );
}
