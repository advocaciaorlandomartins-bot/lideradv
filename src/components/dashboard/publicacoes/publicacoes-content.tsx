"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Publicacao, OabMonitorada } from "@/lib/publicacoes-db";
import { calcularPrazos } from "@/lib/publicacoes-datas";
import {
  marcarComoTratadaAction,
  marcarComoNaoLidaAction,
  marcarTodasComoTratadasAction,
  adicionarOabAction,
  toggleOabAction,
  removerOabAction,
  verificarPublicacoesAction,
  getDiagnosticoAction,
  adicionarPublicacaoManualAction,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * O webhook do TramitaSign (v2) não traz um campo estruturado de número de
 * processo — só o texto livre da intimação, de onde tentamos extrair o CNJ
 * por regex (ver normalizarV2 em api/webhooks/tramitasign/publicacoes). Sem
 * CNJ no texto, cai num placeholder interno "tramita-{id}" só pra não
 * quebrar o INSERT (que exige processo NOT NULL) — isso nunca deveria
 * aparecer cru pro usuário como se fosse um número de processo real.
 */
function labelProcesso(processo: string): string {
  return processo.startsWith("tramita-")
    ? "Processo não identificado"
    : processo;
}

function calcDiasRestantes(
  disponibilizacao: string,
  prazoDias: number | null
): number | null {
  if (prazoDias == null) return null;
  const prazos = calcularPrazos(disponibilizacao, prazoDias);
  if (!prazos?.prazo_final) return null;
  const [dd, mm, yyyy] = prazos.prazo_final.split("/").map(Number);
  const prazoFinal = new Date(yyyy, mm - 1, dd);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((prazoFinal.getTime() - hoje.getTime()) / 86400000);
}

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

// ── Prazo badge ───────────────────────────────────────────────────────────────

function PrazoBadge({ dias }: { dias: number }) {
  if (dias <= 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 font-body text-[11px] font-bold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        VENCIDO
      </span>
    );
  if (dias <= 3)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-body text-[11px] font-bold text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {dias}d restante{dias !== 1 ? "s" : ""}
      </span>
    );
  if (dias <= 7)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-body text-[11px] font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {dias}d restantes
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Prazo: {dias}d
    </span>
  );
}

// ── Card de publicação ────────────────────────────────────────────────────────

