import { notFound } from "next/navigation";
import { getAllProcessosProducao } from "@/lib/producao-db";
import ProducaoContent from "@/components/dashboard/producao/producao-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";

export const metadata = { title: "Produção — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "ver")) notFound();

  // Sem "processos_ver_todos": restringe ao Kanban aos processos onde o
  // usuário é responsável — mesma regra já aplicada em /dashboard/processos.
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const processos = await getAllProcessosProducao(colaboradorId);
  const ativos = processos.filter(
    (p) => p.estagio_producao !== "arquivado"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Produção
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {processos.length} casos cadastrados · {ativos} em andamento
        </p>
      </div>
      <ProducaoContent processos={processos} />
    </div>
  );
}
