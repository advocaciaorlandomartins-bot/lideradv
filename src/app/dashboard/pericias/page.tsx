import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllPericias } from "@/lib/pericias-db";
import PericiasContent from "@/components/dashboard/pericias/pericias-content";

export const metadata = {
  title: "Perícias — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function PericiasPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "controles", "ver")) notFound();

  const pericias = await getAllPericias();
  const agendadas = pericias.filter((p) => p.status === "agendado").length;
  const total = pericias.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Perícias
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {total} perícias cadastradas · {agendadas} agendadas
        </p>
      </div>

      <PericiasContent pericias={pericias} />
    </div>
  );
}
