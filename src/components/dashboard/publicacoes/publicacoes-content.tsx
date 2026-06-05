"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import type { Publicacao } from "@/lib/publicacoes-db";
import {
  marcarComoTratadaAction,
  marcarComoNaoLidaAction,
  marcarTodasComoTratadasAction,
} from "@/lib/publicacoes-actions";
import { SpinnerIcon } from "@/components/icons";

// ── Helpers ───────────────────────────────────────────────────────────────────

type Tab = "automatica" | "manual" | "oabs" | "status_sys";
type StatusFilter = "nao_lida" | "tratada";

// ── Row Actions ───────────────────────────────────────────────────────────────

function RowActions({ pub }: { pub: Publicacao }) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);

  function handleTratar() {
    setAction("tratar");
    startTransition(async () => {
      await marcarComoTratadaAction(pub.id);
      setAction(null);
    });
  }

  function handleDesfazer() {
    setAction("desfazer");
    startTransition(async () => {
      await marcarComoNaoLidaAction(pub.id);
      setAction(null);
    });
  }

  const loading = isPending && action !== null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-body text-[11px] text-muted">
        #{pub.id} · {pub.tipo}
      </span>
      <div className="flex flex-wrap justify-center gap-1">
        <Link
          href={`/dashboard/publicacoes/${pub.id}`}
          className="flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
        >
          Abrir
        </Link>

        {pub.status === "nao_lida" ? (
          <button
            onClick={handleTratar}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            {loading && action === "tratar" ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : null}
            Tratada
          </button>
        ) : (
          <button
            onClick={handleDesfazer}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-body text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            {loading && action === "desfazer" ? (
              <SpinnerIcon className="h-3 w-3" />
            ) : null}
            Desfazer
          </button>
        )}

        <Link
          href={`/dashboard/controles/novo`}
          className="flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          + Atividade
        </Link>
      </div>
    </div>
  );
}

// ── Bulk actions ──────────────────────────────────────────────────────────────

