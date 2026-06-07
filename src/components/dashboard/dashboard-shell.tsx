"use client";

import { useState } from "react";
import Topbar from "@/components/dashboard/topbar";
import Sidebar from "@/components/dashboard/sidebar";
import BottomNav from "@/components/dashboard/bottom-nav";
import type { SessionUser } from "@/lib/session";

export default function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-collapsed") === "true"
  );

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Topbar user={user} onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main
        id="main-content"
        className={`flex-1 p-4 pb-20 transition-[margin] duration-300 lg:p-8 lg:pb-8 ${
          collapsed ? "lg:ml-16" : "lg:ml-72"
        }`}
      >
        {children}
      </main>
      <BottomNav onMenuOpen={() => setSidebarOpen(true)} />
    </div>
  );
}
