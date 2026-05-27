import Link from "next/link";
import { getAllClients } from "@/lib/clients-db";
import { getAllProcessos } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import NewLancamentoForm from "@/components/dashboard/financeiro/new-lancamento-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Novo Lançamento — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function NovoLancamentoPage() {
  const [clients, processos, escritorioConfig] = await Promise.all([
    getAllClients(),
    getAllProcessos(),
    getEscritorioConfig(),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    doc: c.doc,
  }));

  const processoOptions = processos.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    tipo_acao: p.tipo_acao,
    numero: p.numero,
    valor_causa: p.valor_causa,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/financeiro"
          className="hover:text-primary transition-colors duration-150"
        >
          Financeiro
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
          Registre uma entrada, saída ou honorários parcelados.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <NewLancamentoForm
          clients={clientOptions}
          processos={processoOptions}
          salarioMinimo={escritorioConfig.salario_minimo ?? 1518}
        />
      </div>
    </div>
  );
}
