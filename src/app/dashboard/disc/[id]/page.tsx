import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import DiscResultado from "@/components/dashboard/disc/disc-resultado";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Não encontrado" };
  const [t] =
    await sql`SELECT nome_candidato FROM testes_comportamentais WHERE id = ${id}`;
  return {
    title: t ? `DISC — ${t.nome_candidato} — LiderAdv` : "Não encontrado",
  };
}

export default async function DiscDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) notFound();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [teste] =
    await sql`SELECT * FROM testes_comportamentais WHERE id = ${id}`;
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
