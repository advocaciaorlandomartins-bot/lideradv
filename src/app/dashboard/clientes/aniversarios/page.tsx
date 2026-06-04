import { getClientsWithBirthdays } from "@/lib/clients-db";
import AniversariosContent from "@/components/dashboard/clients/aniversarios-content";

export const metadata = {
  title: "Aniversários — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function AniversariosPage() {
  const clients = await getClientsWithBirthdays();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Aniversários
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Gerencie mensagens e contatos de aniversário dos seus clientes
        </p>
      </div>
      <AniversariosContent clients={clients} />
    </div>
  );
}
