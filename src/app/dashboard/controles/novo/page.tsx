import Link from "next/link";
import { ClipboardListIcon } from "@/components/icons";
import {
  getClientesForControle,
  getProcessosForControle,
  getUsuariosForControle,
  getLocaisAudiencia,
  getLocaisPericia,
} from "@/lib/controles-db";
import { getTipoConfig } from "@/lib/controles-types";
import ControleForm from "@/components/dashboard/controles/controle-form";

export default async function NovoControlePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo = "audiencias" } = await searchParams;
  const tipoConfig = getTipoConfig(tipo);

  const [clientes, processos, usuarios, locais, locaisPericia] =
    await Promise.all([
      getClientesForControle(),
      getProcessosForControle(),
      getUsuariosForControle(),
      getLocaisAudiencia(),
      getLocaisPericia(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
          {tipoConfig.label_novo}
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
                href={`/dashboard/controles?tipo=${tipo}`}
                className="hover:text-primary transition-colors"
              >
                {tipoConfig.label}
              </Link>
            </li>
            <li className="select-none">›</li>
            <li className="text-fg font-medium">Novo</li>
          </ol>
        </nav>
      </div>

      <ControleForm
        tipoInicial={tipo}
        clientes={clientes}
        processos={processos}
        usuarios={usuarios}
        locais={locais}
        locaisPericia={locaisPericia}
      />
    </div>
  );
}