function PublicacaoCard({ pub }: { pub: Publicacao }) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const loading = isPending && action !== null;
  const router = useRouter();

  const ri = pub.resumo_ia;
  const diasRestantes =
    ri?.prazo_dias != null
      ? calcDiasRestantes(pub.disponibilizacao, ri.prazo_dias)
      : null;
  const snippet = ri?.texto ?? pub.conteudo?.slice(0, 200) ?? null;

  function handleTratar() {
    setAction("tratar");
    startTransition(async () => {
      await marcarComoTratadaAction(pub.id);
      setAction(null);
      router.refresh();
    });
  }
  function handleDesfazer() {
    setAction("desfazer");
    startTransition(async () => {
      await marcarComoNaoLidaAction(pub.id);
      setAction(null);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        pub.status === "nao_lida"
          ? "border-amber-200 bg-amber-50/20 hover:bg-amber-50/40"
          : "border-border bg-white hover:bg-slate-50/60"
      }`}
    >
      {/* Header row: tipo, tribunal, data, status, prazo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 font-body text-[11px] font-semibold text-blue-700">
            {pub.tipo}
          </span>
          {pub.tribunal && (
            <span className="font-body text-[11px] font-semibold text-muted">
              {pub.tribunal}
            </span>
          )}
          <span className="font-body text-[11px] text-muted">
            {pub.disponibilizacao}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {diasRestantes !== null && pub.status === "nao_lida" && (
            <PrazoBadge dias={diasRestantes} />
          )}
          <StatusBadge status={pub.status} />
        </div>
      </div>

      {/* Processo + cliente cadastrado */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/publicacoes/${pub.id}`}
          className={
            pub.processo.startsWith("tramita-")
              ? "font-body text-sm font-semibold italic text-muted hover:underline"
              : "font-mono text-sm font-semibold text-primary hover:underline"
          }
        >
          {labelProcesso(pub.processo)}
        </Link>
        {/* Cliente do CADASTRO (não o "destinatário" bruto extraído do texto
            da publicação, que pode vir com grafia diferente) — antes a
            lista não mostrava isso, só o nome cru da fonte. */}
        {pub.clienteNome && pub.clienteId && (
          <Link
            href={`/dashboard/clientes/${pub.clienteId}`}
            className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 font-body text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
          >
            {pub.clienteNome}
          </Link>
        )}
      </div>

      {/* Ação necessária */}
      {ri?.acao_necessaria && (
        <p className="mt-1.5 flex items-center gap-1.5 font-body text-xs font-semibold text-amber-700">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-amber-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          {ri.acao_necessaria}
        </p>
      )}

      {/* Resumo snippet */}
      {snippet && (
        <p className="mt-1.5 line-clamp-2 font-body text-sm leading-relaxed text-muted">
          {snippet}
        </p>
      )}

      {/* Footer: destinatário + órgão + ações */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {pub.destinatario && (
            <span className="font-body">
              <span className="font-semibold text-fg/70">Dest:</span>{" "}
              {pub.destinatario}
            </span>
          )}
          {pub.orgao && <span className="font-body">· {pub.orgao}</span>}
          {pub.advogados.length > 0 && (
            <span className="font-body font-semibold text-cta/80">
              · {pub.advogados[0]}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/dashboard/publicacoes/${pub.id}`}
            className="cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
          >
            Ver detalhes
          </Link>
          {pub.status === "nao_lida" ? (
            <button
              onClick={handleTratar}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              {loading && action === "tratar" ? (
                <SpinnerIcon className="h-3 w-3" />
              ) : null}
              Marcar tratada
            </button>
          ) : (
            <button
              onClick={handleDesfazer}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-body text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              {loading && action === "desfazer" ? (
                <SpinnerIcon className="h-3 w-3" />
              ) : null}
              Desfazer
            </button>
          )}
          <Link
            href="/dashboard/controles/novo"
            className="cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            + Atividade
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Lista de publicações ──────────────────────────────────────────────────────

function ListaPublicacoes({
  publicacoes,
  emptyMsg,
}: {
  publicacoes: Publicacao[];
  emptyMsg: string;
}) {
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

  return (
    <div className="space-y-2">
      {publicacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <span className="text-4xl">📭</span>
          <p className="font-body text-sm font-semibold text-muted">
            {emptyMsg}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {slice.map((pub) => (
              <PublicacaoCard key={pub.id} pub={pub} />
            ))}
          </div>
          {(totalPages > 1 || publicacoes.length > 10) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-5 py-3">
              <div className="flex items-center gap-1">
                <span className="mr-1 font-body text-xs text-muted">
                  Exibir:
                </span>
                {[10, 20, 50].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPageSize(s);
                      setPage(1);
                    }}
                    className={`h-7 min-w-[2rem] cursor-pointer rounded px-1.5 font-body text-xs transition-colors ${pageSize === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
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
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
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
                          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg font-body text-sm transition-colors ${n === safePage ? "bg-primary font-semibold text-white" : "border border-border text-muted hover:border-primary hover:text-primary"}`}
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
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Painel (mestre-detalhe) ──────────────────────────────────────────────────
// Segunda visão da lista, pedido do Orlando depois de comparar com o
// TramitaSign: lista compacta à esquerda, detalhe à direita (como um
// cliente de e-mail), com atalhos de teclado j/k pra navegar sem tirar a
// mão do teclado — útil pra quem trata muita publicação de uma vez. O
// "detalhe" reaproveita o PublicacaoCard que a Lista já usa, só que
// mostrando uma publicação por vez em destaque, em vez de duplicar o
// card inteiro de novo.

function PainelPublicacoes({
  publicacoes,
  emptyMsg,
}: {
  publicacoes: Publicacao[];
  emptyMsg: string;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Deriva o índice/seleção efetivos direto na renderização, em vez de um
  // efeito que chama setState — quando a lista filtrada muda (ex: tratar a
  // publicação selecionada faz ela sumir da aba "Não lidas") e o
  // selectedId salvo não existe mais na lista atual, cai pro primeiro item
  // automaticamente, sem round-trip de re-render.
  const selectedIndexRaw = publicacoes.findIndex((p) => p.id === selectedId);
  const selectedIndex =
    selectedIndexRaw >= 0 ? selectedIndexRaw : publicacoes.length > 0 ? 0 : -1;
  const selected = selectedIndex >= 0 ? publicacoes[selectedIndex] : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (publicacoes.length === 0) return;
      if (e.key === "j") {
        e.preventDefault();
        const next = Math.min(
          selectedIndex < 0 ? 0 : selectedIndex + 1,
          publicacoes.length - 1
        );
        setSelectedId(publicacoes[next].id);
      } else if (e.key === "k") {
        e.preventDefault();
        const prev = Math.max(selectedIndex - 1, 0);
        setSelectedId(publicacoes[prev].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [publicacoes, selectedIndex]);

  if (publicacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <span className="text-4xl">📭</span>
        <p className="font-body text-sm font-semibold text-muted">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
      <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-border bg-white p-2">
        <p className="flex items-center gap-1 px-2 pb-1.5 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
          <kbd className="rounded border border-border bg-slate-50 px-1 font-mono text-[10px]">
            j
          </kbd>
          <kbd className="rounded border border-border bg-slate-50 px-1 font-mono text-[10px]">
            k
          </kbd>
          navegar
        </p>
        {publicacoes.map((p) => {
          const ativo = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`block w-full cursor-pointer rounded-lg border-l-4 px-2.5 py-2 text-left transition-colors ${
                ativo
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-body text-xs font-semibold text-fg">
                  {p.tribunal || p.tipo}
                </span>
                <span className="flex-shrink-0 font-body text-[10px] text-muted">
                  {p.disponibilizacao}
                </span>
              </div>
              <p className="truncate font-mono text-[11px] text-muted">
                {labelProcesso(p.processo)}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {p.status === "nao_lida" && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                )}
                {p.clienteNome && (
                  <span className="truncate font-body text-[10px] text-violet-700">
                    {p.clienteNome}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        {selected ? (
          <PublicacaoCard key={selected.id} pub={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
            <p className="font-body text-sm text-muted">
              Selecione uma publicação — use{" "}
              <kbd className="rounded border border-border bg-slate-50 px-1 font-mono text-xs">
                j
              </kbd>{" "}
              e{" "}
              <kbd className="rounded border border-border bg-slate-50 px-1 font-mono text-xs">
                k
              </kbd>{" "}
              para navegar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Automática ───────────────────────────────────────────────────────────

function TabAutomatica({ publicacoes }: { publicacoes: Publicacao[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("nao_lida");
  const [search, setSearch] = useState("");
  // Filtros por tribunal/tipo — pedido explícito do Orlando após comparar
  // com o TramitaSign: a lista não tinha filtro nenhum além de busca
  // livre, nem eles têm os dois juntos (só tribunal, não tipo).
  const [tribunalFiltro, setTribunalFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  // Segunda visão da lista (painel mestre-detalhe com atalhos j/k) — ver
  // PainelPublicacoes acima.
  const [viewMode, setViewMode] = useState<"lista" | "painel">("lista");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isAutomatica = (origem: string) =>
    origem === "automatica" || origem === "tramitasign";

  const automaticas = useMemo(
    () => publicacoes.filter((p) => isAutomatica(p.origem)),
    [publicacoes]
  );
  const tribunais = useMemo(
    () =>
      Array.from(
        new Set(automaticas.map((p) => p.tribunal).filter(Boolean))
      ).sort(),
    [automaticas]
  );
  const tipos = useMemo(
    () =>
      Array.from(
        new Set(automaticas.map((p) => p.tipo).filter(Boolean))
      ).sort(),
    [automaticas]
  );

  const naoLidas = useMemo(
    () => automaticas.filter((p) => p.status === "nao_lida"),
    [automaticas]
  );
  const tratadas = useMemo(
    () => automaticas.filter((p) => p.status === "tratada"),
    [automaticas]
  );
  const baseList = statusFilter === "nao_lida" ? naoLidas : tratadas;
  const exibindo = useMemo(() => {
    const q = search.toLowerCase().trim();
    return baseList.filter((p) => {
      if (tribunalFiltro && p.tribunal !== tribunalFiltro) return false;
      if (tipoFiltro && p.tipo !== tipoFiltro) return false;
      if (!q) return true;
      return (
        p.processo.toLowerCase().includes(q) ||
        p.destinatario.toLowerCase().includes(q) ||
        p.advogados.some((a) => a.toLowerCase().includes(q)) ||
        p.orgao.toLowerCase().includes(q) ||
        (p.clienteNome ?? "").toLowerCase().includes(q)
      );
    });
  }, [baseList, search, tribunalFiltro, tipoFiltro]);

  function handleTratarTodas() {
    if (
      !confirm(
        `Marcar todas as ${naoLidas.length} publicações não lidas como tratadas?`
      )
    )
      return;
    startTransition(async () => {
      await marcarTodasComoTratadasAction();
      router.refresh();
    });
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
        <div className="relative ml-auto">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar processo, advogado…"
            className="h-9 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {statusFilter === "nao_lida" && naoLidas.length > 0 && (
          <button
            onClick={handleTratarTodas}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            {isPending ? <SpinnerIcon className="h-3 w-3" /> : "✅"}
            Marcar todas as {naoLidas.length} como tratadas
          </button>
        )}
      </div>

      {/* Filtros por tribunal/tipo — opções vêm dos valores que de fato
          aparecem nas publicações automáticas do escritório. */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tribunalFiltro}
          onChange={(e) => setTribunalFiltro(e.target.value)}
          className="h-8 rounded-lg border border-border bg-white px-2.5 font-body text-xs text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Todos os tribunais</option>
          {tribunais.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="h-8 rounded-lg border border-border bg-white px-2.5 font-body text-xs text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(tribunalFiltro || tipoFiltro) && (
          <button
            onClick={() => {
              setTribunalFiltro("");
              setTipoFiltro("");
            }}
            className="font-body text-xs font-semibold text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}

        {/* Lista (cartões, um por vez) × Painel (mestre-detalhe com j/k) */}
        <div className="ml-auto flex gap-0.5 rounded-lg border border-border bg-slate-50 p-0.5">
          <button
            onClick={() => setViewMode("lista")}
            className={`cursor-pointer rounded-md px-2.5 py-1 font-body text-xs font-semibold transition-colors ${viewMode === "lista" ? "bg-white text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode("painel")}
            className={`cursor-pointer rounded-md px-2.5 py-1 font-body text-xs font-semibold transition-colors ${viewMode === "painel" ? "bg-white text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            Painel
          </button>
        </div>
      </div>

      <p className="font-body text-xs text-muted">
        {exibindo.length} publicação{exibindo.length !== 1 ? "ões" : ""}
        {search ? ` para "${search}"` : ""} · Mostrando{" "}
        {exibindo.length > 0 ? `1 a ${exibindo.length}` : "0"}
      </p>

      {viewMode === "painel" ? (
        <PainelPublicacoes
          publicacoes={exibindo}
          emptyMsg={
            statusFilter === "nao_lida"
              ? "Nenhuma publicação não lida."
              : "Nenhuma publicação tratada ainda."
          }
        />
      ) : (
        <ListaPublicacoes
          publicacoes={exibindo}
          emptyMsg={
            statusFilter === "nao_lida"
              ? "Nenhuma publicação não lida."
              : "Nenhuma publicação tratada ainda."
          }
        />
      )}
    </div>
  );
}

// ── Tab: Manual ───────────────────────────────────────────────────────────────

const TIPOS_PUBLICACAO = [
  "Intimação",
  "Publicação",
  "Decisão",
  "Despacho",
  "Sentença",
  "Acórdão",
  "Homologação",
  "Trânsito em julgado",
  "Cumprimento de sentença",
  "Outro",
];

function TabManual({ publicacoes }: { publicacoes: Publicacao[] }) {
  const [search, setSearch] = useState("");
  const [buscou, setBuscou] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const [form, setForm] = useState({
    processo: "",
    tipo: "Intimação",
    destinatario: "",
    orgao: "",
    tribunal: "",
    disponibilizacao: new Date().toISOString().slice(0, 10),
    conteudo: "",
  });

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

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await adicionarPublicacaoManualAction(form);
      setFeedback({ ok: res.ok, msg: res.mensagem });
      if (res.ok) {
        setShowForm(false);
        setForm({
          processo: "",
          tipo: "Intimação",
          destinatario: "",
          orgao: "",
          tribunal: "",
          disponibilizacao: new Date().toISOString().slice(0, 10),
          conteudo: "",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso sobre DJe e INSS */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 font-body text-sm text-blue-800">
        ℹ️ Use <strong>Verificar agora</strong> (aba OABs) para buscar
        publicações e intimações do DJe automaticamente. Se uma intimação do
        INSS ou publicação não foi capturada, registre-a manualmente aqui.
      </div>

      {/* Busca nas publicações existentes */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-fg">
            Busca de Publicações
          </h2>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setFeedback(null);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            {showForm ? "Cancelar" : "Registrar manualmente"}
          </button>
        </div>
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
      </div>

      {/* Formulário de registro manual */}
      {showForm && (
        <form
          onSubmit={handleSubmitForm}
          className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4"
        >
          <h3 className="font-heading text-sm font-semibold text-fg">
            Registrar Publicação / Intimação Manualmente
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Número do Processo *
              </label>
              <input
                value={form.processo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, processo: e.target.value }))
                }
                placeholder="0000000-00.0000.0.00.0000"
                required
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Tipo *
              </label>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value }))
                }
                required
                className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {TIPOS_PUBLICACAO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Destinatário / Cliente
              </label>
              <input
                value={form.destinatario}
                onChange={(e) =>
                  setForm((f) => ({ ...f, destinatario: e.target.value }))
                }
                placeholder="Nome do cliente ou advogado"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Data de Disponibilização *
              </label>
              <input
                type="date"
                value={form.disponibilizacao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, disponibilizacao: e.target.value }))
                }
                required
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Órgão
              </label>
              <input
                value={form.orgao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, orgao: e.target.value }))
                }
                placeholder="Ex.: 1ª Vara Federal de Maceió"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Tribunal
              </label>
              <input
                value={form.tribunal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tribunal: e.target.value }))
                }
                placeholder="Ex.: TJAL, TRF5, INSS"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
              Conteúdo / Resumo
            </label>
            <textarea
              value={form.conteudo}
              onChange={(e) =>
                setForm((f) => ({ ...f, conteudo: e.target.value }))
              }
              placeholder="Cole aqui o texto da intimação ou publicação…"
              rows={4}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
          {feedback && (
            <p
              className={`font-body text-xs font-semibold ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {feedback.ok ? "✅" : "❌"} {feedback.msg}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlusIcon className="h-3.5 w-3.5" />
              )}
              Registrar
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

      {buscou && search.trim() && (
        <>
          <p className="font-body text-xs text-muted">
            {resultados.length} resultado{resultados.length !== 1 ? "s" : ""}{" "}
            para &quot;{search}&quot;
          </p>
          <ListaPublicacoes
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
  const router = useRouter();

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
      router.refresh();
    });
  }

  function handleToggle(id: string, ativa: boolean) {
    startTransition(async () => {
      await toggleOabAction(id, !ativa);
      router.refresh();
    });
  }

  function handleRemover(id: string, num: string) {
    if (!confirm(`Remover OAB ${num} do monitoramento?`)) return;
    startTransition(async () => {
      await removerOabAction(id);
      router.refresh();
    });
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
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="font-body text-sm font-semibold text-fg">
          {oabs.length} OAB{oabs.length !== 1 ? "s" : ""} monitorada
          {oabs.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <BotaoVerificar />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            {showForm ? "Cancelar" : "Adicionar OAB"}
          </button>
        </div>
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

// ── Botão Verificar Agora ─────────────────────────────────────────────────────

function BotaoVerificar() {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<Awaited<
    ReturnType<typeof verificarPublicacoesAction>
  > | null>(null);

  function handleVerificar() {
    setResultado(null);
    startTransition(async () => {
      const res = await verificarPublicacoesAction();
      setResultado(res);
    });
  }

  const d = resultado?.detalhes;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleVerificar}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : (
          <span>🔍</span>
        )}
        {isPending ? "Verificando todas as fontes..." : "Verificar agora"}
      </button>

      {resultado && (
        <div className="rounded-lg border border-border bg-slate-50 p-3 font-body text-xs">
          <p
            className={`mb-2 font-semibold ${resultado.inseridos > 0 ? "text-emerald-600" : "text-slate-600"}`}
          >
            {resultado.inseridos > 0 ? "✅" : "🔍"} {resultado.mensagem}
          </p>
          {d && (
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between rounded bg-white px-2 py-1 border border-border">
                <span className="text-muted">DJe / eSAJ</span>
                <span
                  className={`font-semibold ${d.dje > 0 ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {d.dje > 0 ? `+${d.dje}` : "0 novas"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-white px-2 py-1 border border-border">
                <span className="text-muted">DataJud por proc.</span>
                <span
                  className={`font-semibold ${d.datajud_processo > 0 ? "text-emerald-600" : d.datajud_disponivel ? "text-slate-400" : "text-amber-500"}`}
                >
                  {d.datajud_disponivel
                    ? d.datajud_processo > 0
                      ? `+${d.datajud_processo}`
                      : `0 novas (${d.processos_monitorados} proc.)`
                    : "sem API Key"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-white px-2 py-1 border border-border">
                <span className="text-muted">TramitaSign</span>
                <span
                  className={`font-semibold ${!d.tramitasign_ativo ? "text-amber-500" : d.tramitasign > 0 ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {!d.tramitasign_ativo
                    ? "sem credenciais"
                    : d.tramitasign_erro
                      ? `erro: ${d.tramitasign_erro.slice(0, 30)}`
                      : d.tramitasign > 0
                        ? `+${d.tramitasign}`
                        : "0 novas"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-white px-2 py-1 border border-border">
                <span className="text-muted">DJEN / TRF5</span>
                <span
                  className={`font-semibold ${d.djen > 0 ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {d.djen > 0 ? `+${d.djen}` : "0 novas"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status item helper ────────────────────────────────────────────────────────

function StatusItem({
  label,
  ok,
  okLabel,
  failLabel,
  info,
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  failLabel: string;
  info?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
      <div>
        <span className="font-body text-sm text-fg">{label}</span>
        {info && (
          <p className="mt-0.5 font-body text-[11px] text-muted">{info}</p>
        )}
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
          ok
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {ok ? okLabel : failLabel}
      </span>
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

  const [isPending, startTransition] = useTransition();
  const [diagnostico, setDiagnostico] = useState<Awaited<
    ReturnType<typeof getDiagnosticoAction>
  > | null>(null);

  function handleDiagnostico() {
    startTransition(async () => {
      const d = await getDiagnosticoAction();
      setDiagnostico(d);
    });
  }

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
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="font-body text-sm text-fg">
              CRON automático (seg–sex 5h)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ativo
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
              Tribunais com publicações
            </span>
            <span className="font-body text-sm text-muted">
              {[...new Set(publicacoes.map((p) => p.tribunal))]
                .filter(Boolean)
                .join(", ") || "—"}
            </span>
          </div>
        </div>

        {/* Diagnóstico detalhado */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs font-semibold text-fg">
              Diagnóstico das fontes
            </p>
            <button
              onClick={handleDiagnostico}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 font-body text-xs font-semibold text-muted transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {isPending && <SpinnerIcon className="h-3 w-3 animate-spin" />}
              {isPending ? "Verificando..." : "Verificar configuração"}
            </button>
          </div>

          {diagnostico && (
            <div className="mt-3 space-y-2">
              <StatusItem
                label="DJe / eSAJ (TJAL e outros)"
                ok={diagnostico.oabs_ativas > 0}
                okLabel={`${diagnostico.oabs_ativas} OAB(s) ativa(s)`}
                failLabel="Nenhuma OAB cadastrada"
                info="Scraping automático do Diário de Justiça eletrônico"
              />
              <StatusItem
                label="DataJud por processo"
                ok={
                  diagnostico.datajud_api && diagnostico.processos_com_cnj > 0
                }
                okLabel={`${diagnostico.processos_com_cnj} processo(s) CNJ`}
                failLabel={
                  !diagnostico.datajud_api
                    ? "DATAJUD_API_KEY não configurada"
                    : diagnostico.processos_com_cnj === 0
                      ? "Nenhum processo com número CNJ (20 dígitos)"
                      : "Sem processos"
                }
                info="Requer número CNJ completo (ex: 0001234-56.2024.8.02.0001)"
              />
              <StatusItem
                label="TramitaSign — Webhook"
                ok={diagnostico.tramitasign_webhook}
                okLabel="Configurado"
                failLabel="TRAMITASIGN_WEBHOOK_SECRET não configurado"
                info="Recebe publicações automaticamente quando o TramitaSign envia"
              />
              <StatusItem
                label="TramitaSign — Sync automático"
                ok={diagnostico.tramitasign_login}
                okLabel="Credenciais configuradas"
                failLabel="Configure no Vercel"
                info="TRAMITASIGN_LOGIN_EMAIL + TRAMITASIGN_LOGIN_PASSWORD → sincroniza diariamente"
              />

              {!diagnostico.tramitasign_login && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-body text-xs text-amber-800">
                  <strong>Principal fonte pendente:</strong> Configure{" "}
                  <code className="rounded bg-amber-100 px-1">
                    TRAMITASIGN_LOGIN_EMAIL
                  </code>{" "}
                  e{" "}
                  <code className="rounded bg-amber-100 px-1">
                    TRAMITASIGN_LOGIN_PASSWORD
                  </code>{" "}
                  nas variáveis de ambiente do Vercel. O sistema sincronizará
                  todas as publicações do TramitaSign automaticamente todo dia.
                </div>
              )}

              {diagnostico.processos_com_cnj === 0 &&
                diagnostico.datajud_api && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-body text-xs text-blue-800">
                    <strong>Dica:</strong> Cadastre o número CNJ completo nos
                    processos (ex:{" "}
                    <code className="rounded bg-blue-100 px-1">
                      0001234-56.2024.8.02.0001
                    </code>
                    ) para que o DataJud monitore movimentações automaticamente.
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4 flex flex-col gap-2">
          <p className="font-body text-xs font-semibold text-fg">
            Verificar publicações agora
          </p>
          <BotaoVerificar />
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
