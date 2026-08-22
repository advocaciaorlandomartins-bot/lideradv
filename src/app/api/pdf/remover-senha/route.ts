import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, EncryptedPDFError } from "pdf-lib";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json(
        { error: "Arquivo muito grande. Limite: 50 MB." },
        { status: 413 }
      );

    const buf = await file.arrayBuffer();

    // Sem ignoreEncryption: quando o PDF está realmente protegido por senha,
    // isso precisa lançar EncryptedPDFError para cair no branch abaixo. A
    // versão anterior usava ignoreEncryption: true, que suprime esse erro e
    // deixa o load "funcionar" sobre a estrutura ainda criptografada — o
    // resultado salvo continuava corrompido/protegido, mas a rota respondia
    // 200 como se tivesse removido a senha com sucesso (pdf-lib não
    // implementa nenhum algoritmo de decriptação, só a opção de ignorar o
    // erro e tentar ler mesmo assim).
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
            error:
              "Este PDF está protegido por senha e não pode ser processado: nossa ferramenta não suporta remoção de senha de PDFs criptografados no momento.",
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
