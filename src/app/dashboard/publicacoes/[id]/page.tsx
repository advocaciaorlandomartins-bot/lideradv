import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicacaoById } from "@/lib/publicacoes-db";
import { ChevronRightIcon } from "@/components/icons";
import PublicacaoDetalheActions from "./detalhe-actions";

export const dynamic = "force-dynamic";

export default async function PublicacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pub = await getPublicacaoById(Number(id));
  if (!pub) notFound();

  const statusCls =
    pub.status === "nao_lida"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const CAMPOS = [
    { label: "Número do Processo", value: pub.processo, mono: true },
    { label: "Tipo", value: pub.tipo },
    { label: "Destinatário", value: pub.destinatario },
    { label: "Órgão", value: pub.orgao },
    { label: "Tribunal", value: pub.tribunal },
    { label: "Data de Disponibilização", value: pub.disponibilizacao },
    {
      label: "Origem",
      value: pub.origem === "automatica" ? "Busca automática" : "Busca manual",
    },
  ];

  return (
    <div className="space-y-5">
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

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-fg">
              #{pub.id} — {pub.tipo}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-body text-xs font-semibold ${statusCls}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${pub.status === "nao_lida" ? "bg-amber-500" : "bg-emerald-500"}`}
              />
              {pub.status === "nao_lida" ? "Não lida" : "Tratada"}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-muted">{pub.processo}</p>
        </div>
        <PublicacaoDetalheActions pub={pub} />
      </div>

      {/* Dados */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-heading text-sm font-semibold text-fg">
            Informações da Publicação
          </h2>
        </div>
        <dl className="divide-y divide-border">
          {CAMPOS.map(({ label, value, mono }) => (
            <div
              key={label}
              className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <dt className="w-48 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
              </dt>
              <dd
                className={`font-body text-sm text-fg ${mono ? "font-mono" : ""}`}
              >
                {value}
              </dd>
            </div>
          ))}

          {/* Advogados */}
          <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
            <dt className="w-48 flex-shrink-0 font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Advogados
            </dt>
            <dd className="space-y-0.5">
              {pub.advogados.map((adv, i) => (
                <p
                  key={i}
                  className={`font-body text-sm ${i === 0 ? "font-semibold text-cta" : "text-muted"}`}
                >
                  {adv}
                </p>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {/* Conteúdo completo */}
      {(pub.conteudo || pub.conteudo_completo) && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-fg">
              Conteúdo da Publicação
            </h2>
          </div>
          <div className="p-5">
            <p className="whitespace-pre-wrap font-body text-sm text-fg leading-relaxed">
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
