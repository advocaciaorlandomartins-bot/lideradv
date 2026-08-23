import { notFound } from "next/navigation";
import {
  getRelatorioLancamentos,
  getRelatorioResumo,
  getRelatorioRemuneracoes,
  getFluxoMensal,
  getColaboradoresParaRelatorio,
  getClientesParaRecibo,
  getRelatorioJuridico,
} from "@/lib/relatorios-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import RelatoriosContent from "@/components/dashboard/relatorios/relatorios-content";

export const metadata = { title: "Relatórios — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "relatorios", "ver")) notFound();

  // A checagem de permissão por aba (canSeeTab) em relatorios-content.tsx só
  // decide qual botão aparece — como é um client component, qualquer dado
  // passado como prop já vai serializado no payload pro navegador de quem
  // abrir a página, mesmo sem a sub-permissão daquela aba específica. Folha
  // de pagamento (salário/comissão de cada colaborador) e dados de clientes
  // usados no recibo precisam ser filtrados AQUI, na origem, não só na
  // renderização.
  const podeVerFolha = hasPermission(session, "relatorios_folha", "ver");
  const podeVerClientes =
    hasPermission(session, "relatorios_clientes", "ver") ||
    hasPermission(session, "relatorios_recibo", "ver");
  const podeVerExtrato = hasPermission(session, "relatorios_extrato", "ver");
  const podeVerFluxo = hasPermission(session, "relatorios_fluxo", "ver");
  // O extrato completo (lançamentos individuais, com descrição e cliente)
  // também alimenta as abas Por Cliente e Recibo, além do Painel (prévia
  // de 8 itens) — então precisa ficar disponível se qualquer uma dessas
  // sub-permissões estiver ligada, não só relatorios_extrato isoladamente.
  const podeVerLancamentos = podeVerExtrato || podeVerClientes;

  const [
    lancamentos,
    resumo,
    remuneracoes,
    fluxo,
    colaboradores,
    escritorio,
    clientesComDados,
    juridico,
  ] = await Promise.all([
    podeVerLancamentos ? getRelatorioLancamentos({}) : Promise.resolve([]),
    getRelatorioResumo({}),
    podeVerFolha ? getRelatorioRemuneracoes({}) : Promise.resolve([]),
    podeVerFluxo ? getFluxoMensal(12) : Promise.resolve([]),
    getColaboradoresParaRelatorio(),
    getEscritorioConfig(),
    podeVerClientes ? getClientesParaRecibo() : Promise.resolve([]),
    getRelatorioJuridico(),
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
        colaboradores={colaboradores}
        escritorio={escritorio}
        clientesComDados={clientesComDados}
        juridico={juridico}
        permissoes={session.permissoes ?? {}}
      />
    </div>
  );
}
