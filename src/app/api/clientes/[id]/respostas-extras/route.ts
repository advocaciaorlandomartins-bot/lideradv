import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarCliente } from "@/lib/acesso";
import { getClientFull } from "@/lib/clients-db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Usado pelo wizard "Novo envelope" pra pré-preencher as perguntas_extras
// (ex: b.1 a b.5 do Formulário LOAS) já respondidas antes pra esse
// cliente — sem isso, o usuário tinha que digitar tudo de novo mesmo já
// tendo respondido uma vez pelo modal "Gerar Documento".
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  if (!(await podeAcessarCliente(session, id)))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const client = await getClientFull(id);
  if (!client)
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );

  return NextResponse.json({ respostas: client.respostas_extras ?? {} });
}
