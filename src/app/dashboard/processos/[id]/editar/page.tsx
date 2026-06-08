import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getProcessoFull } from "@/lib/processos-db";
import { getAllClients } from "@/lib/clients-db";
import EditProcessoForm from "@/components/dashboard/processos/edit-processo-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Editar Processo — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function EditarProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar")) notFound();

  const { id } = await params;
  const [processo, clients] = await Promise.all([
    getProcessoFull(id),
    getAllClients(),
  ]);

  if (!processo) notFound();

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
        <Link
          href={`/dashboard/processos/${id}`}
          className="hover:text-primary transition-colors duration-150 truncate max-w-[160px]"
        >
          {processo.tipo_acao}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Editar</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Editar processo
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Atualize os dados do processo.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <EditProcessoForm processo={processo} clients={clientOptions} />
      </div>
    </div>
  );
}
