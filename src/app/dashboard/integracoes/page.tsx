import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import IntegracoesContent from "@/components/dashboard/integracoes/integracoes-content";

export const metadata = { title: "Integrações — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "gerenciador", "ver")) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Integrações
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Conecte o sistema com serviços externos para automatizar cobranças,
          calendário e assinaturas.
        </p>
      </div>
      <IntegracoesContent />
    </div>
  );
}
