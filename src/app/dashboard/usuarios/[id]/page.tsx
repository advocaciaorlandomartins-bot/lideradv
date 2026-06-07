import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getUsuarioById, getColaboradoresForSelect } from "@/lib/usuarios-db";
import UsuarioForm from "@/components/dashboard/usuarios/usuario-form";

export const metadata = { title: "Editar Usuário — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "usuarios", "editar")) notFound();

  const { id } = await params;
  const [usuario, colaboradores] = await Promise.all([
    getUsuarioById(id),
    getColaboradoresForSelect(),
  ]);
  if (!usuario) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          Editar Usuário
        </h1>
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
            <li>
              <Link
                href="/dashboard/usuarios"
                className="hover:text-primary transition-colors"
              >
                Usuários e Permissões
              </Link>
            </li>
            <li className="select-none">›</li>
            <li className="text-fg font-medium">{usuario.login}</li>
          </ol>
        </nav>
      </div>

      <UsuarioForm usuario={usuario} colaboradores={colaboradores} />
    </div>
  );
}
