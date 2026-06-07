import { notFound } from "next/navigation";
import {
  getRelatorioLancamentos,
  getRelatorioResumo,
  getRelatorioRemuneracoes,
  getFluxoMensal,
  getClientesParaRelatorio,
  getColaboradoresParaRelatorio,
  getClientesParaRecibo,
} from "@/lib/relatorios-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import RelatoriosContent from "@/components/dashboard/relatorios/relatorios-content";

export const metadata = { title: "Relatórios — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "relatorios", "ver")) notFound();

  const [
    lancamentos,
    resumo,
    remuneracoes,
    fluxo,
    clientes,
    colaboradores,
    escritorio,
    clientesComDados,
  ] = await Promise.all([
    getRelatorioLancamentos({}),
    getRelatorioResumo({}),
    getRelatorioRemuneracoes({}),
    getFluxoMensal(12),
    getClientesParaRelatorio(),
    getColaboradoresParaRelatorio(),
    getEscritorioConfig(),
    getClientesParaRecibo(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Relatórios
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Visão completa de receitas, despesas e folha de pagamento.
        </p>
      </div>
      <RelatoriosContent
        lancamentos={lancamentos}
        resumo={resumo}
        remuneracoes={remuneracoes}
        fluxo={fluxo}
        clientes={clientes}
        colaboradores={colaboradores}
        escritorio={escritorio}
        clientesComDados={clientesComDados}
        permissoes={session.permissoes ?? {}}
      />
    </div>
  );
}
