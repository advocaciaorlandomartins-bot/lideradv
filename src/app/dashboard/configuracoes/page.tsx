import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getAllComissoesConfig } from "@/lib/comissoes-config-db";
import ConfigTabs from "@/components/dashboard/configuracoes/config-tabs";

export const metadata = { title: "Configurações — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "configuracoes", "ver")) notFound();

  const [config, comissoes] = await Promise.all([
    getEscritorioConfig(),
    getAllComissoesConfig(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">
          Configurações
        </h1>
        <p className="font-body text-sm text-muted mt-1">
          Dados do escritório, regras de comissão e metas de desempenho.
        </p>
      </div>

      <ConfigTabs config={config} comissoes={comissoes} />
    </div>
  );
}
