import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Editar Modelo — LiderAdv" };

import { getModeloById } from "@/lib/modelos-db";
import { updateModeloAction } from "@/lib/modelo-actions";
import ModeloForm from "@/components/dashboard/modelos/modelo-form";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function EditarModeloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "editar")) notFound();

  const { id } = await params;
  const modelo = await getModeloById(id);
  if (!modelo) notFound();

  const boundAction = updateModeloAction.bind(null, id);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/modelos"
          className="hover:text-primary transition-colors"
        >
          Modelos
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold truncate max-w-xs">
          {modelo.titulo}
        </span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg">
            Editar Modelo
          </h1>
          <p className="mt-1 font-body text-sm text-muted">{modelo.titulo}</p>
        </div>
        <span
          className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-semibold ${
            modelo.ativo
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${modelo.ativo ? "bg-emerald-500" : "bg-slate-400"}`}
          />
          {modelo.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <ModeloForm action={boundAction} modelo={modelo} />
      </div>
    </div>
  );
}
