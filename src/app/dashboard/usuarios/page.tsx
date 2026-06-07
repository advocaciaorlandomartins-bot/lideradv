import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllUsuarios, countAtivos, MAX_USUARIOS } from "@/lib/usuarios-db";
import UsuariosList from "@/components/dashboard/usuarios/usuarios-list";

export const metadata = {
  title: "Usuários e Permissões — AdvMartins",
};

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "usuarios", "ver")) notFound();

  const [usuarios, ativos] = await Promise.all([
    getAllUsuarios(),
    countAtivos(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Usuários e Permissões
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {ativos} de {MAX_USUARIOS} usuários ativos
        </p>
      </div>

      <UsuariosList usuarios={usuarios} maxUsuarios={MAX_USUARIOS} />
    </div>
  );
}
