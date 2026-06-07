import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import { getAllClients } from "@/lib/clients-db";
import NovoEnvelope from "@/components/dashboard/assinaturas/novo-envelope";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = { title: "Novo Envelope — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function NovoEnvelopePage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [colaboradores, clientes] = await Promise.all([
    getAllColaboradores(),
    getAllClients(),
  ]);

  const colaboradoresOpts = colaboradores
    .filter((c) => c.status === "ativo")
    .map((c) => ({ id: c.id, nome: c.nome, email: c.email ?? "" }));

  const clientesOpts = clientes.map((c) => ({
    id: c.id,
    nome: c.name,
    email: c.email ?? "",
  }));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/assinaturas"
          className="transition-colors hover:text-primary"
        >
          Assinaturas
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-fg">Novo envelope</span>
      </nav>

      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo envelope
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Prepare os documentos e defina quem deve assinar.
        </p>
      </div>

      <NovoEnvelope
        userLogin={session.login}
        colaboradores={colaboradoresOpts}
        clientes={clientesOpts}
      />
    </div>
  );
}
