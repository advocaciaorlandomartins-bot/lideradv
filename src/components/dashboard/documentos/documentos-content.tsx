"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DocumentoGlobal } from "@/lib/documents-db";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  UsersIcon,
  FolderOpenIcon,
} from "@/components/icons";

function fmtTamanho(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensao(nome: string): string {
  const m = nome.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toUpperCase() : "—";
}

export default function DocumentosContent({
  documentos,
}: {
  documentos: DocumentoGlobal[];
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        (d.clienteNome ?? "").toLowerCase().includes(q) ||
        (d.processoNumero ?? "").toLowerCase().includes(q) ||
        (d.processoTipoAcao ?? "").toLowerCase().includes(q)
    );
  }, [documentos, busca]);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por arquivo, cliente ou processo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <span className="font-body text-xs text-muted">
          {filtrados.length} arquivo{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <p className="px-5 py-10 text-center font-body text-sm text-muted">
          {documentos.length === 0
            ? "Nenhum documento anexado ainda."
            : "Nenhum arquivo bate com essa busca."}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {filtrados.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <DocumentTextIcon className="h-4.5 w-4.5 text-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-fg">
                  {d.nome}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-xs text-muted">
                  {d.clienteId && (
                    <Link
                      href={`/dashboard/clientes/${d.clienteId}`}
                      className="flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      <UsersIcon className="h-3 w-3" />
                      {d.clienteNome}
                    </Link>
                  )}
                  {d.processoId && (
                    <Link
                      href={`/dashboard/processos/${d.processoId}`}
                      className="flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      <FolderOpenIcon className="h-3 w-3" />
                      {d.processoNumero || d.processoTipoAcao || "Processo"}
                    </Link>
                  )}
                  <span>{extensao(d.nome)}</span>
                  <span>{fmtTamanho(d.tamanho)}</span>
                  <span>{d.created_at_formatted}</span>
                </div>
              </div>
              <a
                href={`/api/documentos/download?id=${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                title="Baixar"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
