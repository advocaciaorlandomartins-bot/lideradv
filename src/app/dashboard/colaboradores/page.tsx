import { notFound } from "next/navigation";
import { getAllColaboradores } from "@/lib/colaboradores-db";
import ColaboradoresContent from "@/components/dashboard/colaboradores/colaboradores-content";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Colaboradores — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "ver")) notFound();

  const colaboradoresRaw = await getAllColaboradores();
  const ativos = colaboradoresRaw.filter((c) => c.status === "ativo").length;

  // Salário e percentuais de comissão são dados sensíveis de RH — vazavam
  // para qualquer usuário com colaboradores:ver (Advogado(a)/Estagiário(a)/
  // Colaborador(a) por padrão, ou seja, quase todo mundo) via props do
  // client component, mesmo a tabela nunca exibindo essas colunas.
  const podeVerRemuneracao =
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)";
  const colaboradores = podeVerRemuneracao
    ? colaboradoresRaw
    : colaboradoresRaw.map((c) => ({
        ...c,
        salario_mensal: null,
        comissao_administrativo_pct: null,
        comissao_judicial_pct: null,
        comissao_ambos_pct: null,
      }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Colaboradores
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {colaboradores.length} colaboradores · {ativos} ativos
        </p>
      </div>

      <ColaboradoresContent colaboradores={colaboradores} />
    </div>
  );
}
