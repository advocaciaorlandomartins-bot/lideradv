import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getEnvelopeById } from "@/lib/assinaturas-db";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando: "Aguardando",
  concluido: "Concluído",
  expirado: "Expirado",
  cancelado: "Cancelado",
};
const STATUS_CLASS: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  aguardando: "bg-amber-50 text-amber-700",
  concluido: "bg-emerald-50 text-emerald-700",
  expirado: "bg-red-50 text-red-600",
  cancelado: "bg-slate-100 text-slate-500",
};
const ASSINANTE_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  assinado: "Assinado",
  recusado: "Recusado",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function EnvelopeDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "assinaturas", "ver")) notFound();

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const envelope = await getEnvelopeById(id);
  if (!envelope) notFound();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/assinaturas"
          className="transition-colors hover:text-primary"
        >
          Assinaturas
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-fg">{envelope.nome}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold text-fg">
              {envelope.nome}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[envelope.status] ?? "bg-slate-100 text-slate-600"}`}
            >
              {STATUS_LABEL[envelope.status] ?? envelope.status}
            </span>
          </div>
          <p className="mt-1 font-body text-sm text-muted">
            Cliente: {envelope.cliente_nome ?? "—"} · Prazo:{" "}
            {fmtDate(envelope.prazo)} · Criado em {fmtDate(envelope.criado_em)}
          </p>
        </div>
      </div>

      {/* Assinantes */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-base font-semibold text-fg">
          Assinantes
        </h2>
        {envelope.assinantes.length === 0 ? (
          <p className="font-body text-sm text-muted">Nenhum assinante.</p>
        ) : (
          <ul className="space-y-2">
            {envelope.assinantes.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-semibold text-fg truncate">
                    {a.nome}
                  </p>
                  <p className="font-body text-xs text-muted truncate">
                    {a.email} · {a.papel}
                  </p>
                  {a.tramitasignLink && (
                    <a
                      href={a.tramitasignLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-body text-xs font-semibold text-primary hover:underline"
                    >
                      Link de assinatura →
                    </a>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                    a.status === "assinado"
                      ? "bg-emerald-50 text-emerald-700"
                      : a.status === "recusado"
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ASSINANTE_STATUS_LABEL[a.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documentos */}
      <div className="space-y-4">
        <h2 className="font-heading text-base font-semibold text-fg">
          Documentos
        </h2>
        {envelope.documentos.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-6 font-body text-sm text-muted shadow-sm">
            Nenhum documento neste envelope.
          </p>
        ) : (
          envelope.documentos.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-border bg-white shadow-sm"
            >
              <div className="border-b border-border px-6 py-3">
                <p className="font-body text-sm font-semibold text-fg">
                  {doc.nome}
                </p>
              </div>
              <div
                className="prose prose-sm max-w-none px-6 py-5 font-body text-sm text-fg"
                // Conteúdo gerado internamente por blocksToHtml/textToHtml a
                // partir de um Modelo do escritório — todo texto já passou
                // por escape de HTML antes de virar span/parágrafo/etc.
                dangerouslySetInnerHTML={{ __html: doc.htmlContent }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
