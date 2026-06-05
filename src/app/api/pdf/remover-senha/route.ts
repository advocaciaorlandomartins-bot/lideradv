import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

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
    const doc = await PDFDocument.load(buf, {
      password: senha || undefined,
      ignoreEncryption: !senha,
    });

    // Salvar sem senha remove a proteção
    const bytes = await doc.save();

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="sem-senha.pdf"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const userMsg = msg.toLowerCase().includes("encrypt")
      ? "Senha incorreta ou arquivo com proteção avançada."
      : "Erro ao remover senha do PDF.";
    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
