import { notFound } from "next/navigation";
import { getAllProcessosProducao } from "@/lib/producao-db";
import ProducaoContent from "@/components/dashboard/producao/producao-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Produção — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "ver")) notFound();

  const processos = await getAllProcessosProducao();
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
