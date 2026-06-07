"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  ScalesIcon,
  HomeIcon,
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  ClipboardListIcon,
  UserPlusIcon,
  LogoutIcon,
  XMarkIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
  PrinterIcon,
  FunnelIcon,
  CalendarIcon,
  KanbanIcon,
  PenSignIcon,
  FileStackIcon,
  InboxArrowDownIcon,
  ClipboardCheckIcon,
  PuzzleIcon,
} from "@/components/icons";
import { hasPermission } from "@/lib/permissoes";
import type { SessionUser } from "@/lib/session";
import { logoutAction } from "@/lib/auth-actions";

const GROUPS: {
  label: string | null;
  items: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    modulo: string | null;
  }[];
}[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", icon: HomeIcon, label: "Dashboard", modulo: null },
    ],
  },
  {
    label: "Jurídico",
    items: [
      {
        href: "/dashboard/agenda",
        icon: CalendarIcon,
        label: "Agenda",
        modulo: "controles",
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
        href: "/dashboard/publicacoes",
        icon: InboxArrowDownIcon,
        label: "Publicações",
        modulo: "publicacoes",
      },
      {
        href: "/dashboard/controles",
        icon: ClipboardListIcon,
        label: "Controles",
        modulo: "controles",
      },
    ],
  },
  {
    label: "Negócios",
    items: [
      { href: "/dashboard/crm", icon: FunnelIcon, label: "CRM", modulo: "crm" },
      {
        href: "/dashboard/producao",
        icon: KanbanIcon,
        label: "Produção",
        modulo: "producao",
      },
      {
        href: "/dashboard/financeiro",
        icon: BanknotesIcon,
        label: "Financeiro",
        modulo: "financeiro",
      },
    ],
  },
  {
    label: "Documentos",
    items: [
      {
        href: "/dashboard/modelos",
        icon: DocumentTextIcon,
        label: "Modelos",
        modulo: "modelos",
      },
      {
        href: "/dashboard/assinaturas",
        icon: PenSignIcon,
        label: "Assinaturas",
        modulo: "assinaturas",
      },
      {
        href: "/dashboard/ferramentas-pdf",
        icon: FileStackIcon,
        label: "PDFs",
        modulo: null,
      },
    ],
  },
  {
    label: "Equipe",
    items: [
      {
        href: "/dashboard/colaboradores",
        icon: UserPlusIcon,
        label: "Colaboradores",
        modulo: "colaboradores",
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/dashboard/gerenciador",
        icon: ChartBarIcon,
        label: "Gerenciador",
        modulo: null,
      },
      {
        href: "/dashboard/gerenciador/auditoria",
        icon: ClipboardCheckIcon,
        label: "Auditoria",
        modulo: "gerenciador",
      },
      {
        href: "/dashboard/relatorios",
        icon: PrinterIcon,
        label: "Relatórios",
        modulo: "relatorios",
      },
      {
        href: "/dashboard/integracoes",
        icon: PuzzleIcon,
        label: "Integrações",
        modulo: "gerenciador",
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
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}

export default function Sidebar({ open, onClose, user }: SidebarProps) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    visibleItems: group.items.filter(
      ({ modulo }) => modulo === null || hasPermission(user, modulo, "ver")
    ),
  })).filter((group) => group.visibleItems.length > 0);

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  const initials = user.login.slice(0, 2).toUpperCase();
  const displayName = user.login.charAt(0).toUpperCase() + user.login.slice(1);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-20 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-shrink-0 flex-col bg-primary shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header: logo + close */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <ScalesIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-xl font-semibold text-white">
              AdvMartins
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* User info card */}
        <div className="mx-3 mb-2 rounded-xl bg-white/10 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 font-heading text-sm font-bold text-white select-none">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-white">
                {displayName}
              </p>
              <p className="font-body text-[11px] text-white/60">
                {user.categoria}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 border-t border-white/10" />

        {/* Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-primary focus:outline-none"
        >
          Ir para o conteúdo
        </a>

        {/* Nav */}
        <nav
          className="relative flex-1 overflow-y-auto px-2 py-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent_100%)]"
          aria-label="Menu principal"
        >
          {visibleGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-4" : ""}>
              {group.label && (
                <p className="mb-1 px-3 font-body text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.visibleItems.map(({ href, icon: Icon, label }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm transition-colors duration-150 ${
                          active
                            ? "bg-white/20 font-semibold text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${active ? "text-white" : "text-white/60"}`}
                        />
                        {label}
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="mx-2 mb-4 border-t border-white/10 pt-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          >
            <LogoutIcon className="h-4 w-4 flex-shrink-0" />
            Sair da conta
          </button>
        </div>
      </aside>
    </>
  );
}
