import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardListIcon } from "@/components/icons";
import {
  getControleById,
  getClientesForControle,
  getProcessosForControle,
  getUsuariosForControle,
  getLocaisAudiencia,
  getLocaisPericia,
} from "@/lib/controles-db";
import { getTipoConfig } from "@/lib/controles-types";
import ControleForm from "@/components/dashboard/controles/controle-form";

export const dynamic = "force-dynamic";

export default async function EditarControlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [controle, clientes, processos, usuarios, locais, locaisPericia] =
    await Promise.all([
      getControleById(id),
      getClientesForControle(),
      getProcessosForControle(),
      getUsuariosForControle(),
      getLocaisAudiencia(),
      getLocaisPericia(),
    ]);

  if (!controle) notFound();

  const tipoConfig = getTipoConfig(controle.tipo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
          Editar — {tipoConfig.label}
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
            <li>
              <Link
                href={`/dashboard/controles?tipo=${controle.tipo}`}
                className="hover:text-primary transition-colors"
              >
                {tipoConfig.label}
              </Link>
            </li>
            <li className="select-none">›</li>
            <li className="text-fg font-medium">Editar</li>
          </ol>
        </nav>
      </div>

      <ControleForm
        controle={controle}
        tipoInicial={controle.tipo}
        clientes={clientes}
        processos={processos}
        usuarios={usuarios}
        locais={locais}
        locaisPericia={locaisPericia}
      />
    </div>
  );
}
