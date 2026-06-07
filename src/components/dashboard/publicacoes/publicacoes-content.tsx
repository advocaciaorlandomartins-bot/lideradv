"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import type { Publicacao, OabMonitorada } from "@/lib/publicacoes-db";
import {
  marcarComoTratadaAction,
  marcarComoNaoLidaAction,
  marcarTodasComoTratadasAction,
  adicionarOabAction,
  toggleOabAction,
  removerOabAction,
} from "@/lib/publicacoes-actions";
import {
  SpinnerIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@/components/icons";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "automatica" | "manual" | "oabs" | "status_sys";
type StatusFilter = "nao_lida" | "tratada";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Publicacao["status"] }) {
  return status === "nao_lida" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/70 px-2.5 py-0.5 font-body text-[11px] font-medium text-amber-700 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Não lida
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-[11px] font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Tratada
    </span>
  );
}

// ── Row de publicação ─────────────────────────────────────────────────────────

function PublicacaoRow({ pub }: { pub: Publicacao }) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const loading = isPending && action !== null;

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

  return (
    <tr
      className={`transition-colors ${pub.status === "nao_lida" ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-primary/5"}`}
    >
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/publicacoes/${pub.id}`}
          className="font-mono text-[13px] text-primary hover:underline"
        >
          {pub.processo}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
          <span className="font-body text-sm text-fg">{pub.destinatario}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {pub.advogados.map((adv, i) => (
          <span
            key={i}
            className={`block font-body text-[13px] ${i === 0 ? "font-semibold text-cta" : "text-muted"}`}
          >
            {adv}
          </span>
        ))}
      </td>
      <td className="px-4 py-3">
        <div className="font-body text-[13px] text-fg">{pub.orgao}</div>
        <div className="font-body text-[11px] text-muted">{pub.tribunal}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <StatusBadge status={pub.status} />
        <div className="mt-1 font-body text-[11px] text-muted">
          {pub.disponibilizacao}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-center gap-2">
          <span className="font-body text-[11px] text-muted">
            #{pub.id} · {pub.tipo}
          </span>
          <div className="flex flex-wrap justify-center gap-1">
            <Link
              href={`/dashboard/publicacoes/${pub.id}`}
              className="rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
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
              href="/dashboard/controles/novo"
              className="rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
            >
              + Atividade
            </Link>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Tabela de publicações ─────────────────────────────────────────────────────

function TabelaPublicacoes({
  publicacoes,
  emptyMsg,
}: {
  publicacoes: Publicacao[];
  emptyMsg: string;
}) {
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(publicacoes.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = publicacoes.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1)
      pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  function copiar() {
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
    navigator.clipboard
      .writeText([header, ...rows].map((r) => r.join("\t")).join("\n"))
      .catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-heading text-sm font-semibold text-fg">
          Publicações
        </span>
        <button
          onClick={copiar}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 font-body text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          {copied ? "✓ Copiado!" : "📋 Copiar tabela"}
        </button>
      </div>
      {publicacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-4xl">📭</span>
          <p className="font-body text-sm font-semibold text-muted">
            {emptyMsg}
          </p>
        </div>
      ) : (
        <>
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
                {slice.map((pub) => (
                  <PublicacaoRow key={pub.id} pub={pub} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <div className="flex items-center gap-1">
              <span className="mr-1 font-body text-xs text-muted">Exibir:</span>
              {[10, 20, 50].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPageSize(s);
                    setPage(1);
                  }}
                  className={`h-7 min-w-[2rem] rounded px-1.5 font-body text-xs transition-colors cursor-pointer ${pageSize === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="mr-1 font-body text-xs text-muted">
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, publicacoes.length)} de{" "}
                {publicacoes.length}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={safePage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {pages.map((n, i) =>
                    n === "…" ? (
                      <span
                        key={`e-${i}`}
                        className="flex h-8 w-8 items-center justify-center font-body text-sm text-muted"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors ${n === safePage ? "bg-primary font-semibold text-white" : "border border-border text-muted hover:border-primary hover:text-primary"}`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={safePage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Automática ───────────────────────────────────────────────────────────

function TabAutomatica({ publicacoes }: { publicacoes: Publicacao[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("nao_lida");
  const [isPending, startTransition] = useTransition();

  const naoLidas = useMemo(
    () =>
      publicacoes.filter(
        (p) => p.status === "nao_lida" && p.origem === "automatica"
      ),
    [publicacoes]
  );
  const tratadas = useMemo(
    () =>
      publicacoes.filter(
        (p) => p.status === "tratada" && p.origem === "automatica"
      ),
    [publicacoes]
  );
  const exibindo = statusFilter === "nao_lida" ? naoLidas : tratadas;

  function handleTratarTodas() {
    if (
      !confirm(
        `Marcar todas as ${naoLidas.length} publicações não lidas como tratadas?`
      )
    )
      return;
    startTransition(() => marcarTodasComoTratadasAction());
  }

  return (
    <div className="space-y-4">
      {naoLidas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">
          ⚠️ Há <strong>{naoLidas.length} publicações não tratadas</strong> no
          escritório. Novas publicações são buscadas{" "}
          <strong>diariamente</strong> de forma automática e enviadas por e-mail
          aos membros do escritório.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("nao_lida")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${statusFilter === "nao_lida" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-white text-muted hover:border-amber-200"}`}
        >
          Não lidas
          <span
            className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold ${statusFilter === "nao_lida" ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-600"}`}
          >
            {naoLidas.length}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter("tratada")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${statusFilter === "tratada" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-border bg-white text-muted hover:border-emerald-200"}`}
        >
          Tratadas
          <span
            className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold ${statusFilter === "tratada" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}
          >
            {tratadas.length}
          </span>
        </button>
        {statusFilter === "nao_lida" && naoLidas.length > 0 && (
          <button
            onClick={handleTratarTodas}
            disabled={isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            {isPending ? <SpinnerIcon className="h-3 w-3" /> : "✅"}
            Marcar todas as {naoLidas.length} como tratadas
          </button>
        )}
      </div>

      <p className="font-body text-xs text-muted">
        {exibindo.length} publicação{exibindo.length !== 1 ? "ões" : ""} ·
        Mostrando {exibindo.length > 0 ? `1 a ${exibindo.length}` : "0"}
      </p>

      <TabelaPublicacoes
        publicacoes={exibindo}
        emptyMsg={
          statusFilter === "nao_lida"
            ? "Nenhuma publicação não lida."
            : "Nenhuma publicação tratada ainda."
        }
      />
    </div>
  );
}

// ── Tab: Manual ───────────────────────────────────────────────────────────────

function TabManual({ publicacoes }: { publicacoes: Publicacao[] }) {
  const [search, setSearch] = useState("");
  const [buscou, setBuscou] = useState(false);

  const resultados = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return publicacoes.filter(
      (p) =>
        p.processo.toLowerCase().includes(q) ||
        p.destinatario.toLowerCase().includes(q) ||
        p.advogados.some((a) => a.toLowerCase().includes(q)) ||
        p.orgao.toLowerCase().includes(q)
    );
  }, [publicacoes, search]);

  function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    setBuscou(true);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-sm font-semibold text-fg">
          Busca Manual de Publicações
        </h2>
        <form onSubmit={handleBusca} className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setBuscou(false);
              }}
              placeholder="Número do processo, destinatário, advogado ou órgão…"
              className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Buscar
          </button>
        </form>
        <p className="mt-2 font-body text-xs text-muted">
          Busca nas publicações já capturadas pelo sistema. Para buscar no
          DJe/PJe em tempo real, configure as OABs monitoradas na aba{" "}
          <strong>OABs</strong>.
        </p>
      </div>

      {buscou && search.trim() && (
        <>
          <p className="font-body text-xs text-muted">
            {resultados.length} resultado{resultados.length !== 1 ? "s" : ""}{" "}
            para &quot;{search}&quot;
          </p>
          <TabelaPublicacoes
            publicacoes={resultados}
            emptyMsg={`Nenhuma publicação encontrada para "${search}".`}
          />
        </>
      )}

      {!buscou && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="font-body text-sm text-muted">
            Digite um termo acima e clique em Buscar.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: OABs ─────────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

function TabOabs({ oabs }: { oabs: OabMonitorada[] }) {
  const [isPending, startTransition] = useTransition();
  const [numero, setNumero] = useState("");
  const [estado, setEstado] = useState("AL");
  const [nome, setNome] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim()) {
      setErro("Informe o número da OAB.");
      return;
    }
    setErro("");
    startTransition(async () => {
      await adicionarOabAction({ numero, estado, nome_advogado: nome });
      setNumero("");
      setNome("");
      setShowForm(false);
    });
  }

  function handleToggle(id: string, ativa: boolean) {
    startTransition(() => toggleOabAction(id, !ativa));
  }

  function handleRemover(id: string, num: string) {
    if (!confirm(`Remover OAB ${num} do monitoramento?`)) return;
    startTransition(() => removerOabAction(id));
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 font-body text-sm text-blue-800">
        📋 As OABs cadastradas aqui são monitoradas automaticamente pelo
        sistema. A busca é realizada <strong>diariamente</strong> nos diários de
        justiça eletrônicos (DJe/PJe) e as publicações encontradas aparecem na
        aba <strong>Automática</strong>.
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="font-body text-sm font-semibold text-fg">
          {oabs.length} OAB{oabs.length !== 1 ? "s" : ""} monitorada
          {oabs.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          {showForm ? "Cancelar" : "Adicionar OAB"}
        </button>
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4"
        >
          <h3 className="font-heading text-sm font-semibold text-fg">
            Nova OAB Monitorada
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Número OAB *
              </label>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: 12345 ou OAB/AL 12345"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Estado *
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Nome do Advogado
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo (opcional)"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          {erro && <p className="font-body text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : (
                <PlusIcon className="h-3.5 w-3.5" />
              )}
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-muted transition-colors hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de OABs */}
      {oabs.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <div className="text-center">
            <p className="font-body text-sm font-semibold text-muted">
              Nenhuma OAB cadastrada.
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Adicione uma OAB para iniciar o monitoramento automático.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/60">
                  {[
                    "OAB",
                    "Estado",
                    "Advogado",
                    "Última busca",
                    "Status",
                    "Ações",
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
                {oabs.map((oab) => (
                  <tr
                    key={oab.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-body text-sm font-semibold text-fg">
                      {oab.numero}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-body text-xs font-semibold text-primary">
                        {oab.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-muted">
                      {oab.nome_advogado ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-body text-xs text-muted">
                      {oab.ultima_busca
                        ? new Date(oab.ultima_busca).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "Nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(oab.id, oab.ativa)}
                        disabled={isPending}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-body text-xs font-semibold transition-colors ${oab.ativa ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${oab.ativa ? "bg-emerald-500" : "bg-slate-400"}`}
                        />
                        {oab.ativa ? "Ativa" : "Inativa"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemover(oab.id, oab.numero)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 font-body text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        <XMarkIcon className="h-3 w-3" />
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Status ───────────────────────────────────────────────────────────────

function TabStatus({
  publicacoes,
  oabs,
}: {
  publicacoes: Publicacao[];
  oabs: OabMonitorada[];
}) {
  const total = publicacoes.length;
  const naoLidas = publicacoes.filter((p) => p.status === "nao_lida").length;
  const tratadas = publicacoes.filter((p) => p.status === "tratada").length;
  const oabsAtivas = oabs.filter((o) => o.ativa).length;
  const ultimaBusca = oabs.reduce(
    (acc, o) => {
      if (!o.ultima_busca) return acc;
      if (!acc) return o.ultima_busca;
      return o.ultima_busca > acc ? o.ultima_busca : acc;
    },
    null as string | null
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total de publicações", value: total, color: "text-fg" },
          { label: "Não lidas", value: naoLidas, color: "text-amber-600" },
          { label: "Tratadas", value: tratadas, color: "text-emerald-600" },
          {
            label: "OABs monitoradas",
            value: oabsAtivas,
            color: "text-primary",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <p className="font-body text-xs font-semibold text-muted">
              {label}
            </p>
            <p className={`mt-1 font-heading text-2xl font-bold ${color}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Status do sistema */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-sm font-semibold text-fg">
          Status do Sistema de Monitoramento
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="font-body text-sm text-fg">Busca automática</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ativa — Diária
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="font-body text-sm text-fg">
              Última sincronização
            </span>
            <span className="font-body text-sm text-muted">
              {ultimaBusca
                ? new Date(ultimaBusca).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Nenhuma busca realizada ainda"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="font-body text-sm text-fg">
              OABs ativas no monitoramento
            </span>
            <span className="font-body text-sm font-semibold text-primary">
              {oabsAtivas}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="font-body text-sm text-fg">
              Tribunais monitorados
            </span>
            <span className="font-body text-sm text-muted">
              {[...new Set(publicacoes.map((p) => p.tribunal))].join(", ") ||
                "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 font-body text-xs text-blue-700">
          💡 Para adicionar OABs ao monitoramento automático, acesse a aba{" "}
          <strong>OABs</strong>. As publicações são capturadas do DJe/PJe e
          disponibilizadas aqui automaticamente.
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublicacoesContent({
  publicacoes,
  oabs,
}: {
  publicacoes: Publicacao[];
  oabs: OabMonitorada[];
}) {
  const [tab, setTab] = useState<Tab>("automatica");
  const naoLidas = publicacoes.filter((p) => p.status === "nao_lida").length;

  const TABS = [
    {
      key: "automatica" as Tab,
      label: "Automática",
      sublabel: "Busca automática",
      badge: naoLidas,
    },
    { key: "manual" as Tab, label: "Manual", sublabel: "Busca manual" },
    {
      key: "oabs" as Tab,
      label: "OABs",
      sublabel: "OABs acompanhadas",
      badge: oabs.length,
    },
    { key: "status_sys" as Tab, label: "Status" },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 shadow-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-body text-sm font-medium transition-colors ${tab === t.key ? "bg-primary/10 text-primary font-semibold" : "text-muted hover:bg-slate-50 hover:text-fg"}`}
          >
            {t.label}
            {t.sublabel && (
              <span className="hidden font-body text-[11px] text-muted sm:inline">
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

      {tab === "automatica" && <TabAutomatica publicacoes={publicacoes} />}
      {tab === "manual" && <TabManual publicacoes={publicacoes} />}
      {tab === "oabs" && <TabOabs oabs={oabs} />}
      {tab === "status_sys" && (
        <TabStatus publicacoes={publicacoes} oabs={oabs} />
      )}
    </div>
  );
}
