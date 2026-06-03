import { getAllProcessos } from "@/lib/processos-db";
import { getAllClients } from "@/lib/clients-db";
import ProcessosContent from "@/components/dashboard/processos/processos-content";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";

export const metadata = {
  title: "Processos — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function ProcessosPage() {
  const [processos, clients] = await Promise.all([
    getAllProcessos(),
    getAllClients(),
  ]);

  const ativos = processos.filter((p) => p.status === "ativo").length;
  const total = processos.length;

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Processos
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} processos cadastrados · {ativos} ativos
        </p>
      </div>

      <ProcessosSubNav />

      <ProcessosContent processos={processos} clients={clientOptions} />
    </div>
  );
}
