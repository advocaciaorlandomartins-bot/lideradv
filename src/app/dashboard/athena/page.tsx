import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import AthenaChat from "@/components/dashboard/athena/athena-chat";

export const metadata = {
  title: "Athena IA — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function AthenaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) notFound();

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col space-y-4 lg:h-[calc(100dvh-6rem)]">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-fg">
          Athena IA
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Pergunte sobre ranking, carga da equipe e capacidade produtiva —
          Athena responde com os dados reais e atuais do escritório.
        </p>
      </div>
      <AthenaChat />
    </div>
  );
}
