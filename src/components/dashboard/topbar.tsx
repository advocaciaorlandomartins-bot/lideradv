"use client";

import { BellIcon, Bars3Icon } from "@/components/icons";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
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

      {/* Right: notification + user */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          aria-label="Notificações"
          className="relative cursor-pointer rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-slate-100 hover:text-fg focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <BellIcon className="h-5 w-5" />
          {/* Badge */}
          <span
            aria-label="3 notificações"
            className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cta font-body text-[10px] font-bold text-white"
          >
            3
          </span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-body text-sm font-bold text-white">
            OM
          </div>
          <span className="hidden font-body text-sm font-semibold text-fg md:block">
            Dr. Orlando Martins
          </span>
        </div>
      </div>
    </header>
  );
}
