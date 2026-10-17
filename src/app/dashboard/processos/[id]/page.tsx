import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Processo — LiderAdv" };

import {
  getProcessoExtended,
  getHistoricoByProcesso,
  getEventosByProcesso,
  getTarefasByProcesso,
  getPendenciasByProcesso,
  getColaboradoresAtivos,
} from "@/lib/processo-full-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import { getCidsByCliente } from "@/lib/clients-db";
import { getPublicacoesByProcesso } from "@/lib/publicacoes-db";
import { getMovimentacoesByProcesso } from "@/lib/movimentacoes-db";
import { getModelosAtivos } from "@/lib/modelos-db";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import {
  getCargaColaboradores,
  filtrarCargaPorPermissao,
} from "@/lib/controladoria-db";
import {
  getEtiquetasDeProcesso,
  getEtiquetasHerdadasDoCliente,
  getCatalogoEtiquetas,
} from "@/lib/etiquetas-db";
import DeleteProcessoButton from "@/components/dashboard/processos/delete-processo-button";
import ProcessoDetailClient from "@/components/dashboard/processos/processo-detail-client";
import PontosAtencaoPanel from "@/components/dashboard/processos/pontos-atencao-panel";
import { ChevronRightIcon } from "@/components/icons";
import { listarPontosAtencao } from "@/lib/pontos-atencao-db";

export const dynamic = "force-dynamic";

export default async function ProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const { id } = await params;

  // getColaboradorIdForUser/etiquetas/catalogoEtiquetas/pontosAtencao só
  // dependem de `id`/`session.id`, nunca do resultado de getProcessoExtended
  // — rodavam em série DEPOIS desse primeiro batch sem necessidade (achado
  // em auditoria de performance de 2026-10-15). Juntar tudo num Promise.all
  // só corta 3 idas-e-voltas seriais evitáveis nesta página.
  const [
    processo,
    historico,
    eventos,
    tarefas,
    pendencias,
    colaboradores,
    modelos,
    carga,
    meuColaboradorId,
    etiquetas,
    etiquetasHerdadas,
    catalogoEtiquetas,
    pontosAtencaoRaw,
    movimentacoes,
  ] = await Promise.all([
    getProcessoExtended(id),
    getHistoricoByProcesso(id),
    getEventosByProcesso(id),
    getTarefasByProcesso(id),
    getPendenciasByProcesso(id),
    getColaboradoresAtivos(),
    getModelosAtivos(),
    getCargaColaboradores(),
    getColaboradorIdForUser(session.id),
    getEtiquetasDeProcesso(id),
    getEtiquetasHerdadasDoCliente(id),
    getCatalogoEtiquetas(),
    listarPontosAtencao(id),
    getMovimentacoesByProcesso(id),
  ]);

  if (!processo) notFound();

  // Sem "processos_ver_todos": só pode abrir o processo se for o responsável.
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  if (!verTodos) {
    if (!meuColaboradorId || processo.responsavel_id !== meuColaboradorId)
      notFound();
  }
  const cargaFiltrada = filtrarCargaPorPermissao(
    carga,
    verTodos,
    meuColaboradorId
  );

  // Carrega documentos do processo + documentos do cliente (enviados pela
  // ficha do cliente) — esse batch SIM depende do resultado acima
  // (processo.client_id), não dá pra paralelizar com o primeiro.
  const [docsProcesso, docsCliente, cids, publicacoesDoProcesso] =
    await Promise.all([
      getDocumentosByEntityId("processo", id),
      processo.client_id
        ? getDocumentosByEntityId("cliente", processo.client_id)
        : Promise.resolve([]),
      processo.client_id
        ? getCidsByCliente(processo.client_id)
        : Promise.resolve([]),
      getPublicacoesByProcesso(id, processo.numero ?? null),
    ]);
  const documentos = [...docsProcesso, ...docsCliente];

  const pontosAtencao = pontosAtencaoRaw.filter((p) => !p.resolvido);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/processos"
          className="hover:text-primary transition-colors duration-150"
        >
          Processos
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/clientes/${processo.client_id}`}
          className="hover:text-primary transition-colors duration-150"
        >
          {processo.client_name}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
          {processo.tipo_acao}
        </span>
      </nav>

      {pontosAtencao.length > 0 && (
        <PontosAtencaoPanel processoId={processo.id} pontos={pontosAtencao} />
      )}

      {/* Client interactive area */}
      <ProcessoDetailClient
        processo={processo}
        historico={historico}
        eventos={eventos}
        tarefas={tarefas}
        pendencias={pendencias}
        colaboradores={colaboradores}
        carga={cargaFiltrada}
        modelos={modelos}
        documentos={documentos}
        cids={cids}
        movimentacoes={movimentacoes}
        publicacoesDoProcesso={publicacoesDoProcesso}
        sessionNome={session.nome}
        podeAlterarResponsavel={hasPermission(
          session,
          "processos_responsavel",
          "editar"
        )}
        podeVerFinanceiro={hasPermission(session, "financeiro", "ver")}
        etiquetas={etiquetas}
        etiquetasHerdadas={etiquetasHerdadas}
        catalogoEtiquetas={catalogoEtiquetas}
        podeEditarEtiquetas={hasPermission(session, "processos", "editar")}
        podeCriarCategoriaNova={hasPermission(
          session,
          "configuracoes",
          "editar"
        )}
      />

      {/* Perigo */}
      {hasPermission(session, "processos", "excluir") && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="font-heading text-sm font-semibold text-red-700 mb-3">
            Zona de risco
          </h3>
          <div className="flex flex-wrap gap-3">
            <DeleteProcessoButton id={processo.id} />
          </div>
        </div>
      )}
    </div>
  );
}
