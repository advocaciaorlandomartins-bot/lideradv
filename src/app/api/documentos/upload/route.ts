import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarEntidade } from "@/lib/acesso";

export const dynamic = "force-dynamic";

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

// Serverless Functions da Vercel têm um limite fixo de 4,5 MB pro corpo da
// requisição — o antigo upload via FormData batia nesse teto (silenciosamente
// pior que o "limite de 5MB" mostrado na tela, já que 4,5 < 5) bem antes de
// documentos reais de processo (procuração + RG + laudo digitalizados
// passam de 10MB fácil). Upload vai direto do navegador pro Blob agora —
// só o token pequeno passa por esta rota, nunca os bytes do arquivo.
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = [
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
];
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

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const session = await getSession();
        if (!session) throw new Error("Não autorizado.");

        let payload: { entityType?: string; entityId?: string } = {};
        try {
          payload = clientPayloadRaw ? JSON.parse(clientPayloadRaw) : {};
        } catch {
          throw new Error("Payload inválido.");
        }
        const entityType = payload.entityType;
        const entityId = payload.entityId;

        if (
          !entityType ||
          !VALID_ENTITY_TYPES.includes(entityType as EntityType)
        )
          throw new Error("entityType inválido.");
        if (!entityId || !UUID_RE.test(entityId))
          throw new Error("entityId inválido.");
        if (
          !hasPermission(
            session,
            MODULO_POR_ENTITY_TYPE[entityType as EntityType],
            "criar"
          )
        )
          throw new Error("Sem permissão.");
        // hasPermission acima só checa o módulo em geral — sem isto, um
        // usuário sem "processos_ver_todos" anexava documento em QUALQUER
        // processo do escritório, não só nos que ele é responsável.
        if (
          !(await podeAcessarEntidade(
            session,
            entityType as EntityType,
            entityId
          ))
        )
          throw new Error("Sem permissão.");

        const ext = (pathname.split(".").pop() ?? "").toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext))
          throw new Error(
            "Tipo de arquivo não permitido. Aceitos: PDF, Word, Excel, ODT, imagens (JPG/PNG/WEBP) e TXT."
          );

        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: session.id,
            entityType,
            entityId,
          }),
        };
      },
      onUploadCompleted: async () => {
        // O registro em `documentos` (e a análise automática do Cérebro
        // Jurídico) acontece em /api/documentos/confirmar, chamado pelo
        // navegador logo depois que upload() resolve — mais simples de
        // depurar que depender do webhook onUploadCompleted da Vercel.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no upload." },
      { status: 400 }
    );
  }
}
