import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { notFound, redirect } from "next/navigation";
import { listarEnvelopes } from "@/lib/assinaturas-db";
import { PlusIcon, PenSignIcon } from "@/components/icons";

export const metadata = { title: "Assinaturas — AdvMartins" };
export const dynamic = "force-dynamic";

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

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function AssinaturasPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!hasPermission(session, "assinaturas", "ver")) notFound();

  const envelopes = await listarEnvelopes(session.login);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            Assinaturas
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            {envelopes.length === 0
              ? "Nenhum envelope criado ainda."
              : `${envelopes.length} envelope${envelopes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/dashboard/assinaturas/novo"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="h-4 w-4" />
          Novo envelope
        </Link>
      </div>

      {envelopes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-20 text-center shadow-sm">
          <PenSignIcon className="mb-3 h-12 w-12 text-muted/40" />
          <p className="font-heading text-lg font-semibold text-fg">
            Nenhum envelope
          </p>
          <p className="mt-1 font-body text-sm text-muted">
            Crie seu primeiro envelope de assinatura digital.
          </p>
          <Link
            href="/dashboard/assinaturas/novo"
            className="mt-5 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Criar envelope
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full font-body text-sm">
            <thead className="border-b border-border bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted">
                  Prazo
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted">
                  Assinantes
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {envelopes.map((env) => (
                <tr
                  key={env.id}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-medium text-fg">{env.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[env.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABEL[env.status] ?? env.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(env.prazo)}</td>
                  <td className="px-4 py-3 text-muted">
                    {env.assinados}/{env.total_assinantes}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {fmtDate(env.criado_em)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
