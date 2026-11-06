import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

// Mesmo teto/lista de /api/documentos/upload — PDF é o caso real (petição,
// sentença, acórdão), imagem fica como fallback pra scan/foto de página.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getSession();
        if (!session) throw new Error("Não autorizado.");
        if (!hasPermission(session, "modelos", "criar"))
          throw new Error("Sem permissão.");

        const ext = (pathname.split(".").pop() ?? "").toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext))
          throw new Error(
            "Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG, WEBP."
          );

        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.id }),
        };
      },
      onUploadCompleted: async () => {
        // Registro em biblioteca_juridica + classificação por IA acontecem
        // em /api/biblioteca/confirmar, chamado pelo navegador logo depois
        // que upload() resolve — mesmo padrão de /api/documentos/upload.
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
