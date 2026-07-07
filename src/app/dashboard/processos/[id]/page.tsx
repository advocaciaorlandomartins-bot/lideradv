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
import { getModelosAtivos } from "@/lib/modelos-db";
import DeleteProcessoButton from "@/components/dashboard/processos/delete-processo-button";
import DocumentsSection from "@/components/dashboard/documents/documents-section";
import ProcessoDetailClient from "@/components/dashboard/processos/processo-detail-client";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const { id } = await params;

  const [
    processo,
    historico,
    eventos,
    tarefas,
    pendencias,
    colaboradores,
    modelos,
  ] = await Promise.all([
    getProcessoExtended(id),
    getHistoricoByProcesso(id),
    getEventosByProcesso(id),
    getTarefasByProcesso(id),
    getPendenciasByProcesso(id),
    getColaboradoresAtivos(),
    getModelosAtivos(),
  ]);

  if (!processo) notFound();

  // Carrega documentos do processo + documentos do cliente (enviados pela ficha do cliente)
  const [docsProcesso, docsCliente] = await Promise.all([
    getDocumentosByEntityId("processo", id),
    processo.client_id
      ? getDocumentosByEntityId("cliente", processo.client_id)
      : Promise.resolve([]),
  ]);
  const documentos = [...docsProcesso, ...docsCliente];

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

      {/* Client interactive area */}
      <ProcessoDetailClient
        processo={processo}
        historico={historico}
        eventos={eventos}
        tarefas={tarefas}
        pendencias={pendencias}
        colaboradores={colaboradores}
        modelos={modelos}
        sessionLogin={session.login}
      />

      {/* Arquivos (server, static) */}
      <DocumentsSection
        entityType="processo"
        entityId={processo.id}
        documents={documentos}
      />

      {/* Perigo */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 className="font-heading text-sm font-semibold text-red-700 mb-3">
          Zona de risco
        </h3>
        <div className="flex flex-wrap gap-3">
          <DeleteProcessoButton id={processo.id} />
        </div>
      </div>
    </div>
  );
}
