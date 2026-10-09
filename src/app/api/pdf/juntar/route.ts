import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, EncryptedPDFError } from "pdf-lib";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > 100 * 1024 * 1024)
      return NextResponse.json(
        { error: "Arquivos muito grandes. Limite total: 100 MB." },
        { status: 413 }
      );

    const merged = await PDFDocument.create();

    for (const file of files) {
      const buf = await file.arrayBuffer();
      // Sem ignoreEncryption — ver comentário em remover-senha/route.ts.
      // Achado em auditoria de 2026-10-09.
      let doc: PDFDocument;
      try {
        doc = await PDFDocument.load(buf);
      } catch (err) {
        if (
          err instanceof EncryptedPDFError ||
          String(err).toLowerCase().includes("encrypt")
        ) {
          return NextResponse.json(
            {
              error: `O arquivo "${file.name}" está protegido por senha e não pode ser processado: nossa ferramenta não suporta PDFs criptografados no momento.`,
            },
            { status: 400 }
          );
        }
        throw err;
      }
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }

    const bytes = await merged.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="juntos.pdf"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao juntar PDFs." },
      { status: 500 }
    );
  }
}
