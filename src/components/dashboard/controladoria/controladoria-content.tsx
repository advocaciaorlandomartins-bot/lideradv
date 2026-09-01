"use client";

import { useState, useTransition } from "react";
import type { RankingItem } from "@/lib/pontuacao";
import type {
  CargaColaborador,
  CapacidadeSemana,
} from "@/lib/controladoria-db";
import { TrophyIcon, GaugeIcon, AlertIcon } from "@/components/icons";
import { Avatar } from "@/components/dashboard/avatar";

interface Props {
  ranking: RankingItem[];
  carga: CargaColaborador[];
  capacidade: CapacidadeSemana[];
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
}: Props) {
  const [ranking, setRanking] = useState(rankingInicial);
  const [periodo, setPeriodo] = useState(30);
  const [isPending, startTransition] = useTransition();

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
    ...capacidade.map((c) => Math.max(c.entraram, c.saidas))
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
              return (
                <div
                  key={c.colaboradorId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
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
                        Próximo:{" "}
                        {new Date(
                          c.proximoPrazo + "T12:00:00"
                        ).toLocaleDateString("pt-BR")}
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
                  </div>
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
                Pontos por tarefa/controle concluído no período.
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
            <div className="divide-y divide-border">
              {ranking.map((r, idx) => {
                const maxPontos = Math.max(1, ranking[0]?.totalPontos ?? 1);
                return (
                  <div key={r.colaboradorId} className="px-5 py-3">
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
                        </p>
                      </div>
                      <p className="font-heading text-lg font-bold text-primary">
                        {r.totalPontos} pts
                      </p>
                    </div>
                    <div className="mt-2 ml-9 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{
                          width: `${(r.totalPontos / maxPontos) * 100}%`,
                        }}
                      />
                    </div>
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
            Capacidade produtiva — últimas {capacidade.length || 8} semanas
          </h2>
          <p className="font-body text-xs text-muted">
            O que entrou (tarefas/controles criados) vs. o que saiu (concluído).
            Semanas antes da ativação deste painel aparecem sem saída registrada
            — o histórico de conclusão só passou a ser rastreado a partir de
            agora.
          </p>
        </div>
        {capacidade.length === 0 ? (
          <p className="px-5 py-8 text-center font-body text-sm text-muted">
            Sem dados nas últimas semanas.
          </p>
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto px-5 py-6">
            {capacidade.map((c) => (
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
                </div>
                <span className="font-body text-[10px] text-muted">
                  {fmtSemana(c.semana)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 border-t border-border px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
            <span className="font-body text-xs text-muted">Entraram</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
            <span className="font-body text-xs text-muted">Saíram</span>
          </div>
        </div>
      </div>
    </div>
  );
}
