import { notFound } from "next/navigation";
import { getAllLeads } from "@/lib/crm-db";
import CrmContent from "@/components/dashboard/crm/crm-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";

export const metadata = { title: "CRM — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "ver")) notFound();

  // Sem "processos_ver_todos": restringe aos leads onde o usuário é
  // responsável — mesma regra já aplicada em /dashboard/processos.
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const leads = await getAllLeads(colaboradorId);
  const ativos = leads.filter(
    (l) => l.estagio !== "fechado" && l.estagio !== "perdido"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">CRM</h1>
        <p className="mt-1 font-body text-sm text-muted">
          {leads.length} leads cadastrados · {ativos} em andamento
        </p>
      </div>

      <CrmContent leads={leads} />
    </div>
  );
}
