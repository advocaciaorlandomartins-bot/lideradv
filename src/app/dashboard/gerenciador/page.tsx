import { getGerenciadorData } from "@/lib/gerenciador-db";
import GerenciadorContent from "@/components/dashboard/gerenciador/gerenciador-content";

export default async function GerenciadorPage() {
  const data = await getGerenciadorData();

  return (
    <main id="main-content" className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Gerenciador
        </h1>
        <p className="mt-1 font-body text-sm text-gray-500">
          Visão gerencial em 4 perspectivas: operacional, tática, estratégica e
          analítica.
        </p>
      </div>
      <GerenciadorContent data={data} />
    </main>
  );
}
