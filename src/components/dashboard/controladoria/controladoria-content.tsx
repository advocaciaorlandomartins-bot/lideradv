"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RankingDetalhado } from "@/lib/pontuacao";
import type {
  CargaColaborador,
  CapacidadeResumo,
} from "@/lib/controladoria-db";
import {
  TrophyIcon,
  GaugeIcon,
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
} from "@/components/icons";
import { Avatar } from "@/components/dashboard/avatar";

function fmtData(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

const STATUS_PRAZO_STYLE: Record<
  "tranquilo" | "proximo" | "vencido",
  { dot: string; text: string; label: string }
> = {
  tranquilo: { dot: "bg-emerald-500", text: "text-muted", label: "Tranquilo" },
  proximo: { dot: "bg-amber-500", text: "text-amber-700", label: "Atenção" },
  vencido: { dot: "bg-red-500", text: "text-red-700", label: "Vencido" },
};

const CLASSIFICACAO_STYLE: Record<
  "adiantado" | "no_limite" | "atrasado" | "sem_prazo",
  { bg: string; text: string; label: string }
> = {
  adiantado: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Adiantado",
  },
  no_limite: { bg: "bg-amber-50", text: "text-amber-700", label: "No limite" },
  atrasado: { bg: "bg-red-50", text: "text-red-700", label: "Atrasado" },
  sem_prazo: { bg: "bg-slate-100", text: "text-muted", label: "Sem prazo" },
};

interface Props {
  ranking: RankingDetalhado[];
  carga: CargaColaborador[];
  capacidade: CapacidadeResumo;
  /** false = só vê o detalhamento item a item do próprio colaborador; dos outros só os totais agregados. */
  podeVerDetalhesDeTodos: boolean;
  meuColaboradorId: string | null;
}

const PERIODOS = [
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
];

