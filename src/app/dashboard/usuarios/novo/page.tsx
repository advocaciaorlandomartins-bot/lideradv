import Link from "next/link";
import { ShieldCheckIcon } from "@/components/icons";
import UsuarioForm from "@/components/dashboard/usuarios/usuario-form";

export default function NovoUsuarioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          Novo Usuário
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
            <li className="text-fg font-medium">Novo Usuário</li>
          </ol>
        </nav>
      </div>

      <UsuarioForm />
    </div>
  );
}
