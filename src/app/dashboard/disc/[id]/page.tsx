import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";
import DiscResultado from "@/components/dashboard/disc/disc-resultado";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  // Mesma checagem de sessão/dono da página — sem isso o <title> vazava o
  // nome do candidato pra qualquer um que soubesse o UUID, mesmo sem
  // permissão nenhuma pra ver o corpo da página.
  const session = await getSession();
  if (!session || !hasPermission(session, "disc", "ver"))
    return { title: "Não encontrado" };

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Não encontrado" };
  const [t] = await sql`
    SELECT nome_candidato FROM testes_comportamentais
    WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
  `;
  return {
    title: t ? `DISC — ${t.nome_candidato} — LiderAdv` : "Não encontrado",
  };
}

export default async function DiscDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session || !hasPermission(session, "disc", "ver")) notFound();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Cada colaborador só vê os testes que ele mesmo aplicou — mesmo
  // critério já usado em /api/disc (listagem) e /api/disc/[id] (API). A
  // página de detalhe era a única exceção: sem esse filtro, qualquer
  // usuário com disc:ver conseguia abrir o teste comportamental de
  // qualquer colega só sabendo o UUID.
  const [teste] = await sql`
    SELECT * FROM testes_comportamentais
    WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
  `;
  if (!teste) notFound();

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-muted mb-3">
          <Link
            href="/dashboard/disc"
            className="hover:text-fg transition-colors"
          >
            Teste Comportamental
          </Link>
          <span>/</span>
          <span className="text-fg">{teste.nome_candidato}</span>
        </nav>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          {teste.nome_candidato}
        </h1>
        {teste.cargo_vaga && (
          <p className="mt-1 font-body text-sm text-muted">
            Vaga avaliada: <strong>{teste.cargo_vaga}</strong>
          </p>
        )}
      </div>

      <DiscResultado
        teste={teste as Parameters<typeof DiscResultado>[0]["teste"]}
      />
    </div>
  );
}
