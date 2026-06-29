import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import DiscList from "@/components/dashboard/disc/disc-list";
import Link from "next/link";

export const metadata = {
  title: "Teste Comportamental DISC — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function DiscPage() {
  const session = await getSession();
  if (!session) notFound();

  const testes = await sql`
    SELECT id, nome_candidato, cargo_vaga, perfil_dominante, funcao_sugerida,
           recomendacao, pontuacao_a, pontuacao_b, pontuacao_c, pontuacao_d, created_at
    FROM testes_comportamentais
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            Teste Comportamental
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Metodologia DISC Previdenciário — identifique o perfil certo para
            cada vaga do escritório.{" "}
            {testes.length > 0 && `${testes.length} teste(s) realizado(s).`}
          </p>
        </div>
        <Link
          href="/dashboard/disc/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          + Novo Teste
        </Link>
      </div>

      {/* Card de explicação */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            letra: "A",
            nome: "Executor",
            cor: "bg-red-50 border-red-200 text-red-700",
            vaga: "SDR / Vendas / Audiências",
          },
          {
            letra: "B",
            nome: "Comunicador",
            cor: "bg-yellow-50 border-yellow-200 text-yellow-700",
            vaga: "Atendimento / Captação",
          },
          {
            letra: "C",
            nome: "Planejador",
            cor: "bg-green-50 border-green-200 text-green-700",
            vaga: "Backoffice / Operacional",
          },
          {
            letra: "D",
            nome: "Analista",
            cor: "bg-blue-50 border-blue-200 text-blue-700",
            vaga: "Cálculos / Peticionamento",
          },
        ].map((p) => (
          <div key={p.letra} className={`rounded-xl border p-4 ${p.cor}`}>
            <span className="text-2xl font-black opacity-20">{p.letra}</span>
            <p className="font-bold text-sm mt-1">{p.nome}</p>
            <p className="text-xs opacity-70 mt-0.5">{p.vaga}</p>
          </div>
        ))}
      </div>

      <DiscList testes={testes as Parameters<typeof DiscList>[0]["testes"]} />
    </div>
  );
}
