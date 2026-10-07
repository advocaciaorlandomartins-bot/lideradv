import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBrandingSrcs } from "@/lib/branding";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { iconSrc } = await getBrandingSrcs();

  return (
    <DashboardShell user={user} iconSrc={iconSrc}>
      {children}
    </DashboardShell>
  );
}
