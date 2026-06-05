import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

// Parseia intervalos como "1-3,5,7-9" → [0,1,2,4,6,7,8] (0-indexed)
function parseIntervals(input: string, total: number): number[] {
  const indices = new Set<number>();
  for (const part of input.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const dash = t.indexOf("-");
    if (dash > 0) {
      const a = parseInt(t.slice(0, dash)) - 1;
      const b = parseInt(t.slice(dash + 1)) - 1;
      for (let i = Math.max(0, a); i <= Math.min(total - 1, b); i++)
        indices.add(i);
    } else {
      const n = parseInt(t) - 1;
      if (n >= 0 && n < total) indices.add(n);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const modo = (form.get("modo") as string) || "paginas";
    const paginas = (form.get("paginas") as string) || "";

    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );

    const buf = await file.arrayBuffer();
    const src = await PDFDocument.load(buf);
    const total = src.getPageCount();

    const zip = new JSZip();

    if (modo === "individual") {
      // Uma página por arquivo
      for (let i = 0; i < total; i++) {
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(src, [i]);
        doc.addPage(page);
        const bytes = await doc.save();
        zip.file(`pagina-${i + 1}.pdf`, bytes);
      }
    } else {
      // Por intervalos especificados
      const indices = paginas.trim()
        ? parseIntervals(paginas, total)
        : [...Array(total).keys()];
      if (!indices.length)
        return NextResponse.json(
          { error: "Intervalo de páginas inválido." },
          { status: 400 }
        );

      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, indices);
      pages.forEach((p) => doc.addPage(p));
      const bytes = await doc.save();
      zip.file("dividido.pdf", bytes);
    }

    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(zipBuf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="dividido.zip"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao dividir PDF." },
      { status: 500 }
    );
  }
}
