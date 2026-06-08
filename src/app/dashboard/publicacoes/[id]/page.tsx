import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const metadata = { title: "Publicação — LiderAdv" };

import { getPublicacaoById } from "@/lib/publicacoes-db";
import { calcularPrazos } from "@/lib/publicacoes-datas";
import {
  ChevronRightIcon,
  CalendarIcon,
  SparklesIcon,
} from "@/components/icons";
import PublicacaoDetalheActions from "./detalhe-actions";

export const dynamic = "force-dynamic";

const TRIBUNAL_URLS: [string, string][] = [
  ["TJSP", "https://esaj.tjsp.jus.br/"],
  ["TJRJ", "https://www.tjrj.jus.br/"],
  ["TJMG", "https://www.tjmg.jus.br/"],
  ["TJRS", "https://www.tjrs.jus.br/"],
  ["TJPR", "https://www.tjpr.jus.br/"],
  ["TJBA", "https://www.tjba.jus.br/"],
  ["TJPE", "https://www.tjpe.jus.br/"],
  ["TJSC", "https://www.tjsc.jus.br/"],
  ["TJCE", "https://www.tjce.jus.br/"],
  ["TJGO", "https://www.tjgo.jus.br/"],
  ["TJMA", "https://www.tjma.jus.br/"],
  ["TJMT", "https://www.tjmt.jus.br/"],
  ["TJMS", "https://www.tjms.jus.br/"],
  ["TJPA", "https://www.tjpa.jus.br/"],
  ["TJES", "https://www.tjes.jus.br/"],
  ["TJAL", "https://www.tjal.jus.br/"],
  ["TJAM", "https://www.tjam.jus.br/"],
  ["TJTO", "https://www.tjto.jus.br/"],
  ["TJRN", "https://www.tjrn.jus.br/"],
  ["TJPB", "https://www.tjpb.jus.br/"],
  ["TJSE", "https://www.tjse.jus.br/"],
  ["TJPI", "https://www.tjpi.jus.br/"],
  ["TJET", "https://www.tst.jus.br/"],
  ["TRT", "https://www.tst.jus.br/"],
  ["TRF1", "https://www.trf1.jus.br/"],
  ["TRF2", "https://www.trf2.jus.br/"],
  ["TRF3", "https://www.trf3.jus.br/"],
  ["TRF4", "https://www.trf4.jus.br/"],
  ["TRF5", "https://www.trf5.jus.br/"],
  ["STJ", "https://www.stj.jus.br/"],
  ["STF", "https://www.stf.jus.br/"],
];

function getTribunalUrl(tribunal: string): string | null {
  const t = tribunal.toUpperCase();
  for (const [key, url] of TRIBUNAL_URLS) {
    if (t.includes(key)) return url;
  }
  return null;
}

