"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  Bars3Icon,
} from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", icon: HomeIcon, label: "Início", exact: true },
  {
    href: "/dashboard/clientes",
    icon: UsersIcon,
    label: "Clientes",
    exact: false,
  },
  {
    href: "/dashboard/processos",
    icon: FolderOpenIcon,
    label: "Processos",
    exact: false,
  },
  {
    href: "/dashboard/financeiro",
    icon: BanknotesIcon,
    label: "Financeiro",
    exact: false,
  },
] as const;

export default function BottomNav({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-border bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.07)] lg:hidden"
      aria-label="Navegação inferior"
    >
      {ITEMS.map(({ href, icon: Icon, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? "text-primary" : "text-slate-400 hover:text-fg"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
            )}
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span
              className={`font-body text-[10px] ${active ? "font-semibold text-primary" : "font-medium"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMenuOpen}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-400 transition-colors hover:text-fg"
        aria-label="Abrir menu completo"
      >
        <Bars3Icon className="h-5 w-5 flex-shrink-0" />
        <span className="font-body text-[10px] font-medium">Menu</span>
      </button>
    </nav>
  );
}
