import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );

    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

    // pdf-lib não comprime imagens nativas, mas re-serializa o PDF removendo
    // metadados e streams redundantes — redução real depende do conteúdo original.
    const bytes = await doc.save({ useObjectStreams: true });

    const original = buf.byteLength;
    const resultado = bytes.byteLength;
    const reducao = Math.round((1 - resultado / original) * 100);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="comprimido.pdf"',
        "X-Original-Size": String(original),
        "X-Result-Size": String(resultado),
        "X-Reducao-Pct": String(reducao),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao comprimir PDF." },
      { status: 500 }
    );
  }
}
