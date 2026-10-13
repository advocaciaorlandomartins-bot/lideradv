import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBrandingSrcs } from "@/lib/branding";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getSession() e getBrandingSrcs() são buscas independentes no banco —
  // rodar em paralelo em vez de uma depois da outra corta uma viagem de
  // ida-e-volta inteira do tempo de carregamento de TODA página do
  // dashboard (esse layout roda em todas elas).
  const [user, { iconSrc }] = await Promise.all([
    getSession(),
    getBrandingSrcs(),
  ]);
  if (!user) redirect("/login");

  return (
    <DashboardShell user={user} iconSrc={iconSrc}>
      {children}
    </DashboardShell>
  );
}
