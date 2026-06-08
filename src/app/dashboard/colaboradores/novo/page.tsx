import { notFound } from "next/navigation";
import Link from "next/link";
import NewColaboradorForm from "@/components/dashboard/colaboradores/new-colaborador-form";
import { ChevronRightIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Novo Colaborador — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function NovoColaboradorPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "criar")) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/colaboradores"
          className="hover:text-primary transition-colors duration-150"
        >
          Colaboradores
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Novo colaborador</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo colaborador
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Preencha os dados para cadastrar um novo colaborador.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewColaboradorForm />
      </div>
    </div>
  );
}
