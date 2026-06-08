import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAllUsuarios } from "@/lib/usuarios-db";
import UsuariosList from "@/components/dashboard/usuarios/usuarios-list";

export const metadata = {
  title: "Usuários e Permissões — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getSession();
  if (!user || !hasPermission(user, "usuarios", "ver")) notFound();

  const usuarios = await getAllUsuarios();
  const ativos = usuarios.filter((u) => u.ativo).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">
          Usuários e Permissões
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          {ativos} usuário{ativos !== 1 ? "s" : ""} ativo
          {ativos !== 1 ? "s" : ""}
        </p>
      </div>

      <UsuariosList usuarios={usuarios} />
    </div>
  );
}
