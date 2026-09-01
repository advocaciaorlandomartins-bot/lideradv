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

  const isAdmin = hasPermission(session, "configuracoes", "editar");

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col space-y-4 lg:h-[calc(100dvh-6rem)]">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-fg">
          Íris IA
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          A única IA do sistema — tira dúvidas de uso, mostra dados reais
          (agenda, equipe, financeiro, produtividade)
          {isAdmin &&
            " e executa ações reais (sincronizar publicações, reenviar mensagens, gerenciar OABs, dados do escritório)"}
          .
        </p>
      </div>
      <IrisChat isAdmin={isAdmin} />
    </div>
  );
}
