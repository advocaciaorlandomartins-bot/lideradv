"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Publicacao } from "@/lib/publicacoes-db";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import {
  InboxArrowDownIcon,
  CalendarIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";

type StatusFilter = "todos" | "urgente" | "pendente" | "tratada";

function diasRestantes(disponibilizacao: string, prazo_dias = 15): number {
  // disponibilizacao vem como "DD/MM/YYYY"
  const [d, m, y] = disponibilizacao.split("/");
  const pub = new Date(Number(y), Number(m) - 1, Number(d));
  const prazo = new Date(pub);
  prazo.setDate(prazo.getDate() + prazo_dias);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000);
}

function statusDe(pub: Publicacao): "urgente" | "pendente" | "tratada" {
  if (pub.status === "tratada") return "tratada";
  const dias = pub.resumo_ia?.prazo_dias ?? diasRestantes(pub.disponibilizacao);
  if (dias <= 5) return "urgente";
  return "pendente";
}

function StatusChip({ dias, status }: { dias: number; status: string }) {
  if (status === "tratada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-slate-500">
        <CheckIcon className="h-3 w-3" />
        Tratada
      </span>
    );
  if (dias <= 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Prazo vencido
      </span>
    );
  if (dias <= 5)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-body text-xs font-semibold text-red-700">
        <AlertIcon className="h-3 w-3" />
        Urgente · {dias}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-body text-xs font-semibold text-amber-700">
      <ClockIcon className="h-3 w-3" />
      Pendente · {dias}d
    </span>
  );
}

function KpiBtn({
  label,
  count,
  color,
  bg,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : `border-border ${bg} hover:border-primary/40`
      }`}
    >
      <p
        className={`font-body text-xs font-semibold uppercase tracking-wide ${
          active ? "text-primary" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          active ? "text-primary" : color
        }`}
      >
        {count}
      </p>
    </button>
  );
}

export default function IntimacoesContent({
  publicacoes,
}: {
  publicacoes: Publicacao[];
}) {
  const [filtro, setFiltro] = useState<StatusFilter>("todos");
  const [search, setSearch] = useState("");

  const { todos, urgentes, pendentes, tratadas } = useMemo(() => {
    const todos = publicacoes.length;
    const urgentes = publicacoes.filter(
      (p) => statusDe(p) === "urgente"
    ).length;
    const pendentes = publicacoes.filter(
      (p) => statusDe(p) === "pendente"
    ).length;
    const tratadas = publicacoes.filter(
      (p) => statusDe(p) === "tratada"
    ).length;
    return { todos, urgentes, pendentes, tratadas };
  }, [publicacoes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return publicacoes
      .filter((p) => {
        if (filtro !== "todos" && statusDe(p) !== filtro) return false;
        if (q) {
          return (
            p.processo.toLowerCase().includes(q) ||
            p.tipo.toLowerCase().includes(q) ||
            p.destinatario.toLowerCase().includes(q) ||
            p.orgao.toLowerCase().includes(q) ||
            p.advogados.some((a) => a.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Urgentes primeiro
        const sa =
          statusDe(a) === "urgente" ? 0 : statusDe(a) === "pendente" ? 1 : 2;
        const sb =
          statusDe(b) === "urgente" ? 0 : statusDe(b) === "pendente" ? 1 : 2;
        return sa - sb;
      });
  }, [publicacoes, filtro, search]);

  const KPIS: {
    key: StatusFilter;
    label: string;
    count: number;
    color: string;
    bg: string;
  }[] = [
    {
      key: "todos",
      label: "Total",
      count: todos,
      color: "text-fg",
      bg: "bg-white",
    },
    {
      key: "pendente",
      label: "Pendentes",
      count: pendentes,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      key: "urgente",
      label: "Urgentes",
      count: urgentes,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      key: "tratada",
      label: "Tratadas",
      count: tratadas,
      color: "text-slate-500",
      bg: "bg-slate-50",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Intimações
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {pendentes + urgentes} intimações aguardando resposta
        </p>
      </div>

      <ProcessosSubNav />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((k) => (
          <KpiBtn
            key={k.key}
            label={k.label}
            count={k.count}
            color={k.color}
            bg={k.bg}
            active={filtro === k.key}
            onClick={() => setFiltro(filtro === k.key ? "todos" : k.key)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <InboxArrowDownIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                {filtro === "todos"
                  ? "Todas as intimações"
                  : filtro === "tratada"
                    ? "Intimações tratadas"
                    : filtro === "urgente"
                      ? "Intimações urgentes"
                      : "Intimações pendentes"}
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "intimação" : "intimações"}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-52">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Buscar processo, cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {publicacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <InboxArrowDownIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma publicação cadastrada ainda.
            </p>
            <p className="font-body text-xs text-muted">
              Adicione OABs para monitorar em{" "}
              <Link
                href="/dashboard/publicacoes"
                className="font-semibold text-primary underline"
              >
                Publicações → OABs
              </Link>
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <InboxArrowDownIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma intimação encontrada
            </p>
            {filtro !== "todos" && (
              <button
                onClick={() => setFiltro("todos")}
                className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todas
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((pub) => {
              const st = statusDe(pub);
              const dias =
                pub.resumo_ia?.prazo_dias ??
                diasRestantes(pub.disponibilizacao);
              return (
                <div
                  key={pub.id}
                  className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 ${
                    st === "urgente"
                      ? "border-l-4 border-red-400"
                      : st === "pendente"
                        ? "border-l-4 border-amber-400"
                        : ""
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                      st === "urgente"
                        ? "bg-red-50"
                        : st === "tratada"
                          ? "bg-slate-100"
                          : "bg-amber-50"
                    }`}
                  >
                    <InboxArrowDownIcon
                      className={`h-5 w-5 ${
                        st === "urgente"
                          ? "text-red-500"
                          : st === "tratada"
                            ? "text-slate-400"
                            : "text-amber-600"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-sm font-semibold text-fg">
                        {pub.tipo}
                      </p>
                      <StatusChip dias={dias} status={st} />
                    </div>
                    <p className="font-body text-sm text-fg">
                      {pub.destinatario}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {pub.processo}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {pub.orgao} · {pub.tribunal}
                    </p>
                    {pub.conteudo && (
                      <p className="line-clamp-2 font-body text-xs text-muted">
                        {pub.conteudo}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 font-body text-xs text-muted">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      Publicado: {pub.disponibilizacao}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 font-body text-xs font-semibold ${
                        dias <= 5 ? "text-red-600" : "text-fg"
                      }`}
                    >
                      <ClockIcon className="h-3.5 w-3.5" />
                      Prazo: {dias <= 0 ? "Vencido" : `${dias}d`}
                    </div>
                    {pub.processo ? (
                      <Link
                        href={`/dashboard/processos?busca=${encodeURIComponent(pub.processo)}`}
                        className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        <FolderOpenIcon className="h-3.5 w-3.5" />
                        Ver processo
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-4 text-center">
          <FolderOpenIcon className="h-4 w-4 text-slate-300" />
          <p className="font-body text-xs text-muted">
            Publicações capturadas automaticamente via monitoramento de OABs.
            Configure em{" "}
            <Link
              href="/dashboard/publicacoes"
              className="font-semibold text-primary hover:underline"
            >
              Publicações → OABs
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
