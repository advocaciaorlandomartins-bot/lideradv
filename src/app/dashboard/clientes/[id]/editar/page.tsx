import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientFull } from "@/lib/clients-db";
import EditClientForm from "@/components/dashboard/clients/edit-client-form";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientFull(id);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/clientes"
          className="hover:text-primary transition-colors duration-150"
        >
          Clientes
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/clientes/${client.id}`}
          className="hover:text-primary transition-colors duration-150 truncate max-w-xs"
        >
          {client.name}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Editar</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Editar cliente
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Atualize os dados de {client.name}.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <EditClientForm client={client} />
      </div>
    </div>
  );
}
