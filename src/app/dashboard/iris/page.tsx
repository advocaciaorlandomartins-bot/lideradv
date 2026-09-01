import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import IrisChat from "@/components/dashboard/iris/iris-chat";

export const metadata = {
  title: "Íris IA — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function IrisPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) notFound();

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col space-y-4 lg:h-[calc(100dvh-6rem)]">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-fg">
          Íris IA
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Pergunte sobre agenda, audiências, prazos, equipe e produtividade —
          Íris responde com os dados reais e atuais do escritório.
        </p>
      </div>
      <IrisChat />
    </div>
  );
}
