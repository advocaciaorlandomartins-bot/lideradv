import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getMeuFinanceiroInitial } from "@/lib/meu-financeiro-db";
import MeuFinanceiroContent from "@/components/dashboard/financeiro/meu-financeiro-content";

export const metadata = {
  title: "Meu Financeiro — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function MeuFinanceiroPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "meu_financeiro", "ver")) redirect("/dashboard");

  const dados = await getMeuFinanceiroInitial(session.id);
  const podeVerHonorarioTotal =
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)";

  // O comentário original já dizia a intenção: só admin/sócio vê o valor
  // total do honorário do cliente, pro colaborador mostra só a comissão
  // dele. Mas "podeVerHonorarioTotal" só controlava a RENDERIZAÇÃO — os
  // dados completos (honorario_estimado, valor_honorario, valor_causa, e o
  // valor cheio de cada lançamento aguardando resultado) já iam inteiros no
  // payload do client component pra qualquer colaborador, visível via
  // devtools. Redação tem que acontecer aqui, na origem, não só na tela.
  const processosHonorarios = podeVerHonorarioTotal
    ? dados.processosHonorarios
    : dados.processosHonorarios.map((p) => ({
        ...p,
        honorario_estimado: 0,
        valor_honorario: null,
        valor_causa: null,
      }));
  const aguardandoResultado = podeVerHonorarioTotal
    ? dados.aguardandoResultado
    : dados.aguardandoResultado.map((l) => ({ ...l, valor: 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Meu Financeiro
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Controle financeiro pessoal — receitas, despesas e visão do escritório
        </p>
      </div>
      <MeuFinanceiroContent
        lancamentos={dados.lancamentos}
        honorariosEscritorio={dados.honorariosEscritorio}
        processosHonorarios={processosHonorarios}
        escritorioMes={dados.escritorioMes}
        fluxoEscritorio={dados.fluxoEscritorio}
        aguardandoResultado={aguardandoResultado}
        aguardandoResultadoTotal={dados.aguardandoResultadoTotal}
        fluxoHonorarios={dados.fluxoHonorarios}
        processosAtivosCount={dados.processosAtivosCount}
        estagioSnapshot={dados.estagioSnapshot}
        comissaoConfigurada={dados.comissaoConfigurada}
        podeVerHonorarioTotal={podeVerHonorarioTotal}
      />
    </div>
  );
}