function fmtSemana(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function ControladoriaContent({
  ranking: rankingInicial,
  carga,
  capacidade,
  podeVerDetalhesDeTodos,
  meuColaboradorId,
}: Props) {
  const [ranking, setRanking] = useState(rankingInicial);
  const [periodo, setPeriodo] = useState(30);
  const [isPending, startTransition] = useTransition();
  const [cargaAberta, setCargaAberta] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);

  function toggleCarga(id: string) {
    setCargaAberta((atual) => (atual === id ? null : id));
  }
  function toggleHistorico(id: string) {
    setHistoricoAberto((atual) => (atual === id ? null : id));
  }

  function trocarPeriodo(dias: number) {
    setPeriodo(dias);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/controladoria/ranking?dias=${dias}`);
        if (res.ok) {
          const data = await res.json();
          setRanking(data.ranking ?? []);
        }
      } catch {
        // mantém o ranking anterior em caso de falha
      }
    });
  }

  const maxCapacidade = Math.max(
    1,
    ...capacidade.semanas.map((c) =>
      Math.max(c.entraram, c.saidas, c.filaAcumulada)
    )
  );

  return (
    <div className="space-y-6">
      {/* Carga da equipe */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <GaugeIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              Carga da equipe
            </h2>
            <p className="font-body text-xs text-muted">
              Quanto cada colaborador tem em aberto agora — use antes de
              atribuir uma tarefa nova.
            </p>
          </div>
        </div>
        {carga.length === 0 ? (
          <p className="px-5 py-8 text-center font-body text-sm text-muted">
            Nenhum colaborador ativo.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {carga.map((c) => {
              const nivel =
                c.totalVencidas > 0
                  ? "alto"
                  : c.totalAbertas >= 8
                    ? "medio"
                    : "baixo";
              const aberta = cargaAberta === c.colaboradorId;
              return (
                <div key={c.colaboradorId}>
                  <button
                    type="button"
                    onClick={() =>
                      c.itens.length > 0 && toggleCarga(c.colaboradorId)
                    }
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${
                      c.itens.length > 0
                        ? "hover:bg-slate-50/70 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar nome={c.nome} />
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-fg">
                          {c.nome}
                        </p>
                        <p className="font-body text-xs text-muted capitalize">
                          {c.cargo}
                        </p>
                        {c.porCategoria.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.porCategoria.map((cat) => (
                              <span
                                key={cat.categoria}
                                className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-medium text-muted"
                              >
                                {cat.label}: {cat.total}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.itemMaisAntigo && (
                          <p className="mt-1 flex items-center gap-1 font-body text-[11px] text-muted">
                            <ClockIcon className="h-3 w-3" />
                            Mais antigo: {c.itemMaisAntigo.diasAberto}{" "}
                            {c.itemMaisAntigo.diasAberto === 1 ? "dia" : "dias"}{" "}
                            (desde {fmtData(c.itemMaisAntigo.criadoEm)})
                          </p>
                        )}
                        {!c.itemMaisAntigo &&
                          c.totalAbertas > 0 &&
                          !podeVerDetalhesDeTodos &&
                          c.colaboradorId !== meuColaboradorId && (
                            <p className="mt-1 font-body text-[11px] italic text-muted">
                              Detalhe item a item visível só pra administração
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-body text-xs text-muted">Abertas</p>
                        <p className="font-heading text-base font-bold text-fg">
                          {c.totalAbertas}
                        </p>
                      </div>
                      {c.totalVencidas > 0 && (
                        <div className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-600">
                          <AlertIcon className="h-3.5 w-3.5" />
                          <span className="font-body text-xs font-bold">
                            {c.totalVencidas} vencida
                            {c.totalVencidas > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                      {c.proximoPrazo && (
                        <p className="font-body text-xs text-muted">
                          Próximo: {fmtData(c.proximoPrazo)}
                        </p>
                      )}
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          nivel === "alto"
                            ? "bg-red-500"
                            : nivel === "medio"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        title={
                          nivel === "alto"
                            ? "Tem item vencido"
                            : nivel === "medio"
                              ? "Carga alta"
                              : "Carga tranquila"
                        }
                      />
                      {c.itens.length > 0 &&
                        (aberta ? (
                          <ChevronUpIcon className="h-4 w-4 text-muted" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-muted" />
                        ))}
                    </div>
                  </button>
                  {aberta && c.itens.length > 0 && (
                    <div className="bg-slate-50/60 px-5 py-3">
                      <Link
                        href={`/dashboard/colaboradores/${c.colaboradorId}`}
                        className="mb-2 inline-block font-body text-xs font-semibold text-primary hover:underline"
                      >
                        Ver perfil de {c.nome} (metas, bônus e remuneração) →
                      </Link>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left">
                          <thead>
                            <tr className="font-body text-[11px] uppercase tracking-wide text-muted">
                              <th className="py-1 pr-3 font-semibold">Item</th>
                              <th className="py-1 pr-3 font-semibold">
                                Cliente
                              </th>
                              <th className="py-1 pr-3 font-semibold">
                                Aberto em
                              </th>
                              <th className="py-1 pr-3 font-semibold">Dias</th>
                              <th className="py-1 pr-3 font-semibold">Prazo</th>
                              <th className="py-1 font-semibold">Situação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/70">
                            {c.itens.map((item) => {
                              const style =
                                STATUS_PRAZO_STYLE[item.statusPrazo];
                              return (
                                <tr key={item.id} className="font-body text-xs">
                                  <td className="py-1.5 pr-3 text-fg">
                                    <span className="mr-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-border">
                                      {item.categoriaLabel}
                                    </span>
                                    {item.titulo}
                                  </td>
                                  <td className="py-1.5 pr-3 text-muted">
                                    {item.clienteNome ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-3 text-muted">
                                    {fmtData(item.criadoEm)}
                                  </td>
                                  <td className="py-1.5 pr-3 text-muted">
                                    {item.diasAberto}
                                  </td>
                                  <td className="py-1.5 pr-3 text-muted">
                                    {item.prazoInterno && (
                                      <span title="Prazo interno">
                                        {fmtData(item.prazoInterno)}
                                      </span>
                                    )}
                                    {item.prazoInterno &&
                                      item.prazoFinal &&
                                      " → "}
                                    {item.prazoFinal && (
                                      <span title="Prazo final">
                                        {fmtData(item.prazoFinal)}
                                      </span>
                                    )}
                                    {!item.prazoInterno &&
                                      !item.prazoFinal &&
                                      "—"}
                                  </td>
                                  <td className="py-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 font-semibold ${style.text}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                      />
                                      {style.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ranking */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <TrophyIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                Ranking de produtividade
              </h2>
              <p className="font-body text-xs text-muted">
                Pontos por tarefa/controle concluído no período.{" "}
                &ldquo;Adiantado&rdquo; = entregue até o prazo interno (ideal);
                &ldquo;No limite&rdquo; = entregue dentro do prazo final, mas
                depois do ideal; &ldquo;Atrasado&rdquo; = entregue depois do
                prazo final.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => trocarPeriodo(p.dias)}
                disabled={isPending}
                className={`rounded-lg px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
                  periodo === p.dias
                    ? "bg-primary text-white"
                    : "border border-border text-muted hover:text-fg"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {ranking.length === 0 ? (
          <p className="px-5 py-8 text-center font-body text-sm text-muted">
            Nenhum colaborador ativo.
          </p>
        ) : (
          <>
            {/* Pódio — top 3 */}
            {ranking.slice(0, 3).some((r) => r.totalPontos > 0) && (
              <div className="flex items-end justify-center gap-3 border-b border-border bg-slate-50/50 px-5 py-6 sm:gap-6">
                {[1, 0, 2].map((idx) => {
                  const r = ranking[idx];
                  if (!r) return <div key={idx} className="w-20 sm:w-28" />;
                  const isPrimeiro = idx === 0;
                  return (
                    <div
                      key={r.colaboradorId}
                      className={`flex w-20 flex-col items-center gap-1.5 sm:w-28 ${isPrimeiro ? "" : "opacity-90"}`}
                    >
                      <span className="text-lg">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </span>
                      <Avatar
                        nome={r.nome}
                        size={isPrimeiro ? "h-14 w-14" : "h-11 w-11"}
                        className={
                          isPrimeiro
                            ? "ring-4 ring-amber-300 text-base"
                            : "ring-2 ring-slate-200"
                        }
                      />
                      <p className="text-center font-body text-xs font-semibold text-fg leading-tight line-clamp-2">
                        {r.nome}
                      </p>
                      <p className="font-heading text-sm font-bold text-primary">
                        {r.totalPontos} pts
                      </p>
                      <div
                        className={`w-full rounded-t-lg ${
                          isPrimeiro
                            ? "h-16 bg-amber-200"
                            : idx === 1
                              ? "h-10 bg-slate-200"
                              : "h-6 bg-orange-100"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="divide-y divide-border">
              {ranking.map((r, idx) => {
                const maxPontos = Math.max(1, ranking[0]?.totalPontos ?? 1);
                const historicoAbertoAqui = historicoAberto === r.colaboradorId;
                return (
                  <div key={r.colaboradorId}>
                    <button
                      type="button"
                      onClick={() =>
                        r.historico.length > 0 &&
                        toggleHistorico(r.colaboradorId)
                      }
                      className={`w-full px-5 py-3 text-left transition-colors ${
                        r.historico.length > 0
                          ? "hover:bg-slate-50/70 cursor-pointer"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-body text-[11px] font-bold ${
                            idx === 0
                              ? "bg-amber-100 text-amber-700"
                              : idx === 1
                                ? "bg-slate-200 text-slate-600"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-50 text-muted"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <Avatar nome={r.nome} />
                        <div className="min-w-0 flex-1">
                          <p className="font-body text-sm font-semibold text-fg">
                            {r.nome}
                          </p>
                          <p className="font-body text-xs text-muted capitalize">
                            {r.cargo} · {r.entregas} entrega
                            {r.entregas !== 1 ? "s" : ""}
                            {r.noPrazoPct != null && (
                              <>
                                {" "}
                                ·{" "}
                                <span
                                  className={
                                    r.noPrazoPct >= 80
                                      ? "text-emerald-600 font-semibold"
                                      : r.noPrazoPct >= 50
                                        ? "text-amber-600 font-semibold"
                                        : "text-red-600 font-semibold"
                                  }
                                >
                                  {r.noPrazoPct}% no prazo
                                </span>
                              </>
                            )}
                          </p>
                          {(r.adiantados > 0 ||
                            r.noLimite > 0 ||
                            r.atrasados > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.adiantados > 0 && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-body text-[11px] font-medium text-emerald-700">
                                  Adiantado: {r.adiantados}
                                </span>
                              )}
                              {r.noLimite > 0 && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-body text-[11px] font-medium text-amber-700">
                                  No limite: {r.noLimite}
                                </span>
                              )}
                              {r.atrasados > 0 && (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 font-body text-[11px] font-medium text-red-700">
                                  Atrasado: {r.atrasados}
                                </span>
                              )}
                            </div>
                          )}
                          {r.historico.length === 0 &&
                            r.entregas > 0 &&
                            !podeVerDetalhesDeTodos &&
                            r.colaboradorId !== meuColaboradorId && (
                              <p className="mt-1 font-body text-[11px] italic text-muted">
                                Histórico item a item visível só pra
                                administração
                              </p>
                            )}
                        </div>
                        {r.fataisAbertos > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 font-body text-[10px] font-bold text-white"
                            title="Prazos fatais vencidos e ainda em aberto"
                          >
                            <AlertIcon className="h-3 w-3" />
                            {r.fataisAbertos} fatal
                            {r.fataisAbertos !== 1 ? "is" : ""} estourado
                            {r.fataisAbertos !== 1 ? "s" : ""}
                          </span>
                        )}
                        <p className="font-heading text-lg font-bold text-primary">
                          {r.totalPontos} pts
                        </p>
                        {r.historico.length > 0 &&
                          (historicoAbertoAqui ? (
                            <ChevronUpIcon className="h-4 w-4 text-muted" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-muted" />
                          ))}
                      </div>
                      <div className="mt-2 ml-9 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{
                            width: `${(r.totalPontos / maxPontos) * 100}%`,
                          }}
                        />
                      </div>
                    </button>
                    {historicoAbertoAqui && r.historico.length > 0 && (
                      <div className="bg-slate-50/60 px-5 py-3">
                        <Link
                          href={`/dashboard/colaboradores/${r.colaboradorId}`}
                          className="mb-2 inline-block font-body text-xs font-semibold text-primary hover:underline"
                        >
                          Ver perfil de {r.nome} (metas, bônus e remuneração) →
                        </Link>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] text-left">
                            <thead>
                              <tr className="font-body text-[11px] uppercase tracking-wide text-muted">
                                <th className="py-1 pr-3 font-semibold">
                                  Item
                                </th>
                                <th className="py-1 pr-3 font-semibold">
                                  Concluído em
                                </th>
                                <th className="py-1 pr-3 font-semibold">
                                  Prazo
                                </th>
                                <th className="py-1 font-semibold">
                                  Classificação
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                              {r.historico.map((h) => {
                                const style =
                                  CLASSIFICACAO_STYLE[h.classificacao];
                                return (
                                  <tr key={h.id} className="font-body text-xs">
                                    <td className="py-1.5 pr-3 text-fg">
                                      {h.titulo}
                                    </td>
                                    <td className="py-1.5 pr-3 text-muted">
                                      {fmtData(h.concluidoEm)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-muted">
                                      {h.prazoInterno && (
                                        <span title="Prazo interno">
                                          {fmtData(h.prazoInterno)}
                                        </span>
                                      )}
                                      {h.prazoInterno && h.prazoFinal && " → "}
                                      {h.prazoFinal && (
                                        <span title="Prazo final">
                                          {fmtData(h.prazoFinal)}
                                        </span>
                                      )}
                                      {!h.prazoInterno && !h.prazoFinal && "—"}
                                    </td>
                                    <td className="py-1.5">
                                      <span
                                        className={`rounded-full px-2 py-0.5 font-semibold ${style.bg} ${style.text}`}
                                      >
                                        {style.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-6 border-t border-border px-5 py-3">
              <div>
                <p className="font-body text-[11px] text-muted">
                  Total de pontos
                </p>
                <p className="font-heading text-base font-bold text-fg">
                  {ranking.reduce((s, r) => s + r.totalPontos, 0)}
                </p>
              </div>
              <div>
                <p className="font-body text-[11px] text-muted">
                  Média por colaborador
                </p>
                <p className="font-heading text-base font-bold text-fg">
                  {(
                    ranking.reduce((s, r) => s + r.totalPontos, 0) /
                    ranking.length
                  ).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="font-body text-[11px] text-muted">
                  Total de entregas
                </p>
                <p className="font-heading text-base font-bold text-fg">
                  {ranking.reduce((s, r) => s + r.entregas, 0)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Capacidade produtiva */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-heading text-sm font-bold text-fg">
            Capacidade produtiva — últimas {capacidade.semanas.length || 8}{" "}
            semanas
          </h2>
          <p className="mt-1 font-body text-sm text-fg">
            {capacidade.narrativa}
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Semanas antes da ativação deste painel aparecem sem saída registrada
            — o histórico de conclusão só passou a ser rastreado a partir de
            agora, o que pode inflar a fila acumulada mostrada ali.
          </p>
        </div>

        {/* Mini KPIs de tendência */}
        {capacidade.semanas.length > 0 && (
          <div className="grid grid-cols-1 gap-3 border-b border-border px-5 py-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="font-body text-[11px] text-muted">
                Entrando por semana (média recente)
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <p className="font-heading text-lg font-bold text-fg">
                  {capacidade.entradaMediaRecente.toFixed(1)}
                </p>
                {capacidade.entradaVariacaoPct != null && (
                  <span
                    className={`font-body text-xs font-semibold ${capacidade.entradaVariacaoPct > 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    {capacidade.entradaVariacaoPct > 0 ? "↗" : "↘"}{" "}
                    {Math.abs(capacidade.entradaVariacaoPct)}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-body text-[11px] text-muted">
                Concluindo por semana (média recente)
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <p className="font-heading text-lg font-bold text-fg">
                  {capacidade.saidaMediaRecente.toFixed(1)}
                </p>
                {capacidade.saidaVariacaoPct != null && (
                  <span
                    className={`font-body text-xs font-semibold ${capacidade.saidaVariacaoPct >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {capacidade.saidaVariacaoPct >= 0 ? "↗" : "↘"}{" "}
                    {Math.abs(capacidade.saidaVariacaoPct)}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-body text-[11px] text-muted">
                Fila acumulada agora
              </p>
              <p
                className={`mt-1 font-heading text-lg font-bold ${capacidade.filaAtual > 0 ? "text-amber-600" : "text-fg"}`}
              >
                {capacidade.filaAtual}
              </p>
            </div>
          </div>
        )}

        {capacidade.semanas.length === 0 ? (
          <p className="px-5 py-8 text-center font-body text-sm text-muted">
            Sem dados nas últimas semanas.
          </p>
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto px-5 py-6">
            {capacidade.semanas.map((c) => (
              <div
                key={c.semana}
                className="flex flex-shrink-0 flex-col items-center gap-1"
              >
                <div className="flex h-32 items-end gap-1">
                  <div
                    className="w-4 rounded-t bg-primary/70"
                    style={{
                      height: `${(c.entraram / maxCapacidade) * 100}%`,
                    }}
                    title={`Entraram: ${c.entraram}`}
                  />
                  <div
                    className="w-4 rounded-t bg-emerald-500/70"
                    style={{ height: `${(c.saidas / maxCapacidade) * 100}%` }}
                    title={`Saíram: ${c.saidas}`}
                  />
                  <div
                    className="w-4 rounded-t bg-amber-400/70"
                    style={{
                      height: `${(c.filaAcumulada / maxCapacidade) * 100}%`,
                    }}
                    title={`Fila acumulada: ${c.filaAcumulada}`}
                  />
                </div>
                <span className="font-body text-[10px] text-muted">
                  {fmtSemana(c.semana)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
            <span className="font-body text-xs text-muted">Entraram</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
            <span className="font-body text-xs text-muted">Saíram</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70" />
            <span className="font-body text-xs text-muted">Fila acumulada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
