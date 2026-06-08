import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getLancamentoById } from "@/lib/lancamentos-db";
import { getAllClients } from "@/lib/clients-db";
import { getAllProcessos } from "@/lib/processos-db";
import EditLancamentoForm from "@/components/dashboard/financeiro/edit-lancamento-form";
import { ChevronRightIcon, ShieldCheckIcon } from "@/components/icons";

export const metadata = {
  title: "Editar Lançamento — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function EditarLancamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar")) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <ShieldCheckIcon className="h-7 w-7 text-red-500" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-semibold text-fg">
            Acesso restrito
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Você não tem permissão para editar lançamentos financeiros.
          </p>
        </div>
        <Link
          href="/dashboard/financeiro"
          className="mt-2 flex h-10 items-center rounded-lg border border-border px-5 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
        >
          Voltar ao Financeiro
        </Link>
      </div>
    );
  }

  const [lancamento, clients, processos] = await Promise.all([
    getLancamentoById(id),
    getAllClients(),
    getAllProcessos(),
  ]);

  if (!lancamento) notFound();

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    doc: c.doc,
  }));

  const processoOptions = processos.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    tipo_acao: p.tipo_acao,
    numero: p.numero,
    valor_causa: p.valor_causa,
  }));

  const tipoLabel = lancamento.tipo === "entrada" ? "Entrada" : "Saída";
  const parcelaLabel =
    lancamento.grupo_parcelas != null
      ? lancamento.parcela_atual === 0
        ? " — Entrada"
        : ` — Parcela ${lancamento.parcela_atual}/${lancamento.total_parcelas}`
      : "";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/financeiro"
          className="hover:text-primary transition-colors duration-150"
        >
          Financeiro
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Editar lançamento</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Editar lançamento
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {tipoLabel} · {lancamento.descricao}
          {parcelaLabel}
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <EditLancamentoForm
          lancamento={lancamento}
          clients={clientOptions}
          processos={processoOptions}
        />
      </div>
    </div>
  );
}
