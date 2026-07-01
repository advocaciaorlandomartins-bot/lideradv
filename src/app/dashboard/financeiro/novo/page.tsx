import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllClientsWithOrigin } from "@/lib/clients-db";
import { getAllProcessos } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import NewLancamentoForm from "@/components/dashboard/financeiro/new-lancamento-form";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = {
  title: "Novo Lançamento — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function NovoLancamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    client_id?: string;
    processo_id?: string;
    back?: string;
    cancel_aguardando?: string;
    valor_inicial?: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "criar")) notFound();

  const {
    tipo,
    client_id,
    processo_id,
    back,
    cancel_aguardando,
    valor_inicial,
  } = await searchParams;
  const defaultTipo: "entrada" | "saida" =
    tipo === "saida" ? "saida" : "entrada";

  const [clients, processos, escritorioConfig] = await Promise.all([
    getAllClientsWithOrigin(),
    getAllProcessos(),
    getEscritorioConfig(),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    doc: c.doc,
    origem_tipo: c.origem_tipo,
    indicador_id: c.indicador_id,
    indicador_nome: c.indicador_nome,
    comissao_tipo: c.comissao_tipo,
    comissao_valor: c.comissao_valor,
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
          defaultTipo={defaultTipo}
          defaultClientId={client_id}
          defaultProcessoId={processo_id}
          redirectTo={back}
          cancelAguardando={cancel_aguardando}
          valorInicial={valor_inicial}
        />
      </div>
    </div>
  );
}
