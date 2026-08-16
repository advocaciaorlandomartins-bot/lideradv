import { notFound } from "next/navigation";
import { getAllProcessos } from "@/lib/processos-db";
import { getAllClients } from "@/lib/clients-db";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import ProcessosContent from "@/components/dashboard/processos/processos-content";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = {
  title: "Processos — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const { busca } = await searchParams;

  // Sem "processos_ver_todos": restringe aos processos onde o usuário é responsável.
  // Sem colaborador_id vinculado nesse caso, não há processo nenhum que seja
  // "dele" — usa um UUID inexistente para garantir lista vazia (nunca "todos").
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const [processosRaw, clients] = await Promise.all([
    getAllProcessos(verTodos ? null : colaboradorId),
    getAllClients(),
  ]);

  // Sem permissão de financeiro: remove valores monetários já no servidor
  // (não é só esconder na tela — o payload enviado ao navegador não deve
  // conter o dado).
  const podeVerFinanceiro = hasPermission(session, "financeiro", "ver");
  const processos = podeVerFinanceiro
    ? processosRaw
    : processosRaw.map((p) => ({
        ...p,
        valor_causa: null,
        valor_honorario: null,
        percentual_honorario: null,
      }));

  const ativos = processos.filter((p) => p.status === "ativo").length;
  const total = processos.length;

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Processos
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} processos cadastrados · {ativos} ativos
        </p>
      </div>

      <ProcessosSubNav />

      <ProcessosContent
        processos={processos}
        clients={clientOptions}
        initialBusca={busca}
      />
    </div>
  );
}
