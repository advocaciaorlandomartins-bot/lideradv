"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBarIcon, ClipboardListIcon } from "@/components/icons";

const TABS = [
  {
    href: "/dashboard/gerenciador",
    label: "Visão Geral",
    icon: ChartBarIcon,
    exact: true,
  },
  {
    href: "/dashboard/gerenciador/auditoria",
    label: "Log de Auditoria",
    icon: ClipboardListIcon,
    exact: false,
  },
] as const;

export default function GerenciadorTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 border-b border-border bg-white">
      <nav className="flex gap-0" aria-label="Seções do gerenciador">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`
                inline-flex items-center gap-2 px-5 py-3 font-body text-sm font-medium
                border-b-2 transition-colors duration-150 whitespace-nowrap
                ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-fg hover:border-slate-300"
                }
              `}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
