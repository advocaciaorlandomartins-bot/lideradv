"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjecaoEscritorio } from "@/lib/projecao-financeira-db";
import {
  ESTAGIO_PRODUCAO_META,
  type EstagioProducao,
} from "@/lib/producao-types";
import {
  BanknotesIcon,
  CurrencyIcon,
  UsersIcon,
  FolderOpenIcon,
  ChevronDownIcon,
  AlertIcon,
} from "@/components/icons";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  projecao: ProjecaoEscritorio;
}

/**
 * Admin-only: pedido explícito do Orlando — "essas informações só pra o
 * adm, nunca pra os funcionários". A página (financeiro/page.tsx) só
 * busca getProjecaoEscritorio() e passa pra cá quando
 * session.categoria === "Administrador(a)" — aqui dentro não tem checagem
 * própria porque o dado nem chega até o componente se não for admin.
 */
export default function ProjecaoEscritorioContent({ projecao }: Props) {
  const [expandidoColaborador, setExpandidoColaborador] = useState(false);
  const [expandidoProcessos, setExpandidoProcessos] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-violet-50/40 shadow-sm">
      <div className="border-b border-violet-200 bg-violet-100/50 px-5 py-3">
        <p className="font-heading text-sm font-bold text-violet-900">
          Projeção — processos ativos
        </p>
        <p className="font-body text-xs text-violet-700">
          Quanto o escritório receberia em honorários e pagaria em comissão SE
          cada processo em andamento der resultado favorável. Estimativa
          otimista, não um valor garantido — só visível pra administrador(a).
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-emerald-600" />
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Honorário estimado
              </p>
            </div>
            <p className="mt-2 font-heading text-lg font-semibold text-emerald-700">
              {fmt(projecao.totalHonorarioEstimado)}
            </p>
            <p className="mt-0.5 font-body text-xs text-muted">
              {projecao.processosComHonorario} processo
              {projecao.processosComHonorario !== 1 ? "s" : ""} com valor
              definido
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CurrencyIcon className="h-4 w-4 text-amber-600" />
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Comissão estimada
              </p>
            </div>
            <p className="mt-2 font-heading text-lg font-semibold text-amber-700">
              {fmt(projecao.totalComissaoEstimada)}
            </p>
            <p className="mt-0.5 font-body text-xs text-muted">
              a pagar pra equipe, se tudo for ganho
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BanknotesIcon
                className={`h-4 w-4 ${projecao.saldoLiquidoProjetado >= 0 ? "text-emerald-600" : "text-red-600"}`}
              />
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Saldo líquido projetado
              </p>
            </div>
            <p
              className={`mt-2 font-heading text-lg font-semibold ${projecao.saldoLiquidoProjetado >= 0 ? "text-emerald-700" : "text-red-600"}`}
            >
              {fmt(projecao.saldoLiquidoProjetado)}
            </p>
            <p className="mt-0.5 font-body text-xs text-muted">
              honorário − comissão
            </p>
          </div>
        </div>

        {/* Aviso de processos sem valor */}
        {projecao.processosSemHonorario > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <AlertIcon className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="font-body text-xs text-amber-800">
              {projecao.processosSemHonorario} processo
              {projecao.processosSemHonorario !== 1 ? "s" : ""} ativo
              {projecao.processosSemHonorario !== 1 ? "s" : ""} sem valor ou
              percentual de honorário cadastrado — fica{" "}
              {projecao.processosSemHonorario !== 1 ? "de fora" : "de fora"}{" "}
              desta projeção até preencher na ficha do processo.
            </p>
          </div>
        )}

        {/* Por colaborador */}
        {projecao.porColaborador.length > 0 && (
          <div className="rounded-xl border border-border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setExpandidoColaborador((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
            >
              <UsersIcon className="h-4 w-4 text-muted" />
              <span className="font-heading text-sm font-semibold text-fg">
                Comissão estimada por colaborador
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-bold text-slate-600">
                {projecao.porColaborador.length}
              </span>
              <ChevronDownIcon
                className={`ml-auto h-4 w-4 text-muted transition-transform duration-200 ${expandidoColaborador ? "rotate-180" : ""}`}
              />
            </button>
            {expandidoColaborador && (
              <div className="divide-y divide-border border-t border-border">
                {projecao.porColaborador.map((c) => (
                  <div
                    key={c.colaboradorId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold text-fg">
                        {c.nome}
                      </p>
                      <p className="font-body text-xs text-muted">
                        {c.processosCount} processo
                        {c.processosCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="flex-shrink-0 font-body text-sm font-semibold text-amber-700">
                      {fmt(c.totalComissaoEstimada)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detalhado por processo */}
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setExpandidoProcessos((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
          >
            <FolderOpenIcon className="h-4 w-4 text-muted" />
            <span className="font-heading text-sm font-semibold text-fg">
              Detalhado por processo
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-bold text-slate-600">
              {projecao.processos.length}
            </span>
            <ChevronDownIcon
              className={`ml-auto h-4 w-4 text-muted transition-transform duration-200 ${expandidoProcessos ? "rotate-180" : ""}`}
            />
          </button>
          {expandidoProcessos && (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-slate-50/60">
                    <th className="px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Cliente / Ação
                    </th>
                    <th className="px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Estágio
                    </th>
                    <th className="px-4 py-2 text-right font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Honorário estimado
                    </th>
                    <th className="px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Comissão estimada (responsável)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projecao.processos.map((p) => {
                    const meta = p.estagioProducao
                      ? (ESTAGIO_PRODUCAO_META[
                          p.estagioProducao as EstagioProducao
                        ] ?? null)
                      : null;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/dashboard/processos/${p.id}`}
                            className="font-body text-xs font-semibold text-fg hover:text-primary"
                          >
                            {p.clientName}
                          </Link>
                          <p className="font-body text-[11px] text-muted">
                            {p.tipoAcao}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          {meta ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${meta.bg} ${meta.color}`}
                            >
                              {meta.label}
                            </span>
                          ) : (
                            <span className="font-body text-xs text-muted">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-body text-xs font-semibold tabular-nums whitespace-nowrap">
                          {p.semHonorarioDefinido ? (
                            <span className="text-amber-600">
                              Não cadastrado
                            </span>
                          ) : (
                            <span className="text-emerald-700">
                              {fmt(p.honorarioEstimado)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.responsaveis.filter((r) => r.comissaoEstimada > 0)
                            .length === 0 ? (
                            <span className="font-body text-xs text-muted">
                              —
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              {p.responsaveis
                                .filter((r) => r.comissaoEstimada > 0)
                                .map((r) => (
                                  <p
                                    key={r.colaboradorId}
                                    className="font-body text-xs text-amber-700"
                                  >
                                    {r.nome}:{" "}
                                    <span className="font-semibold">
                                      {fmt(r.comissaoEstimada)}
                                    </span>
                                    {r.comissaoPct != null &&
                                      ` (${r.comissaoPct}%)`}
                                  </p>
                                ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
