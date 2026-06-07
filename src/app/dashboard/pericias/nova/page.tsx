import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllClients } from "@/lib/clients-db";
import { getAllProcessos } from "@/lib/processos-db";
import NewPericiaForm from "@/components/dashboard/pericias/new-pericia-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Nova Perícia — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function NovaPericiaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const user = await getSession();
  if (!user || !hasPermission(user, "controles", "criar")) notFound();

  const { cliente } = await searchParams;
  const [clients, processos] = await Promise.all([
    getAllClients(),
    getAllProcessos(),
  ]);

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
        <span className="text-fg font-semibold">Nova perícia</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Nova perícia
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Preencha os dados para cadastrar uma nova perícia.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewPericiaForm
          clients={clientOptions}
          processos={processoOptions}
          defaultClientId={cliente}
        />
      </div>
    </div>
  );
}
