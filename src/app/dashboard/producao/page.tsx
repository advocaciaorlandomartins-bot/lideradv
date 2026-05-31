import { getAllProcessosProducao } from "@/lib/producao-db";
import ProducaoContent from "@/components/dashboard/producao/producao-content";

export const metadata = { title: "Produção — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
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