export default async function PublicacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "ver")) notFound();

  const { id } = await params;
  const pub = await getPublicacaoById(Number(id));
  if (!pub) notFound();

  const prazos = calcularPrazos(
    pub.disponibilizacao,
    pub.resumo_ia?.prazo_dias ?? null
  );
  const tribunalUrl = getTribunalUrl(pub.tribunal);

  const statusCls =
    pub.status === "nao_lida"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const timelineSteps = prazos
    ? [
        {
          label: "Disponibilização",
          sub: null,
          date: prazos.disponibilizacao,
          desc: "Data de disponibilização no DJe",
          dotColor: "bg-slate-300 border-slate-300",
          textColor: "text-muted",
          isLast: false,
        },
        {
          label: "Publicação",
          sub: "+1 dia útil",
          date: prazos.publicacao,
          desc: "Considera-se publicada no 1º dia útil seguinte",
          dotColor: "bg-slate-300 border-slate-300",
          textColor: "text-muted",
          isLast: false,
        },
        {
          label: "Início do Prazo",
          sub: "+1 dia útil",
          date: prazos.inicio_prazo,
          desc: "Início da contagem do prazo processual",
          dotColor: "bg-primary border-primary",
          textColor: "text-primary",
          isLast: !prazos.prazo_final,
        },
        ...(prazos.prazo_final
          ? [
              {
                label: "Prazo Final",
                sub: pub.resumo_ia?.prazo_dias
                  ? `+${pub.resumo_ia.prazo_dias} dias úteis`
                  : null,
                date: prazos.prazo_final,
                desc: "Data limite para manifestação",
                dotColor: "bg-cta border-cta",
                textColor: "text-cta",
                isLast: true,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/publicacoes"
          className="transition-colors hover:text-primary"
        >
          Publicações
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-fg">
          #{pub.id} · {pub.tipo}
        </span>
      </nav>

      {/* Header Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-body text-xs font-semibold ${statusCls}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${pub.status === "nao_lida" ? "bg-amber-500" : "bg-emerald-500"}`}
              />
              {pub.status === "nao_lida" ? "Não lida" : "Tratada"}
            </span>
            <span className="font-body text-xs text-muted">
              {pub.origem === "automatica"
                ? "Captura automática"
                : "Entrada manual"}
            </span>
          </div>
          <h1 className="mt-2 font-heading text-xl font-semibold text-fg">
            #{pub.id} — {pub.tipo}
          </h1>
          <p className="mt-0.5 font-mono text-sm text-muted">{pub.processo}</p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {pub.orgao} · {pub.tribunal}
          </p>
        </div>

        {/* Action buttons — client component */}
        <div className="border-t border-border bg-slate-50/50 px-5 py-3">
          <PublicacaoDetalheActions pub={pub} tribunalUrl={tribunalUrl} />
        </div>
      </div>

      {/* AI Summary + Prazos grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* AI Summary Card */}
        {pub.resumo_ia ? (
          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
              <SparklesIcon className="h-4 w-4 text-indigo-600" />
              <h2 className="font-heading text-sm font-semibold text-indigo-900">
                Resumo Inteligente
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <p className="font-body text-sm leading-relaxed text-fg">
                {pub.resumo_ia.texto}
              </p>
              <div className="flex flex-wrap gap-2">
                {pub.resumo_ia.prazo_dias != null && (
                  <span className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 font-body text-xs font-semibold text-primary">
                    Prazo: {pub.resumo_ia.prazo_dias} dias úteis
                  </span>
                )}
                {pub.resumo_ia.acao_necessaria && (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-body text-xs font-semibold text-amber-700">
                    {pub.resumo_ia.acao_necessaria}
                  </span>
                )}
                {pub.resumo_ia.audiencia && (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-body text-xs font-semibold text-emerald-700">
                    Audiência: {pub.resumo_ia.audiencia}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <SparklesIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="font-heading text-sm font-semibold text-indigo-900">
              Resumo Inteligente
            </p>
            <p className="mt-1 max-w-xs font-body text-xs text-muted">
              Analise esta publicação com IA para extrair prazo processual, ação
              necessária e data de audiência.
            </p>
            <button
              disabled
              className="mt-4 flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-primary/80 px-4 py-2 font-body text-sm font-semibold text-white opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              Gerar Resumo
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs leading-none">
                Em breve
              </span>
            </button>
          </div>
        )}

        {/* Prazos — Lei 11.419/2006 */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CalendarIcon className="h-4 w-4 text-muted" />
            <h2 className="font-heading text-sm font-semibold text-fg">
              Prazos · Lei 11.419/2006
            </h2>
          </div>
          {prazos ? (
            <div className="p-5">
              <div className="space-y-0">
                {timelineSteps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 ${step.dotColor}`}
                      />
                      {!step.isLast && (
                        <div
                          className="mt-1 w-px flex-1 bg-border"
                          style={{ minHeight: "32px" }}
                        />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                          {step.label}
                        </span>
                        {step.sub && (
                          <span className="font-body text-xs font-medium text-indigo-500">
                            {step.sub}
                          </span>
                        )}
                      </div>
                      <p
                        className={`font-heading text-lg font-bold ${step.textColor}`}
                      >
                        {step.date}
                      </p>
                      <p className="font-body text-xs text-muted">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {!prazos.prazo_final && (
                <p className="mt-1 font-body text-xs text-muted/70">
                  * Gere o resumo inteligente para calcular o prazo final.
                </p>
              )}
            </div>
          ) : (
            <div className="p-5">
              <p className="font-body text-sm text-muted">
                Não foi possível calcular os prazos desta publicação.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info + Partes grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Informações */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-fg">
              Informações
            </h2>
          </div>
          <dl className="divide-y divide-border">
            {[
              { label: "Nº do Processo", value: pub.processo, mono: true },
              { label: "Tipo", value: pub.tipo },
              { label: "Órgão", value: pub.orgao },
              { label: "Tribunal", value: pub.tribunal },
              { label: "Disponibilização", value: pub.disponibilizacao },
              {
                label: "Origem",
                value:
                  pub.origem === "automatica"
                    ? "Busca automática"
                    : "Entrada manual",
              },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-start gap-3 px-5 py-2.5">
                <dt className="w-32 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted pt-0.5">
                  {label}
                </dt>
                <dd
                  className={`font-body text-sm text-fg ${mono ? "font-mono break-all" : ""}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Partes */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-fg">
              Partes
            </h2>
          </div>
          <div className="divide-y divide-border">
            <div className="px-5 py-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Destinatário
              </p>
              <p className="mt-1 font-body text-sm text-fg">
                {pub.destinatario}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Advogados
              </p>
              <div className="space-y-1">
                {pub.advogados.length > 0 ? (
                  pub.advogados.map((adv, i) => (
                    <p
                      key={i}
                      className={`font-body text-sm ${
                        i === 0 ? "font-semibold text-cta" : "text-muted"
                      }`}
                    >
                      {adv}
                    </p>
                  ))
                ) : (
                  <p className="font-body text-sm text-muted">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Texto Integral */}
      {(pub.conteudo_completo || pub.conteudo) && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-fg">
              Texto Integral
            </h2>
            <span className="font-body text-xs text-muted">
              {(pub.conteudo_completo ?? pub.conteudo)!.length.toLocaleString(
                "pt-BR"
              )}{" "}
              caracteres
            </span>
          </div>
          <div className="p-5">
            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-fg">
              {pub.conteudo_completo ?? pub.conteudo}
            </p>
          </div>
        </div>
      )}

      {!pub.conteudo && !pub.conteudo_completo && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-body text-sm text-muted">
            Conteúdo completo não disponível para esta publicação.
          </p>
        </div>
      )}
    </div>
  );
}
