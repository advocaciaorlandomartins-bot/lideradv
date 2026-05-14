import { MOCK_CLIENTS } from "@/lib/mock-data";
import ClientsContent from "@/components/dashboard/clients/clients-content";

export const metadata = {
  title: "Clientes — AdvMartins",
};

export default function ClientesPage() {
  const ativos = MOCK_CLIENTS.filter((c) => c.status === "ativo").length;
  const total = MOCK_CLIENTS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Clientes
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} clientes cadastrados · {ativos} ativos
        </p>
      </div>

      <ClientsContent clients={MOCK_CLIENTS} />
    </div>
  );
}
