import Link from "next/link";
import { getAllModelos } from "@/lib/modelos-db";
import DeleteModeloButton from "@/components/dashboard/modelos/delete-modelo-button";
import { DocumentTextIcon, PlusIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const CATEGORIA_COLORS: Record<string, string> = {
  Contratos: "bg-blue-50 text-blue-700",
  Procurações: "bg-violet-50 text-violet-700",
  Declarações: "bg-amber-50 text-amber-700",
  Notificações: "bg-orange-50 text-orange-700",
  Petições: "bg-cyan-50 text-cyan-700",
  Previdenciário: "bg-purple-50 text-purple-700",
  Família: "bg-pink-50 text-pink-700",
  Trabalhista: "bg-red-50 text-red-700",
  Outro: "bg-slate-100 text-slate-600",
};

export default async function ModelosPage() {
  const modelos = await getAllModelos();

  const categorias = Array.from(
    new Set(modelos.map((m) => m.categoria ?? "Sem categoria"))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg">
            Modelos de Documentos
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Crie e gerencie seus modelos personalizados. Use variáveis como{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-primary">
              {"{{nome}}"}
            </code>{" "}
            para preenchimento automático.
          </p>
        </div>
        <Link
          href="/dashboard/modelos/novo"
          className="flex items-center gap-1.5 rounded-lg bg-cta px-4 h-10 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Modelo
        </Link>
      </div>

      {/* Empty state */}
      {modelos.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <DocumentTextIcon className="h-7 w-7 text-muted" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold text-fg">
              Nenhum modelo cadastrado
            </p>
            <p className="mt-1 font-body text-sm text-muted">
              Crie seu primeiro modelo para gerar PDFs automáticos para os
              clientes
            </p>
          </div>
          <Link
            href="/dashboard/modelos/novo"
            className="flex items-center gap-1.5 rounded-lg bg-cta px-4 h-10 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Criar primeiro modelo
          </Link>
        </div>
      )}

      {/* Grouped list */}
      {categorias.map((cat) => {
        const items = modelos.filter(
          (m) => (m.categoria ?? "Sem categoria") === cat
        );
        return (
          <div key={cat}>
            <h2 className="font-body text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {cat} ({items.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => (
                <div
                  key={m.id}
                  className={`relative flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    m.ativo
                      ? "border-border"
                      : "border-dashed border-slate-300 opacity-60"
                  }`}
                >
                  {/* Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.categoria && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-bold ${CATEGORIA_COLORS[m.categoria] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {m.categoria}
                        </span>
                      )}
                      {!m.ativo && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-[11px] font-semibold text-slate-500">
                          Inativo
                        </span>
                      )}
                    </div>
                    <DocumentTextIcon className="h-5 w-5 flex-shrink-0 text-primary/40 mt-0.5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-heading text-sm font-semibold text-fg leading-snug">
                      {m.titulo}
                    </p>
                    {m.descricao && (
                      <p className="mt-1 font-body text-xs text-muted leading-relaxed">
                        {m.descricao}
                      </p>
                    )}
                    <p className="mt-2 font-body text-[11px] text-slate-400">
                      {m.conteudo.length} caracteres · atualizado{" "}
                      {m.updated_at_formatted}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 border-t border-border pt-3">
                    <Link
                      href={`/dashboard/modelos/${m.id}/editar`}
                      className="flex-1 text-center rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                    >
                      Editar
                    </Link>
                    <DeleteModeloButton id={m.id} titulo={m.titulo} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Stats footer */}
      {modelos.length > 0 && (
        <p className="font-body text-xs text-muted text-center">
          {modelos.filter((m) => m.ativo).length} modelo(s) ativo(s) de{" "}
          {modelos.length} total
        </p>
      )}
    </div>
  );
}
