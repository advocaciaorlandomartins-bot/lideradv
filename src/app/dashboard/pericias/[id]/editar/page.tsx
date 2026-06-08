import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getPericiaFull } from "@/lib/pericias-db";
import { TIPO_LABELS } from "@/lib/pericias-db";
import { getAllClients } from "@/lib/clients-db";
import { getAllProcessos } from "@/lib/processos-db";
import EditPericiaForm from "@/components/dashboard/pericias/edit-pericia-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Editar Perícia — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function EditarPericiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || !hasPermission(user, "controles", "editar")) notFound();

  const { id } = await params;
  const [pericia, clients, processos] = await Promise.all([
    getPericiaFull(id),
    getAllClients(),
    getAllProcessos(),
  ]);

  if (!pericia) notFound();

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  const processoOptions = processos.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    tipo_acao: p.tipo_acao,
    numero: p.numero,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/pericias"
          className="hover:text-primary transition-colors duration-150"
        >
          Perícias
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/pericias/${id}`}
          className="hover:text-primary transition-colors duration-150 truncate max-w-[160px]"
        >
          {TIPO_LABELS[pericia.tipo]}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Editar</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Editar perícia
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Atualize os dados da perícia.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <EditPericiaForm
          pericia={pericia}
          clients={clientOptions}
          processos={processoOptions}
        />
      </div>
    </div>
  );
}
