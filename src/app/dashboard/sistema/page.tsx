import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import SistemaAgenteContent from "@/components/dashboard/sistema/sistema-agente-content";

export const metadata = { title: "Agente do Sistema — LiderAdv" };
export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "ver")) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">
          Agente do Sistema
        </h1>
        <p className="font-body text-sm text-muted mt-1">
          Diagnostique problemas, corrija erros e ajuste configurações sem
          precisar de código.
        </p>
      </div>
      <SistemaAgenteContent />
    </div>
  );
}
