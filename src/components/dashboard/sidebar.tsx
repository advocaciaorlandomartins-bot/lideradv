"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import Image from "next/image";
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
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
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
      {
        href: "/dashboard/pericias",
        icon: ScalesIcon,
        label: "Perícias",
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
        href: "/dashboard/minhas-tarefas",
        icon: CheckCircleIcon,
        label: "Minhas Tarefas",
        modulo: null,
      },
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
        modulo: "gerenciador",
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  open,
  onClose,
  user,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
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
      {/* Backdrop — mobile only */}
      <div
        className={`fixed inset-0 z-20 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`sidebar-bg fixed inset-y-0 left-0 z-30 flex flex-shrink-0 flex-col transition-all duration-300 ease-out lg:border-r lg:border-white/10 lg:shadow-none lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${collapsed ? "w-16" : "w-72"}`}
      >
        {/* Header: logo + toggle/close */}
        <div
          className={`flex h-16 flex-shrink-0 items-center px-3 ${
            collapsed ? "justify-center" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Image
                src="/logo1.png"
                alt="LiderAdv"
                width={42}
                height={42}
                className="drop-shadow-[0_0_8px_rgba(143,190,255,0.4)]"
                priority
              />
              <span className="font-body text-lg font-bold text-white tracking-wide">
                LiderAdv
              </span>
            </div>
          )}

          {collapsed && (
            <Image
              src="/logo1.png"
              alt="LiderAdv"
              width={34}
              height={34}
              className="drop-shadow-[0_0_6px_rgba(143,190,255,0.4)]"
              priority
            />
          )}

          {/* Toggle collapse — desktop only */}
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              aria-label="Recolher menu"
              className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:flex"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}

          {/* Close — mobile only */}
          {!collapsed && (
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Toggle expand — desktop only, shown when collapsed */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="mx-auto mb-2 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:flex"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}

        {/* User card */}
        {!collapsed ? (
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
        ) : (
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-heading text-sm font-bold text-white select-none">
            {initials}
          </div>
        )}

        <div
          className={`border-t border-white/10 ${collapsed ? "mx-2" : "mx-4"}`}
        />

        {/* Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-primary focus:outline-none"
        >
          Ir para o conteúdo
        </a>

        {/* Nav */}
        <nav
          className={`flex-1 overflow-y-auto py-3 ${
            collapsed
              ? "px-1 [mask-image:none]"
              : "px-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent_100%)]"
          }`}
          aria-label="Menu principal"
        >
          {collapsed ? (
            /* Collapsed: icon-only, centered, with tooltip */
            <ul className="space-y-0.5">
              {visibleGroups.flatMap((g) =>
                g.visibleItems.map(({ href, icon: Icon, label }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        title={label}
                        aria-label={label}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-center rounded-lg py-2.5 transition-colors duration-150 ${
                          active
                            ? "bg-white/20 text-white"
                            : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            /* Expanded: groups with labels */
            visibleGroups.map((group, gi) => (
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
            ))
          )}
        </nav>

        {/* Logout */}
        <div
          className={`mb-4 border-t border-white/10 pt-3 ${collapsed ? "mx-1" : "mx-2"}`}
        >
          <button
            onClick={handleLogout}
            title="Sair da conta"
            className={`flex w-full items-center rounded-lg font-body text-sm text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white ${
              collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogoutIcon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && "Sair da conta"}
          </button>
        </div>
      </aside>
    </>
  );
}
