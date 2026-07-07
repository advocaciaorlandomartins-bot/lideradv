import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ENTITY_TYPES = ["processo", "cliente", "pericia"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "criar")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const entityType = formData.get("entityType") as string | null;
  const entityId = formData.get("entityId") as string | null;

  if (!file || !entityType || !entityId) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes." },
      { status: 400 }
    );
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
    return NextResponse.json(
      { error: "entityType inválido." },
      { status: 400 }
    );
  }

  if (!UUID_RE.test(entityId)) {
    return NextResponse.json({ error: "entityId inválido." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blobPath = `documentos/${entityType}s/${entityId}/${uniqueName}`;

  let blobUrl: string;
  try {
    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("[documentos/upload] Vercel Blob error:", err);
    return NextResponse.json(
      { error: "Erro ao enviar arquivo para o armazenamento." },
      { status: 500 }
    );
  }

  try {
    const rows = await sql`
      INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
      VALUES (
        ${entityType},
        ${entityId}::uuid,
        ${file.name},
        ${file.type || null},
        ${file.size},
        ${blobPath},
        ${blobUrl}
      )
      RETURNING id::text
    `;
    return NextResponse.json({ id: rows[0].id, url: blobUrl });
  } catch (err) {
    console.error("[documentos/upload] DB error:", err);
    return NextResponse.json(
      { error: "Erro ao registrar documento no banco." },
      { status: 500 }
    );
  }
}
