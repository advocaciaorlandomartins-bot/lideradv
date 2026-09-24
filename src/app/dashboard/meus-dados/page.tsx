import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getColaboradorFull } from "@/lib/colaboradores-db";
import { getDocumentosByEntityId } from "@/lib/documents-db";
import MeusDadosContent from "@/components/dashboard/colaboradores/meus-dados-content";

export const metadata = {
  title: "Meus Dados — LiderAdv",
};

export const dynamic = "force-dynamic";

export default async function MeusDadosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId) {
    return (
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold text-fg">
          Meus Dados
        </h1>
        <p className="font-body text-sm text-muted">
          Seu usuário não está vinculado a um cadastro de colaborador — fale com
          o administrador do sistema.
        </p>
      </div>
    );
  }

  const [colaborador, documentos] = await Promise.all([
    getColaboradorFull(colaboradorId),
    getDocumentosByEntityId("colaborador", colaboradorId),
  ]);

  if (!colaborador) {
    return (
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold text-fg">
          Meus Dados
        </h1>
        <p className="font-body text-sm text-muted">
          Cadastro de colaborador não encontrado — fale com o administrador do
          sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg">
          Meus Dados
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Seus dados de contato, endereço e arquivos pessoais (ex: contratos
          assinados).
        </p>
      </div>
      <MeusDadosContent colaborador={colaborador} documentos={documentos} />
    </div>
  );
}
