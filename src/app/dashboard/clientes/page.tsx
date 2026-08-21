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

  const clientsRaw = await getAllClients();
  const ativos = clientsRaw.filter((c) => c.status === "ativo").length;
  const total = clientsRaw.length;

  // Quem indicou o cliente é informação sensível (pode virar convite pra
  // levar o agente que traz clientes embora) — só admin/sócio veem. Some da
  // resposta antes de chegar no componente cliente, não só escondido na UI.
  const podeVerIndicador =
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)";
  const clients = podeVerIndicador
    ? clientsRaw
    : clientsRaw.map((c) => ({ ...c, indicador_nome: null }));

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
