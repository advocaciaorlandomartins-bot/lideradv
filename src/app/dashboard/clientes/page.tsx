import { notFound } from "next/navigation";
import { getAllClients } from "@/lib/clients-db";
import ClientsContent from "@/components/dashboard/clients/clients-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Clientes — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver")) notFound();

  const clients = await getAllClients();
  const ativos = clients.filter((c) => c.status === "ativo").length;
  const total = clients.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Clientes
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} clientes cadastrados · {ativos} ativos
        </p>
      </div>

      <ClientsContent clients={clients} />
    </div>
  );
}
