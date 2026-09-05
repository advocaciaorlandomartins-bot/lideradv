import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MIME_SUPORTADOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Serverless Functions da Vercel têm um limite fixo de 4,5 MB pro corpo da
// requisição — documentos escaneados reais (procuração + RG + laudo etc)
// passam disso fácil, então o arquivo precisa ir direto do navegador pro
// Blob (nunca passar pelo corpo de uma rota normal). 25 MB cobre os casos
// reais do escritório com folga e ainda fica dentro do limite de PDF da
// Anthropic (32 MB / 100 páginas).
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session) throw new Error("Não autorizado.");
        return {
          allowedContentTypes: MIME_SUPORTADOS,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.id }),
        };
      },
      onUploadCompleted: async () => {
        // Anexo é efêmero — vale só pra essa mensagem da Íris, não precisa
        // de registro em banco nem de limpeza depois.
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
