import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, EncryptedPDFError } from "pdf-lib";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const senha = (form.get("senha") as string) || "";

    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );

    const buf = await file.arrayBuffer();

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    } catch (err) {
      if (
        err instanceof EncryptedPDFError ||
        String(err).toLowerCase().includes("encrypt")
      ) {
        return NextResponse.json(
          {
            error:
              "Não foi possível processar este PDF protegido. O pdf-lib não suporta descriptografia de PDFs com senha.",
          },
          { status: 400 }
        );
      }
      throw err;
    }

    const bytes = await doc.save({ useObjectStreams: true });

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="sem-senha.pdf"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao remover senha do PDF." },
      { status: 500 }
    );
  }
}
