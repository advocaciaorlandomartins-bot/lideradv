import { notFound } from "next/navigation";
import { getAllProcessos } from "@/lib/processos-db";
import { getAllClients } from "@/lib/clients-db";
import ProcessosContent from "@/components/dashboard/processos/processos-content";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Processos — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const { busca } = await searchParams;

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

      <ProcessosContent
        processos={processos}
        clients={clientOptions}
        initialBusca={busca}
      />
    </div>
  );
}
