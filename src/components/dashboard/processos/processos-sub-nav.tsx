"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpenIcon,
  InboxArrowDownIcon,
  WifiIcon,
  ClipboardListIcon,
} from "@/components/icons";

const TABS = [
  {
    href: "/dashboard/processos",
    label: "Lista de Processos",
    icon: FolderOpenIcon,
    exact: true,
  },
  {
    href: "/dashboard/processos/intimacoes",
    label: "Intimações",
    icon: InboxArrowDownIcon,
    exact: false,
  },
  {
    href: "/dashboard/processos/central-captura",
    label: "Monitoramento",
    icon: WifiIcon,
    exact: false,
  },
  {
    href: "/dashboard/processos/andamentos",
    label: "Andamentos",
    icon: ClipboardListIcon,
    exact: false,
  },
] as const;

export default function ProcessosSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-sm">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-body text-sm font-semibold transition-all duration-150 ${
              active
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-slate-50 hover:text-fg"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
