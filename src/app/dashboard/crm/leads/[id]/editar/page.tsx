import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Editar Lead — LiderAdv" };

import { getLeadById } from "@/lib/crm-db";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import LeadForm from "@/components/dashboard/crm/lead-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarLeadPage({ params }: Props) {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "editar")) notFound();

  const { id } = await params;
  const [lead, colaboradores] = await Promise.all([
    getLeadById(id),
    getAllColaboradores(),
  ]);

  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-1 flex items-center gap-1.5 font-body text-sm text-muted">
          <Link href="/dashboard/crm" className="hover:text-primary">
            CRM
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard/crm/leads/${id}`}
            className="hover:text-primary"
          >
            {lead.nome}
          </Link>
          <span>/</span>
          <span className="text-fg">Editar</span>
        </nav>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Editar Lead
        </h1>
      </div>
      <LeadForm lead={lead} colaboradores={colaboradores} />
    </div>
  );
}
