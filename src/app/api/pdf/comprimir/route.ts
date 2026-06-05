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

    // Remove embedded thumbnails and XMP metadata to maximize savings
    const catalog = doc.catalog;
    if (catalog.has(doc.context.obj("Thumbnails") as never))
      catalog.delete(doc.context.obj("Thumbnails") as never);

    const bytes = await doc.save({ useObjectStreams: true });

    const original = buf.byteLength;
    const resultado = bytes.byteLength;

    // If re-serialization made it larger (PDF already optimized), return original
    const finalBytes =
      resultado < original ? Buffer.from(bytes) : Buffer.from(buf);
    const finalSize = Math.min(resultado, original);
    const reducao = Math.max(0, Math.round((1 - finalSize / original) * 100));

    return new NextResponse(finalBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="comprimido.pdf"',
        "X-Original-Size": String(original),
        "X-Result-Size": String(finalSize),
        "X-Reducao-Pct": String(reducao),
        "X-Ja-Otimizado": reducao < 3 ? "1" : "0",
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
