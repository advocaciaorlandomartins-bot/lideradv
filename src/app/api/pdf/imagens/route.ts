import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length)
      return NextResponse.json(
        { error: "Nenhuma imagem enviada." },
        { status: 400 }
      );

    const doc = await PDFDocument.create();

    for (const file of files) {
      const buf = await file.arrayBuffer();
      const type = file.type;

      let img;
      if (type === "image/jpeg" || type === "image/jpg") {
        img = await doc.embedJpg(buf);
      } else if (type === "image/png") {
        img = await doc.embedPng(buf);
      } else {
        continue; // pula formatos não suportados pelo pdf-lib nativo
      }

      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    if (doc.getPageCount() === 0) {
      return NextResponse.json(
        { error: "Nenhuma imagem válida (JPG ou PNG)." },
        { status: 400 }
      );
    }

    const bytes = await doc.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="imagens.pdf"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao converter imagens." },
      { status: 500 }
    );
  }
}
