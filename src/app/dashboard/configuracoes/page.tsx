import { getEscritorioConfig } from "@/lib/escritorio-db";
import ConfigForm from "@/components/dashboard/configuracoes/config-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const config = await getEscritorioConfig();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">
          Configurações
        </h1>
        <p className="font-body text-sm text-muted mt-1">
          Dados do escritório exibidos no papel timbrado dos documentos PDF.
        </p>
      </div>

      <ConfigForm config={config} />
    </div>
  );
}
