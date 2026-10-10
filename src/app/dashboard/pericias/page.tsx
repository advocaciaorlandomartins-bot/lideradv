import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getAllPericias } from "@/lib/pericias-db";
import PericiasContent from "@/components/dashboard/pericias/pericias-content";
import ControlesSectionNav from "@/components/dashboard/controles/section-nav";

export const metadata = {
  title: "Perícias — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function PericiasPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "controles", "ver")) notFound();

  const verTodos = hasPermission(user, "controles_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(user.id)) ??
      "00000000-0000-0000-0000-000000000000");
  const pericias = await getAllPericias(verTodos, colaboradorId);
  const agendadas = pericias.filter((p) => p.status === "agendado").length;
  const total = pericias.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Controles
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} perícias cadastradas · {agendadas} agendadas
        </p>
      </div>

      <ControlesSectionNav />

      <PericiasContent pericias={pericias} />
    </div>
  );
}
