import Link from "next/link";
import { getAllUsuarios, countAtivos, MAX_USUARIOS } from "@/lib/usuarios-db";
import { ShieldCheckIcon, PlusIcon } from "@/components/icons";
import DeleteUsuarioButton from "@/components/dashboard/usuarios/delete-usuario-button";

export const dynamic = "force-dynamic";

const CATEGORIA_COLORS: Record<string, string> = {
  "Sócio(a)": "bg-violet-50 text-violet-700 border-violet-200",
  "Advogado(a)": "bg-blue-50   text-blue-700   border-blue-200",
  "Estagiário(a)": "bg-amber-50  text-amber-700  border-amber-200",
  "Colaborador(a)": "bg-slate-100 text-slate-600  border-slate-200",
  "Administrador(a)": "bg-red-50    text-red-700    border-red-200",
};

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Agora mesmo";
  if (m < 60) return `Há ${m} minuto${m > 1 ? "s" : ""}`;
  if (h < 24) return `Há ${h} hora${h > 1 ? "s" : ""}`;
  if (d < 30) return `Há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

function absoluteTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsuariosPage() {
  const [usuarios, ativos] = await Promise.all([
    getAllUsuarios(),
    countAtivos(),
  ]);

  const vagasRestantes = MAX_USUARIOS - ativos;

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
            <ShieldCheckIcon className="h-6 w-6 text-primary" />
            Usuários e Permissões
          </h1>
          {/* Breadcrumb */}
          <nav className="mt-1" aria-label="Navegação">
            <ol className="flex items-center gap-1.5 font-body text-xs text-muted">
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-primary transition-colors"
                >
                  Início
                </Link>
              </li>
              <li className="select-none">›</li>
              <li className="text-fg font-medium">Usuários e Permissões</li>
            </ol>
          </nav>
          {/* Contador */}
          <p className="mt-2 font-body text-sm text-muted">
            Usuários ativos: <strong className="text-fg">{ativos}</strong> de{" "}
            <strong className="text-fg">{MAX_USUARIOS}</strong>.{" "}
            {vagasRestantes > 0 ? (
              <>
                Você ainda pode cadastrar{" "}
                <strong className="text-fg">{vagasRestantes}</strong>{" "}
                {vagasRestantes === 1 ? "usuário" : "usuários"}.
              </>
            ) : (
              <span className="text-amber-600 font-semibold">
                Limite atingido.
              </span>
            )}
          </p>
        </div>

        <Link
          href="/dashboard/usuarios/novo"
          className={`flex items-center gap-1.5 rounded-lg px-4 h-10 font-body text-sm font-semibold text-white transition-colors whitespace-nowrap ${
            vagasRestantes > 0
              ? "bg-cta hover:bg-cta-hover"
              : "bg-slate-300 pointer-events-none"
          }`}
          aria-disabled={vagasRestantes === 0}
        >
          <PlusIcon className="h-4 w-4" />
          Novo Usuário
        </Link>
      </div>

      {/* ── Tabela ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldCheckIcon className="h-10 w-10 text-border" />
            <p className="font-heading text-base font-semibold text-fg">
              Nenhum usuário cadastrado
            </p>
            <p className="font-body text-sm text-muted">
              Crie o primeiro usuário para começar.
            </p>
            <Link
              href="/dashboard/usuarios/novo"
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-4 h-9 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Novo Usuário
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Login
                  </th>
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Nome
                  </th>
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Categoria
                  </th>
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Validade
                  </th>
                  <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Último acesso
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className={`group transition-colors hover:bg-slate-50 ${!u.ativo ? "opacity-50" : ""}`}
                  >
                    {/* Login */}
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/usuarios/${u.id}`}
                        className="flex items-center gap-2 font-body text-sm font-semibold text-primary hover:underline"
                      >
                        <svg
                          className="h-4 w-4 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {u.login}
                        {!u.ativo && (
                          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 font-body text-[10px] text-slate-500">
                            inativo
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Nome */}
                    <td className="px-5 py-3.5 font-body text-sm text-fg">
                      {u.nome}
                    </td>

                    {/* Categoria */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-xs font-semibold ${CATEGORIA_COLORS[u.categoria] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                      >
                        {u.categoria}
                      </span>
                    </td>

                    {/* Validade */}
                    <td className="px-5 py-3.5 font-body text-sm text-muted">
                      {u.validade ? (
                        new Date(u.validade).toLocaleDateString("pt-BR")
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Último acesso */}
                    <td className="px-5 py-3.5 font-body text-sm text-muted">
                      {u.ultimo_acesso ? (
                        <span title={absoluteTime(u.ultimo_acesso)}>
                          {relativeTime(u.ultimo_acesso)}
                        </span>
                      ) : (
                        <span className="text-slate-300">Nunca</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/dashboard/usuarios/${u.id}`}
                          className="rounded-lg border border-border px-3 h-8 font-body text-xs font-semibold text-fg flex items-center hover:border-primary hover:text-primary transition-colors"
                        >
                          Editar
                        </Link>
                        <DeleteUsuarioButton id={u.id} login={u.login} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
