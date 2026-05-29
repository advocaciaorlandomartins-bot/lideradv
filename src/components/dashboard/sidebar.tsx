"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScalesIcon,
  HomeIcon,
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  ClipboardListIcon,
  UserPlusIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  LogoutIcon,
  XMarkIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
} from "@/components/icons";
import { hasPermission } from "@/lib/permissoes";
import type { SessionUser } from "@/lib/session";

const NAV_ITEMS = [
  { href: "/dashboard", icon: HomeIcon, label: "Dashboard", modulo: null },
  {
    href: "/dashboard/gerenciador",
    icon: ChartBarIcon,
    label: "Gerenciador",
    modulo: null,
  },
  {
    href: "/dashboard/clientes",
    icon: UsersIcon,
    label: "Clientes",
    modulo: "clientes",
  },
  {
    href: "/dashboard/processos",
    icon: FolderOpenIcon,
    label: "Processos",
    modulo: "processos",
  },
  {
    href: "/dashboard/financeiro",
    icon: BanknotesIcon,
    label: "Financeiro",
    modulo: "financeiro",
  },
  {
    href: "/dashboard/controles",
    icon: ClipboardListIcon,
    label: "Controles",
    modulo: "controles",
  },
  {
    href: "/dashboard/modelos",
    icon: DocumentTextIcon,
    label: "Modelos",
    modulo: "modelos",
  },
  {
    href: "/dashboard/colaboradores",
    icon: UserPlusIcon,
    label: "Colaboradores",
    modulo: "colaboradores",
  },
  {
    href: "/dashboard/senhas",
    icon: LockClosedIcon,
    label: "Cofre de Senhas",
    modulo: null,
  },
  {
    href: "/dashboard/oab",
    icon: MagnifyingGlassIcon,
    label: "Busca OAB",
    modulo: null,
  },
  {
    href: "/dashboard/usuarios",
    icon: ShieldCheckIcon,
    label: "Usuários",
    modulo: "usuarios",
  },
  {
    href: "/dashboard/configuracoes",
    icon: CogIcon,
    label: "Configurações",
    modulo: "configuracoes",
  },
] as const;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}

export default function Sidebar({ open, onClose, user }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    ({ modulo }) => modulo === null || hasPermission(user, modulo, "ver")
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-20 bg-black/40 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-shrink-0 flex-col bg-primary transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <ScalesIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-xl font-semibold text-white">
              AdvMartins
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="cursor-pointer text-white/60 transition-colors duration-150 hover:text-white lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 border-t border-white/15" />

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Menu principal"
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-primary focus:outline-none"
          >
            Ir para o conteúdo
          </a>

          <ul className="space-y-0.5">
            {visibleItems.map(({ href, icon: Icon, label }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm transition-colors duration-150 ${
                      isActive
                        ? "bg-white/20 font-semibold text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="mx-3 mb-4 border-t border-white/15 pt-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          >
            <LogoutIcon className="h-5 w-5 flex-shrink-0" />
            Sair
          </Link>
        </div>
      </aside>
    </>
  );
}
