"use client";

import { useTransition } from "react";
import { Bars3Icon } from "@/components/icons";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/session";

interface TopbarProps {
  onMenuClick: () => void;
  user: SessionUser;
}

function initials(login: string): string {
  return login.slice(0, 2).toUpperCase();
}

export default function Topbar({ onMenuClick, user }: TopbarProps) {
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-white px-5 lg:px-8">
      {/* Left: hamburger + brand (mobile) */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-slate-100 hover:text-fg focus:outline-none focus:ring-2 focus:ring-blue-200 lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <span className="font-heading text-lg font-semibold text-fg lg:hidden">
          AdvMartins
        </span>
      </div>

      {/* Right: user + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-body text-sm font-bold text-white select-none">
            {initials(user.login)}
          </div>
          <div className="hidden md:flex md:flex-col md:leading-tight">
            <span className="font-body text-sm font-semibold text-fg">
              {user.login}
            </span>
            <span className="font-body text-xs text-muted">
              {user.categoria}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={pending}
          title="Sair"
          className="cursor-pointer rounded-lg border border-border px-3 h-8 font-body text-xs font-semibold text-muted transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {pending ? "…" : "Sair"}
        </button>
      </div>
    </header>
  );
}
