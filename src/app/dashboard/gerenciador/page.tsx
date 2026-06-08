import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getGerenciadorData } from "@/lib/gerenciador-db";
import GerenciadorContent from "@/components/dashboard/gerenciador/gerenciador-content";

export const metadata = {
  title: "Gerenciador — LiderAdv",
};

export default async function GerenciadorPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "gerenciador", "ver")) notFound();

  const data = await getGerenciadorData();

  return (
    <div>
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
    </div>
  );
}
