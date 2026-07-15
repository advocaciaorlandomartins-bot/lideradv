import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getDocumentosByEntityId } from "@/lib/documents-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasPermission(session, "processos", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as
    | "processo"
    | "cliente"
    | "pericia"
    | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId)
    return NextResponse.json(
      { error: "entityType e entityId são obrigatórios." },
      { status: 400 }
    );

  const VALID_TYPES = ["processo", "cliente", "pericia"];
  if (!VALID_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: "entityType inválido." },
      { status: 400 }
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(entityId)) {
    return NextResponse.json({ error: "entityId inválido." }, { status: 400 });
  }

  const docs = await getDocumentosByEntityId(entityType, entityId);
  return NextResponse.json(docs);
}
