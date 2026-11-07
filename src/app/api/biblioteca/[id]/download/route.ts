import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getBibliotecaItemById } from "@/lib/biblioteca-juridica-db";
import { isUrlPermitida, isBlobPrivado } from "@/lib/blob-url";

export const dynamic = "force-dynamic";

// Mesmo padrão de /api/documentos/download — blob privado exige o token no
// header pra ser lido, então busca os bytes aqui no servidor em vez de só
// redirecionar o navegador pra URL crua.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "biblioteca_juridica", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const item = await getBibliotecaItemById(id);
  if (!item)
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 }
    );

  const forcarDownload =
    new URL(request.url).searchParams.get("download") === "1";
  const contentDisposition = (nomeArquivo: string) => {
    const ascii = nomeArquivo.replace(/[^\x20-\x7E]/g, "_");
    const tipo = forcarDownload ? "attachment" : "inline";
    return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`;
  };

  if (!isUrlPermitida(item.url)) {
    return NextResponse.json(
      { error: "Não foi possível abrir este arquivo." },
      { status: 502 }
    );
  }

  try {
    if (isBlobPrivado(item.url)) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const blobRes = await fetch(item.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!blobRes.ok || !blobRes.body) {
        return NextResponse.json(
          { error: "Não foi possível abrir este arquivo." },
          { status: 502 }
        );
      }
      return new NextResponse(blobRes.body, {
        headers: {
          "Content-Type":
            blobRes.headers.get("content-type") ??
            item.tipo ??
            "application/octet-stream",
          "Content-Disposition": contentDisposition(item.nome),
        },
      });
    }
    return NextResponse.redirect(item.url);
  } catch (err) {
    console.error(`[biblioteca/download] falha inesperada para ${id}:`, err);
    return NextResponse.json(
      { error: "Não foi possível abrir este arquivo." },
      { status: 502 }
    );
  }
}
