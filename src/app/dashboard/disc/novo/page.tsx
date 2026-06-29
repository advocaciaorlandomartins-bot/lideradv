import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import DiscForm from "@/components/dashboard/disc/disc-form";
import Link from "next/link";

export const metadata = {
  title: "Novo Teste DISC — LiderAdv",
};

export default async function DiscNovoPage() {
  const session = await getSession();
  if (!session) notFound();

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
          <span className="text-fg">Novo Teste</span>
        </nav>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Novo Teste DISC
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Aplique o questionário ao candidato e registre as respostas. O sistema
          calcula automaticamente o perfil e a recomendação de vaga.
        </p>
      </div>

      <DiscForm />
    </div>
  );
}
