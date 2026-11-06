import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { listarBibliotecaJuridica } from "@/lib/biblioteca-juridica-db";
import BibliotecaContent from "@/components/dashboard/biblioteca/biblioteca-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Biblioteca Jurídica — LiderAdv",
};

export default async function BibliotecaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "ver")) notFound();

  const itensIniciais = await listarBibliotecaJuridica();
  const podeAprovar = session.categoria === "Administrador(a)";

  return (
    <BibliotecaContent
      itensIniciais={itensIniciais}
      podeAprovar={podeAprovar}
    />
  );
}
