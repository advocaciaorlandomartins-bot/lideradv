"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ClienteDocumentoPendente } from "@/lib/clients-db";
import {
  MagnifyingGlassIcon,
  PhoneIcon,
  MailIcon,
  AlertIcon,
  ChevronRightIcon,
  FolderOpenIcon,
} from "@/components/icons";

function avatarColor(name: string) {
  const colors = [
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DocumentosPendentesContent({
  clientes,
}: {
  clientes: ClienteDocumentoPendente[];
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientes, busca]);

  const totalItensFaltando = clientes.reduce(
    (s, c) => s + c.itensFaltando.length,
    0
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Clientes com pendência
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-amber-600">
            {clientes.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Documentos faltando (total)
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-amber-600">
            {totalItensFaltando}
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg focus:border-primary focus:outline-none sm:max-w-xs"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white py-16 text-center">
          <AlertIcon className="h-8 w-8 text-emerald-400" />
          <p className="font-body text-sm text-muted">
            {clientes.length === 0
              ? "Nenhum cliente com documento pendente — tudo completo."
              : "Nenhum cliente encontrado pra essa busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(c.name)}`}
                  >
                    {initials(c.name)}
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-fg">
                      {c.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-xs text-muted">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <MailIcon className="h-3 w-3" />
                          {c.email}
                        </span>
                      )}
                      {c.processos > 0 && (
                        <span className="flex items-center gap-1">
                          <FolderOpenIcon className="h-3 w-3" />
                          {c.processos} processo{c.processos !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-body text-xs font-semibold text-amber-700">
                    Faltam {c.itensFaltando.length} de {c.totalItens}
                  </span>
                  <Link
                    href={`/dashboard/clientes/${c.id}`}
                    className="flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                  >
                    Abrir
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {c.itensFaltando.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-md bg-white px-2 py-1 font-body text-xs text-amber-800 ring-1 ring-amber-200"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
