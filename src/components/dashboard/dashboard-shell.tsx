"use client";

import { useState } from "react";
import Topbar from "@/components/dashboard/topbar";
import Sidebar from "@/components/dashboard/sidebar";
import type { SessionUser } from "@/lib/session";

export default function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Topbar user={user} onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
      />
      <main id="main-content" className="flex-1 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
