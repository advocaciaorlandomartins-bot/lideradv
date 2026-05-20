import { getAllProcessos } from "@/lib/processos-db";
import ProcessosContent from "@/components/dashboard/processos/processos-content";

export const metadata = {
  title: "Processos — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function ProcessosPage() {
  const processos = await getAllProcessos();
  const ativos = processos.filter((p) => p.status === "ativo").length;
  const total = processos.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Processos
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} processos cadastrados · {ativos} ativos
        </p>
      </div>

      <ProcessosContent processos={processos} />
    </div>
  );
}
