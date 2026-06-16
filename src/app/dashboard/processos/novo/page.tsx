import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllClients } from "@/lib/clients-db";
import NewProcessoForm from "@/components/dashboard/processos/new-processo-form";
import { ChevronRightIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Novo Processo — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function NovoProcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; back?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "criar")) notFound();

  const { cliente, back } = await searchParams;
  const clients = await getAllClients();
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/processos"
          className="hover:text-primary transition-colors duration-150"
        >
          Processos
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Novo processo</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo processo
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Preencha os dados para cadastrar um novo processo.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewProcessoForm
          clients={clientOptions}
          defaultClientId={cliente}
          redirectTo={back}
        />
      </div>
    </div>
  );
}
