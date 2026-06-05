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
    if (!senha)
      return NextResponse.json({ error: "Informe a senha." }, { status: 400 });

    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf);

    // pdf-lib suporta criptografia via save() com opções de permissão
    const bytes = await doc.save({
      userPassword: senha,
      ownerPassword: senha + "_owner",
      permissions: {
        printing: "lowResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: true,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });

    return new NextResponse(bytes, {
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
