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

  // "Carga da equipe" e o Ranking mostram nome, cargo e agregados (total
  // aberto, pontos, % no prazo) de cada colaborador — quem não tem
  // processos_ver_todos só deve ver a própria linha, não a de todo mundo
  // (mesma regra de escopo já usada em processos/Cérebro Jurídico). O
  // filtro entra já na query (getRankingDetalhado/getCargaColaboradores
  // recebem o colaboradorId), não só escondendo linhas depois de
  // recebidas — senão o JSON com nome+carga de toda a equipe chegaria ao
  // navegador de qualquer jeito, inspecionável via DevTools.
  const podeVerDetalhesDeTodos = hasPermission(
    session,
    "processos_ver_todos",
    "ver"
  );
  const meuColaboradorId = await getColaboradorIdForUser(session.id);
  const colaboradorIdParaFiltro = podeVerDetalhesDeTodos
    ? null
    : meuColaboradorId;

  const [ranking, carga, capacidade] = await Promise.all([
    getRankingDetalhado(30, colaboradorIdParaFiltro),
    getCargaColaboradores(colaboradorIdParaFiltro),
    getCapacidadeResumo(8),
  ]);

  // Camada extra (defense-in-depth): pro caso raro de admin/sócio olhando a
  // própria linha, ou de algum caminho futuro voltar a chamar as funções
  // acima sem o filtro — nunca depender só de uma das duas camadas.
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
