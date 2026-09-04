import { notFound } from "next/navigation";
import Link from "next/link";
import NewClientForm from "@/components/dashboard/clients/new-client-form";
import ImportarDocumentoButton from "@/components/dashboard/clients/importar-documento-button";
import { ChevronRightIcon } from "@/components/icons";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Novo Cliente — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "criar")) notFound();

  const colaboradores = await getAllColaboradores();
  const podeVerIndicador =
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)";
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
        <span className="text-fg font-semibold">Novo cliente</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            Novo cliente
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Preencha os dados para cadastrar um novo cliente.
          </p>
        </div>
        <ImportarDocumentoButton />
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewClientForm
          colaboradores={colaboradores}
          podeVerIndicador={podeVerIndicador}
        />
      </div>
    </div>
  );
}
