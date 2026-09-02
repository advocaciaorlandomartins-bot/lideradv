import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getRankingDetalhado,
  filtrarHistoricoPorPermissao,
} from "@/lib/pontuacao";
import {
  getCargaColaboradores,
  getCapacidadeResumo,
  filtrarCargaPorPermissao,
} from "@/lib/controladoria-db";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import ControladoriaContent from "@/components/dashboard/controladoria/controladoria-content";

export const metadata = {
  title: "Controladoria — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ControladoriaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) notFound();

  const [ranking, carga, capacidade, meuColaboradorId] = await Promise.all([
    getRankingDetalhado(30),
    getCargaColaboradores(),
    getCapacidadeResumo(8),
    getColaboradorIdForUser(session.id),
  ]);

  // "Carga da equipe" e o histórico do Ranking mostram título de item e
  // nome de cliente — quem não tem processos_ver_todos só devia ver esse
  // nível de detalhe do próprio trabalho, não do de todo mundo (mesma
  // regra de escopo já usada em processos/Cérebro Jurídico).
  const podeVerDetalhesDeTodos = hasPermission(
    session,
    "processos_ver_todos",
    "ver"
  );
  const cargaFiltrada = filtrarCargaPorPermissao(
    carga,
    podeVerDetalhesDeTodos,
    meuColaboradorId
  );
  const rankingFiltrado = filtrarHistoricoPorPermissao(
    ranking,
    podeVerDetalhesDeTodos,
    meuColaboradorId
  );

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
        ranking={rankingFiltrado}
        carga={cargaFiltrada}
        capacidade={capacidade}
        podeVerDetalhesDeTodos={podeVerDetalhesDeTodos}
        meuColaboradorId={meuColaboradorId}
      />
    </div>
  );
}
