import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDocumentosByEntityId } from "@/lib/documents-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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

  const docs = await getDocumentosByEntityId(entityType, entityId);
  return NextResponse.json(docs);
}
