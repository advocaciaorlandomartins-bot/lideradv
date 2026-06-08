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

  const colaboradores = await getAllColaboradores();
  const ativos = colaboradores.filter((c) => c.status === "ativo").length;

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
