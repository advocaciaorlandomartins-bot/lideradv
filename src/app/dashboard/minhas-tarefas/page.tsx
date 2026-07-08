import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMinhasTarefas } from "@/lib/minhas-tarefas-db";
import KanbanColaborador from "@/components/dashboard/minhas-tarefas/kanban-colaborador";

export const metadata = { title: "Minhas Tarefas — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function MinhasTarefasPage() {
  const session = await getSession();
  if (!session) notFound();

  const { pendentes, emAndamento, concluidas } = await getMinhasTarefas(
    session.login
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg">
          Minhas Tarefas
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Demandas atribuídas a você — {session.nome || session.login}
        </p>
      </div>
      <KanbanColaborador
        pendentes={pendentes}
        emAndamento={emAndamento}
        concluidas={concluidas}
        login={session.login}
      />
    </div>
  );
}
