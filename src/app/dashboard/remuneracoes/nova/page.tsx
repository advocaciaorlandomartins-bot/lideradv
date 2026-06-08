import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import { getAllProcessos } from "@/lib/processos-db";
import { getAllClients } from "@/lib/clients-db";
import NewRemuneracaoForm from "@/components/dashboard/remuneracoes/new-remuneracao-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Nova Remuneração — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function NovaRemuneracaoPage({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string; tipo?: string }>;
}) {
  const user = await getSession();
  if (!user || !hasPermission(user, "remuneracoes", "criar")) notFound();

  const { colaborador: defaultColaboradorId, tipo: defaultTipo } =
    await searchParams;
  const [colaboradores, processos, clients] = await Promise.all([
    getAllColaboradores(),
    getAllProcessos(),
    getAllClients(),
  ]);

  const colaboradorOptions = colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    cargo: c.cargo,
    salario_mensal: c.salario_mensal,
  }));

  const processoOptions = processos.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    tipo_acao: p.tipo_acao,
    numero: p.numero,
  }));

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    doc: c.doc,
  }));

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
        <Link
          href="/dashboard/financeiro?tab=remuneracoes"
          className="hover:text-primary transition-colors duration-150"
        >
          Remunerações
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Novo lançamento</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo lançamento
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Registre um salário, comissão ou bonificação para um colaborador.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewRemuneracaoForm
          colaboradores={colaboradorOptions}
          processos={processoOptions}
          clients={clientOptions}
          defaultColaboradorId={defaultColaboradorId}
          defaultTipo={defaultTipo}
        />
      </div>
    </div>
  );
}
