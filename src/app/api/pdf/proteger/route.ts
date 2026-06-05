import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { encryptPdf } from "@/lib/pdf-encrypt";

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
    if (!senha)
      return NextResponse.json({ error: "Informe a senha." }, { status: 400 });

    const buf = await file.arrayBuffer();
    // Re-serialize with pdf-lib (useObjectStreams: false = traditional xref, needed for post-processing)
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pdfBytes = await doc.save({ useObjectStreams: false });

    // Apply RC4 128-bit encryption via post-processing
    const encrypted = encryptPdf(pdfBytes, senha);

    return new NextResponse(encrypted as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="protegido.pdf"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao proteger PDF." },
      { status: 500 }
    );
  }
}
