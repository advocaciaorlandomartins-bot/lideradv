import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getAddressByClientId,
  createAddressForClient,
} from "@/lib/inbound-emails-db";
import { logAction } from "@/lib/audit";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  const addr = await getAddressByClientId(id);
  return NextResponse.json({ address: addr });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { id } = await params;

  const clientRows = await sql`
    SELECT name FROM clients WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!clientRows[0])
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );

  const existing = await getAddressByClientId(id);
  if (existing)
    return NextResponse.json(
      { error: "Cliente já possui e-mail exclusivo.", address: existing },
      { status: 409 }
    );

  const addr = await createAddressForClient(id, clientRows[0].name as string);
  await logAction({
    acao: "criar",
    entidade: "inbound_email",
    descricao: `Gerou e-mail exclusivo ${addr.address} para cliente`,
  });

  return NextResponse.json({ address: addr }, { status: 201 });
}
