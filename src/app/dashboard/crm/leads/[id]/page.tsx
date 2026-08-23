import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Lead — LiderAdv" };

import {
  getLeadById,
  getAtividadesByLead,
  getTarefasByLead,
} from "@/lib/crm-db";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import LeadDetail from "@/components/dashboard/crm/lead-detail";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "ver")) notFound();

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [lead, atividades, tarefas, colaboradores] = await Promise.all([
    getLeadById(id),
    getAtividadesByLead(id),
    getTarefasByLead(id),
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
          <span className="text-fg">{lead.nome}</span>
        </nav>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          {lead.nome}
        </h1>
      </div>

      <LeadDetail
        lead={lead}
        atividades={atividades}
        tarefas={tarefas}
        colaboradores={colaboradores}
      />
    </div>
  );
}
