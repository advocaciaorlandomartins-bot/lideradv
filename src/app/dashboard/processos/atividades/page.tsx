import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAtividadesPrazoDetalhe,
  type FiltroAtividadePrazo,
} from "@/lib/processos-db";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { AlertIcon, ChevronLeftIcon } from "@/components/icons";

export const metadata = { title: "Atividades em aberto — LiderAdv" };
export const dynamic = "force-dynamic";

const FILTROS_VALIDOS = new Set<FiltroAtividadePrazo>([
  "atrasadas",
  "hoje",
  "amanha",
  "futuras",
  "semData",
]);

const FILTRO_LABEL: Record<FiltroAtividadePrazo, string> = {
  atrasadas: "Atrasadas",
  hoje: "Para hoje",
  amanha: "Para amanhã",
  futuras: "Futuras",
  semData: "Sem data",
};

export default async function AtividadesPrazoPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  const { filtro: filtroRaw } = await searchParams;
  const filtro: FiltroAtividadePrazo = FILTROS_VALIDOS.has(
    filtroRaw as FiltroAtividadePrazo
  )
    ? (filtroRaw as FiltroAtividadePrazo)
    : "atrasadas";

  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const itens = await getAtividadesPrazoDetalhe(
    verTodos ? null : colaboradorId,
    filtro
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/processos"
          className="flex items-center gap-1 font-body text-xs font-semibold text-muted hover:text-primary"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar pra Processos
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-fg">
          Atividades em aberto — {FILTRO_LABEL[filtro]}
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {itens.length}{" "}
          {itens.length === 1 ? "tarefa de processo" : "tarefas de processo"}{" "}
          pendente(s)/em andamento
        </p>
      </div>

      {/* Abas de filtro */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTRO_LABEL) as FiltroAtividadePrazo[]).map((f) => (
          <Link
            key={f}
            href={`/dashboard/processos/atividades?filtro=${f}`}
            className={`rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
              filtro === f
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {FILTRO_LABEL[f]}
          </Link>
        ))}
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-white py-16 text-center">
          <p className="font-heading text-base font-semibold text-fg">
            Nada por aqui
          </p>
          <p className="font-body text-sm text-muted">
            Nenhuma tarefa de processo {FILTRO_LABEL[filtro].toLowerCase()}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full">
            <thead className="border-b border-border bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Tarefa
                </th>
                <th className="px-4 py-2.5 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Cliente / Processo
                </th>
                <th className="px-4 py-2.5 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Prazo
                </th>
                <th className="px-4 py-2.5 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Prioridade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itens.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-body text-sm text-fg">
                    {item.titulo}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-slate-600">
                    <Link
                      href={`/dashboard/processos/${item.processoId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {item.clienteNome ?? "—"}
                    </Link>
                    {item.processoNumero && (
                      <p className="font-body text-xs text-muted">
                        {item.processoNumero}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm">
                    {item.prazo ? (
                      <span
                        className={
                          filtro === "atrasadas"
                            ? "flex items-center gap-1 font-semibold text-red-600"
                            : "text-slate-600"
                        }
                      >
                        {filtro === "atrasadas" && (
                          <AlertIcon className="h-3.5 w-3.5" />
                        )}
                        {item.prazo}
                        {filtro === "atrasadas" &&
                          item.diasAtraso != null &&
                          item.diasAtraso > 0 &&
                          ` (${item.diasAtraso}d)`}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-slate-600">
                    {item.prioridade ?? "—"}
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
