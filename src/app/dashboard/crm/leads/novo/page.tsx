import { notFound } from "next/navigation";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import LeadForm from "@/components/dashboard/crm/lead-form";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Novo Lead — CRM — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function NovoLeadPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "criar")) notFound();

  const colaboradores = await getAllColaboradores();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo Lead
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Adicione um potencial cliente ao funil de vendas
        </p>
      </div>
      <LeadForm colaboradores={colaboradores} />
    </div>
  );
}
