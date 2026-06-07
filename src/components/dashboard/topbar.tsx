"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { hasPermission } from "@/lib/permissoes";
import type { SessionUser } from "@/lib/session";
import {
  ScalesIcon,
  HomeIcon,
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  ClipboardListIcon,
  DocumentTextIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
  PrinterIcon,
  FunnelIcon,
  KanbanIcon,
  CalendarIcon,
  PuzzleIcon,
  InboxArrowDownIcon,
  FileStackIcon,
  PenSignIcon,
} from "@/components/icons";

// Itens principais do menu (sem Usuários e Configurações)
const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: HomeIcon,
    label: "Dashboard",
    modulo: "dashboard",
  },
  {
    href: "/dashboard/agenda",
    icon: CalendarIcon,
    label: "Agenda",
    modulo: "controles",
  },
  {
    href: "/dashboard/crm",
    icon: FunnelIcon,
    label: "CRM",
    modulo: "crm",
  },
  {
    href: "/dashboard/producao",
    icon: KanbanIcon,
    label: "Produção",
    modulo: "producao",
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
  {
    href: "/dashboard/colaboradores",
    icon: UserPlusIcon,
    label: "Colaboradores",
    modulo: "colaboradores",
  },
] as const;

// Sub-itens do dropdown Gerenciador
const GERENCIADOR_SUBS = [
  {
    href: "/dashboard/gerenciador",
    icon: ChartBarIcon,
    label: "Gerenciador",
    modulo: "gerenciador",
  },
  {
    href: "/dashboard/gerenciador/auditoria",
    icon: ClipboardListIcon,
    label: "Log de Auditoria",
    modulo: "gerenciador",
  },
  {
    href: "/dashboard/relatorios",
    icon: PrinterIcon,
    label: "Relatórios",
    modulo: null,
  },
  {
    href: "/dashboard/integracoes",
    icon: PuzzleIcon,
    label: "Integrações",
    modulo: "configuracoes",
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

// Chevron inline (não precisa importar icon separado)
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Topbar({
  user,
  onMenuOpen,
}: {
  user: SessionUser;
  onMenuOpen?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [userOpen, setUserOpen] = useState(false);
  const [gerOpen, setGerOpen] = useState(false);
  const pathname = usePathname();
  const gerRef = useRef<HTMLLIElement>(null);

  // Fecha dropdown do Gerenciador ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (gerRef.current && !gerRef.current.contains(e.target as Node)) {
        setGerOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    ({ modulo }) => modulo === null || hasPermission(user, modulo, "ver")
  );

  const visibleGerSubs = GERENCIADOR_SUBS.filter(
    ({ modulo }) => modulo === null || hasPermission(user, modulo, "ver")
  );

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  // Gerenciador está "ativo" se qualquer sub-item estiver ativo
  const gerActive = visibleGerSubs.some(({ href }) => isActive(href));

  return (
    <header className="sticky top-0 z-30 flex-shrink-0 bg-primary shadow-md lg:hidden">
      {/* ── Linha 1: logo + hambúrguer (mobile) + usuário ───────────────── */}
      <div className="flex h-12 items-center justify-between px-4 lg:px-6">
        {/* Logo + hambúrguer */}
        <div className="flex items-center gap-3">
          {/* Hambúrguer — só mobile */}
          <button
            type="button"
            onClick={onMenuOpen}
            aria-label="Abrir menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
              <ScalesIcon className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading text-base font-semibold text-white">
              AdvMartins
            </span>
          </Link>
        </div>

        {/* Usuário */}
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/10"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 font-heading text-xs font-bold text-white select-none">
              {user.login.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden leading-tight text-left sm:block">
              <p className="font-body text-xs font-semibold text-white">
                {user.login.charAt(0).toUpperCase() + user.login.slice(1)}
              </p>
              <p className="font-body text-[10px] text-white/60">
                {user.categoria}
              </p>
            </div>
            <Chevron open={userOpen} />
          </button>

          {userOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setUserOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="font-body text-xs font-semibold text-fg">
                    {user.login.charAt(0).toUpperCase() + user.login.slice(1)}
                  </p>
                  <p className="font-body text-[11px] text-muted">
                    {user.categoria}
                  </p>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={pending}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 9a9 9 0 110-18"
                      />
                    </svg>
                    {pending ? "Saindo…" : "Sair"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Linha 2: navegação — oculta no mobile, visível no desktop ─────── */}
      <nav
        className="hidden border-t border-white/10 px-2 py-1 lg:block"
        aria-label="Menu principal"
      >
        <ul className="flex flex-wrap gap-0.5">
          {/* Itens normais */}
          {visibleItems.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`
                    flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm
                    transition-colors duration-150 whitespace-nowrap
                    ${
                      active
                        ? "bg-white/20 font-semibold text-white"
                        : "font-medium text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                  {active && (
                    <span className="ml-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
                  )}
                </Link>
              </li>
            );
          })}

          {/* Gerenciador — dropdown com sub-itens */}
          {visibleGerSubs.length > 0 && (
            <li ref={gerRef} className="relative">
              <button
                type="button"
                onClick={() => setGerOpen((v) => !v)}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm
                  transition-colors duration-150 whitespace-nowrap
                  ${
                    gerActive || gerOpen
                      ? "bg-white/20 font-semibold text-white"
                      : "font-medium text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <ChartBarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                Gerenciador
                <Chevron open={gerOpen} />
                {gerActive && !gerOpen && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
                )}
              </button>

              {/* Dropdown */}
              {gerOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                  {visibleGerSubs.map(({ href, icon: Icon, label }, idx) => {
                    const active = isActive(href);
                    const isFirst = idx === 0;
                    const isLast = idx === visibleGerSubs.length - 1;
                    return (
                      <>
                        {/* Separador visual entre Gerenciador e os itens de admin */}
                        {idx === 1 && (
                          <div
                            key="sep"
                            className="mx-3 border-t border-border"
                          />
                        )}
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setGerOpen(false)}
                          className={`
                            flex items-center gap-2.5 px-4 py-2.5 font-body text-sm transition-colors
                            ${
                              active
                                ? "bg-primary/5 font-semibold text-primary"
                                : "text-fg hover:bg-slate-50"
                            }
                            ${isFirst ? "pt-3" : ""}
                            ${isLast ? "pb-3" : ""}
                          `}
                        >
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : "text-muted"}`}
                          />
                          {label}
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </Link>
                      </>
                    );
                  })}
                </div>
              )}
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
