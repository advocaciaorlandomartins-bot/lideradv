"use client";

import Topbar from "@/components/dashboard/topbar";
import type { SessionUser } from "@/lib/session";

export default function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Topbar user={user} />
      <main id="main-content" className="flex-1 p-5 lg:p-8">
        {children}
      </main>
    </div>
  );
}
