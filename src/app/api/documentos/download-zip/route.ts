import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import JSZip from "jszip";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";
import { getDocumentosByEntityId } from "@/lib/documents-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ENTITY_TYPES = ["processo", "cliente", "pericia"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];
const MODULO_POR_ENTITY_TYPE: Record<EntityType, string> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

async function entidadeAtiva(
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  if (entityType === "processo") {
    const rows =
      await sql`SELECT 1 FROM processos WHERE id = ${entityId}::uuid AND deleted_at IS NULL`;
    return rows.length > 0;
  }
  if (entityType === "cliente") {
    const rows =
      await sql`SELECT 1 FROM clients WHERE id = ${entityId}::uuid AND deleted_at IS NULL`;
    return rows.length > 0;
  }
  const rows = await sql`SELECT 1 FROM pericias WHERE id = ${entityId}::uuid`;
  return rows.length > 0;
}

// Nomes únicos dentro do zip mesmo se dois documentos tiverem o mesmo nome.
function nomeUnico(base: string, usados: Set<string>): string {
  if (!usados.has(base)) {
    usados.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let i = 2;
  let candidato = `${stem} (${i})${ext}`;
  while (usados.has(candidato)) {
    i++;
    candidato = `${stem} (${i})${ext}`;
  }
  usados.add(candidato);
  return candidato;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    entityType?: string;
    entityId?: string;
    ids?: string[];
  } | null;

  const entityType = body?.entityType;
  const entityId = body?.entityId;

  if (
    !entityType ||
    !VALID_ENTITY_TYPES.includes(entityType as EntityType) ||
    !entityId ||
    !UUID_RE.test(entityId)
  ) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  if (
    !hasPermission(
      session,
      MODULO_POR_ENTITY_TYPE[entityType as EntityType],
      "ver"
    )
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!(await entidadeAtiva(entityType as EntityType, entityId))) {
    return NextResponse.json(
      { error: "Registro não encontrado." },
      { status: 404 }
    );
  }

  const todos = await getDocumentosByEntityId(
    entityType as EntityType,
    entityId
  );
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  const selecionados = ids ? todos.filter((d) => ids.includes(d.id)) : todos;

  if (selecionados.length === 0) {
    return NextResponse.json(
      { error: "Nenhum documento para baixar." },
      { status: 400 }
    );
  }

  const zip = new JSZip();
  const usados = new Set<string>();
  const falhas: string[] = [];

  for (const doc of selecionados) {
    try {
      const blob = await head(doc.url);
      const res = await fetch(blob.downloadUrl ?? doc.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      zip.file(nomeUnico(doc.nome, usados), bytes);
    } catch (err) {
      console.error(`[documentos/download-zip] falha em ${doc.id}:`, err);
      falhas.push(doc.nome);
    }
  }

  if (usados.size === 0) {
    return NextResponse.json(
      { error: "Não foi possível baixar nenhum dos documentos selecionados." },
      { status: 502 }
    );
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const headers: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="documentos.zip"',
  };
  if (falhas.length > 0) {
    headers["X-Falhas"] = encodeURIComponent(falhas.join(", "));
  }
  return new NextResponse(zipBuf as unknown as BodyInit, { headers });
}
