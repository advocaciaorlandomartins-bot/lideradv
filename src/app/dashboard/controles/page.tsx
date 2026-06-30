import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardListIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getControles } from "@/lib/controles-db";
import { getTipoConfig } from "@/lib/controles-types";
import ControlesContent from "@/components/dashboard/controles/controles-content";
import ControlesSectionNav from "@/components/dashboard/controles/section-nav";

export const metadata = { title: "Controles — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function ControlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    status?: string;
    ordem?: string;
    pagina?: string;
    rpp?: string;
    inicio?: string;
    fim?: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "ver")) notFound();

  const sp = await searchParams;
  const tipo = sp.tipo ?? "audiencias";
  const status = sp.status ?? "pendente";
  const ordem = (sp.ordem === "asc" ? "asc" : "desc") as "asc" | "desc";
  const pagina = Math.max(1, Number(sp.pagina ?? 1));
  const rpp = [20, 50, 100].includes(Number(sp.rpp)) ? Number(sp.rpp) : 20;
  const inicio = sp.inicio ?? "";
  const fim = sp.fim ?? "";

  const { controles, total } = await getControles({
    tipo,
    status: status === "todos" ? null : status,
    ordem,
    pagina,
    rpp,
    inicio: inicio || null,
    fim: fim || null,
  });

  const tipoConfig = getTipoConfig(tipo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
            <ClipboardListIcon className="h-6 w-6 text-primary" />
            Controles
          </h1>
          <nav className="mt-1" aria-label="Navegação">
            <ol className="flex items-center gap-1.5 font-body text-xs text-muted">
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-primary transition-colors"
                >
                  Início
                </Link>
              </li>
              <li className="select-none">›</li>
              <li className="text-fg font-medium">{tipoConfig.label}</li>
            </ol>
          </nav>
        </div>

        <Link
          href={`/dashboard/controles/novo?tipo=${tipo}`}
          className="flex items-center gap-1.5 rounded-lg bg-cta hover:bg-cta-hover px-4 h-10 font-body text-sm font-semibold text-white transition-colors whitespace-nowrap"
        >
          + {tipoConfig.label_novo}
        </Link>
      </div>

      <ControlesSectionNav />

      <ControlesContent
        controles={controles}
        total={total}
        tipo={tipo}
        status={status}
        ordem={ordem}
        pagina={pagina}
        rpp={rpp}
        inicio={inicio}
        fim={fim}
      />
    </div>
  );
}
