import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { getAllLeads } from "@/lib/crm-db";
import CrmContent from "@/components/dashboard/crm/crm-content";

export const metadata = { title: "CRM — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const leads = await getAllLeads();
  const ativos = leads.filter(
    (l) => l.estagio !== "fechado" && l.estagio !== "perdido"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">CRM</h1>
          <p className="mt-1 font-body text-sm text-muted">
            {leads.length} leads cadastrados · {ativos} em andamento
          </p>
        </div>
        <Link
          href="/dashboard/crm/leads/novo"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Lead
        </Link>
      </div>

      <CrmContent leads={leads} />
    </div>
  );
}
