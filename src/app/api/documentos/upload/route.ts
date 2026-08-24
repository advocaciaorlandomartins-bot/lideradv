import { NextResponse, after } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarEntidade } from "@/lib/acesso";
import { analisarDocumento } from "@/lib/cerebroJuridico";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ENTITY_TYPES = ["processo", "cliente", "pericia"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

// Cada tipo de entidade é dono de um módulo de permissão diferente — usar
// "processos" fixo pra tudo deixava um Advogado(a) sem "clientes:criar"
// enviar documento em qualquer cliente, e travava quem só tinha
// "clientes" (sem "processos") de anexar documento de cliente.
const MODULO_POR_ENTITY_TYPE: Record<EntityType, string> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

// Tipos aceitos para documentos do escritório — bloqueia HTML/SVG/executáveis
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "odt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "txt",
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
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

  if (
    !hasPermission(
      session,
      MODULO_POR_ENTITY_TYPE[entityType as EntityType],
      "criar"
    )
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 5 MB.`,
      },
      { status: 413 }
    );
  }

  if (!UUID_RE.test(entityId)) {
    return NextResponse.json({ error: "entityId inválido." }, { status: 400 });
  }

  // hasPermission acima só checa o módulo em geral — sem isto, um usuário
  // sem "processos_ver_todos" anexava documento em QUALQUER processo do
  // escritório, não só nos que ele é responsável.
  if (!(await podeAcessarEntidade(session, entityType as EntityType, entityId)))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  if (
    !ALLOWED_EXTENSIONS.has(ext) ||
    (file.type && !ALLOWED_MIME_TYPES.has(file.type))
  ) {
    return NextResponse.json(
      {
        error:
          "Tipo de arquivo não permitido. Aceitos: PDF, Word, Excel, ODT, imagens (JPG/PNG/WEBP) e TXT.",
      },
      { status: 400 }
    );
  }

  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blobPath = `documentos/${entityType}s/${entityId}/${uniqueName}`;

  let blobUrl: string;
  try {
    const blob = await put(blobPath, file, {
      access: "private",
      contentType: file.type || "application/octet-stream",
    });
    blobUrl = blob.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[documentos/upload] Vercel Blob error:", msg);
    return NextResponse.json(
      { error: "Erro ao fazer upload do arquivo. Tente novamente." },
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
    const documentoId = rows[0].id as string;

    // Análise automática pelo Cérebro Jurídico — roda em segundo plano
    // depois da resposta já ter sido enviada (after()/waitUntil da Vercel
    // garante que termina mesmo sem o usuário esperando). Só PDF/imagem
    // (os únicos formatos que analisarDocumento sabe ler) e só quando
    // anexado direto a um processo (é o que a função espera receber).
    const isPdfOrImage =
      (file.type || "").includes("pdf") ||
      (file.type || "").startsWith("image/");
    if (entityType === "processo" && isPdfOrImage) {
      after(async () => {
        try {
          await analisarDocumento(documentoId, entityId);
        } catch (e) {
          console.error("[documentos/upload] falha na análise automática:", e);
        }
      });
    }

    return NextResponse.json({ id: documentoId, url: blobUrl });
  } catch (err) {
    console.error("[documentos/upload] DB error:", err);
    return NextResponse.json(
      { error: "Erro ao registrar documento no banco." },
      { status: 500 }
    );
  }
}