function BulkActions({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();

  function handleTratarTodas() {
    if (
      !confirm(`Marcar todas as ${count} publicações não lidas como tratadas?`)
    )
      return;
    startTransition(() => marcarTodasComoTratadasAction());
  }

  if (count === 0) return null;

  return (
    <button
      onClick={handleTratarTodas}
      disabled={isPending}
      className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
    >
      {isPending ? <SpinnerIcon className="h-3 w-3" /> : "✅"}
      Marcar todas as {count} não lidas como tratadas
    </button>
  );
}

// ── Copy table ────────────────────────────────────────────────────────────────

function copiarTabela(publicacoes: Publicacao[]) {
  const header = [
    "#",
    "Processo",
    "Tipo",
    "Destinatário",
    "Advogados",
    "Órgão",
    "Tribunal",
    "Disponibilização",
    "Status",
  ];
  const rows = publicacoes.map((p) => [
    String(p.id),
    p.processo,
    p.tipo,
    p.destinatario,
    p.advogados.join(" / "),
    p.orgao,
    p.tribunal,
    p.disponibilizacao,
    p.status === "nao_lida" ? "Não lida" : "Tratada",
  ]);
  const text = [header, ...rows].map((r) => r.join("\t")).join("\n");
  navigator.clipboard.writeText(text).catch(() => null);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublicacoesContent({
  publicacoes: initial,
}: {
  publicacoes: Publicacao[];
}) {
  const [tab, setTab] = useState<Tab>("automatica");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("nao_lida");
  const [copied, setCopied] = useState(false);

  const naoLidas = useMemo(
    () => initial.filter((p) => p.status === "nao_lida"),
    [initial]
  );
  const tratadas = useMemo(
    () => initial.filter((p) => p.status === "tratada"),
    [initial]
  );
  const exibindo = statusFilter === "nao_lida" ? naoLidas : tratadas;

  function handleCopiar() {
    copiarTabela(exibindo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TABS = [
    {
      key: "automatica" as Tab,
      label: "Automática",
      sublabel: "Busca automática",
      badge: naoLidas.length,
    },
    { key: "manual" as Tab, label: "Manual", sublabel: "Busca manual" },
    { key: "oabs" as Tab, label: "OABs", sublabel: "OABs acompanhadas" },
    { key: "status_sys" as Tab, label: "Status" },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-100 text-fg"
                : "text-muted hover:bg-slate-50 hover:text-fg"
            }`}
          >
            {t.label}
            {t.sublabel && (
              <span className="font-body text-[11px] text-muted">
                — {t.sublabel}
              </span>
            )}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cta px-1.5 font-body text-[10px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab !== "automatica" ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="font-body text-sm text-muted">
            Em desenvolvimento — em breve.
          </p>
        </div>
      ) : (
        <>
          {/* Aviso */}
          {naoLidas.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">
              ⚠️ Há <strong>{naoLidas.length} publicações não tratadas</strong>{" "}
              no escritório. Novas publicações são buscadas{" "}
              <strong>diariamente</strong> de forma automática e enviadas por
              e-mail aos membros do escritório.
            </div>
          )}

          {/* Filtro de status + bulk action */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter("nao_lida")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                statusFilter === "nao_lida"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-border bg-white text-muted hover:border-amber-200 hover:text-amber-700"
              }`}
            >
              Não lidas
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold ${
                  statusFilter === "nao_lida"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {naoLidas.length}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("tratada")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                statusFilter === "tratada"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-border bg-white text-muted hover:border-emerald-200 hover:text-emerald-700"
              }`}
            >
              Tratadas
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold ${
                  statusFilter === "tratada"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {tratadas.length}
              </span>
            </button>

            {statusFilter === "nao_lida" && (
              <BulkActions count={naoLidas.length} />
            )}
          </div>

          {/* Contagem */}
          <p className="font-body text-xs text-muted">
            {exibindo.length} publicação{exibindo.length !== 1 ? "ões" : ""}{" "}
            encontrada{exibindo.length !== 1 ? "s" : ""}
            {exibindo.length > 0 && ` · Mostrando de 1 a ${exibindo.length}`}
          </p>

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            {/* Cabeçalho da tabela */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="font-heading text-sm font-semibold text-fg">
                Publicações
              </span>
              <button
                onClick={handleCopiar}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 font-body text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                {copied ? "✓ Copiado!" : "📋 Copiar tabela"}
              </button>
            </div>

            {exibindo.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <span className="text-4xl">
                  {statusFilter === "nao_lida" ? "📭" : "✅"}
                </span>
                <p className="font-body text-sm font-semibold text-muted">
                  {statusFilter === "nao_lida"
                    ? "Nenhuma publicação não lida."
                    : "Nenhuma publicação tratada ainda."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/60">
                      {[
                        "Processo",
                        "Destinatário",
                        "Advogados",
                        "Órgão",
                        "Disponibilização",
                        "Status / Ações",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left font-body text-[11px] font-semibold uppercase tracking-wide text-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {exibindo.map((pub) => (
                      <tr
                        key={pub.id}
                        className={`transition-colors ${
                          pub.status === "nao_lida"
                            ? "bg-amber-50/30 hover:bg-amber-50/60"
                            : "hover:bg-primary/5"
                        }`}
                      >
                        {/* Processo */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-[13px] text-fg">
                            {pub.processo}
                          </span>
                        </td>

                        {/* Destinatário */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                            <span className="font-body text-sm text-fg">
                              {pub.destinatario}
                            </span>
                          </div>
                        </td>

                        {/* Advogados */}
                        <td className="px-4 py-3">
                          {pub.advogados.map((adv, i) => (
                            <span
                              key={i}
                              className={`block font-body text-[13px] ${
                                i === 0
                                  ? "font-semibold text-cta"
                                  : "text-muted"
                              }`}
                            >
                              {adv}
                            </span>
                          ))}
                        </td>

                        {/* Órgão */}
                        <td className="px-4 py-3">
                          <div className="font-body text-[13px] text-fg">
                            {pub.orgao}
                          </div>
                          <div className="font-body text-[11px] text-muted">
                            {pub.tribunal}
                          </div>
                        </td>

                        {/* Disponibilização + status badge */}
                        <td className="whitespace-nowrap px-4 py-3">
                          {pub.status === "nao_lida" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/70 px-2.5 py-0.5 font-body text-[11px] font-medium text-amber-700 shadow-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Não lida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-[11px] font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Tratada
                            </span>
                          )}
                          <div className="mt-1 font-body text-[11px] text-muted">
                            {pub.disponibilizacao}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <RowActions pub={pub} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
