import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientFull } from "@/lib/clients-db";

export const metadata = { title: "Editar Cliente — LiderAdv" };
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import EditClientForm from "@/components/dashboard/clients/edit-client-form";
import { ChevronRightIcon } from "@/components/icons";
import { getAllColaboradores } from "@/lib/colaboradores-db";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar")) notFound();

  const { id } = await params;
  const [client, colaboradores] = await Promise.all([
    getClientFull(id),
    getAllColaboradores(),
  ]);
  if (!client) notFound();

  const podeVerIndicador =
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)";

  // Mesma regra da listagem de clientes: a comissão/indicador só pode ficar
  // visível a Administrador(a)/Sócio(a) — redigido AQUI, antes de virar prop
  // do client component, e não só escondido pela UI (que já tinha o gate
  // {podeVerIndicador && (...)}, mas os campos hidden do formulário
  // carregavam o valor real de qualquer forma, visível via devtools).
  const clientParaForm = podeVerIndicador
    ? client
    : {
        ...client,
        indicador_id: null,
        comissao_tipo: null,
        comissao_valor: null,
      };

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
        <EditClientForm
          client={clientParaForm}
          colaboradores={colaboradores}
          podeVerIndicador={podeVerIndicador}
        />
      </div>
    </div>
  );
}
