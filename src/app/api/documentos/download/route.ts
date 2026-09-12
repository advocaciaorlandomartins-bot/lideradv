import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { podeAcessarEntidade } from "@/lib/acesso";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  // Verifica que o documento existe e pertence a uma entidade ativa do sistema
  const rows = await sql`
    SELECT d.url, d.nome, d.tipo, d.entity_type, d.entity_id::text
    FROM documentos d
    WHERE d.id = ${id}::uuid
      AND (
        -- documento de processo ativo
        (d.entity_type = 'processo' AND EXISTS (
          SELECT 1 FROM processos p
          WHERE p.id = d.entity_id AND p.deleted_at IS NULL
        ))
        OR
        -- documento de cliente ativo
        (d.entity_type = 'cliente' AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = d.entity_id AND c.deleted_at IS NULL
        ))
        OR
        -- documento de perícia (sem soft-delete nessa tabela)
        (d.entity_type = 'pericia' AND EXISTS (
          SELECT 1 FROM pericias pe
          WHERE pe.id = d.entity_id
        ))
      )
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 }
    );
  }

  const { url, nome, tipo, entity_type, entity_id } = rows[0] as {
    url: string;
    nome: string;
    tipo: string | null;
    entity_type: "processo" | "cliente" | "pericia";
    entity_id: string;
  };

  if (!(await podeAcessarEntidade(session, entity_type, entity_id))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const contentDisposition = (nomeArquivo: string) => {
    const ascii = nomeArquivo.replace(/[^\x20-\x7E]/g, "_");
    return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`;
  };

  try {
    // Blob privado: a URL crua (e o "downloadUrl" que head() devolve — que
    // na prática é só a mesma URL com ?download=1, não uma URL assinada)
    // exige o header Authorization pra ser lida — um redirect manda o
    // navegador pra lá sem esse header, e ele recebe "Forbidden" puro, sem
    // explicação nenhuma. Busca o conteúdo aqui no servidor (com o token) e
    // devolve os bytes direto pro navegador — mesmo padrão já usado em
    // src/app/api/ia/analisar/route.ts pra blob privado.
    if (url.includes(".private.blob.vercel-storage.com")) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const blobRes = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!blobRes.ok || !blobRes.body) {
        console.error(
          `[documentos/download] fetch do blob privado falhou (${blobRes.status}) para ${id}`
        );
        return NextResponse.json(
          {
            error:
              "Não foi possível abrir este arquivo no armazenamento. Ele pode ter sido corrompido ou removido — tente novamente ou contate o suporte.",
          },
          { status: 502 }
        );
      }
      return new NextResponse(blobRes.body, {
        headers: {
          "Content-Type":
            blobRes.headers.get("content-type") ??
            tipo ??
            "application/octet-stream",
          "Content-Disposition": contentDisposition(nome),
        },
      });
    }

    // Blob público — sempre acessível direto, redirect é suficiente.
    return NextResponse.redirect(url);
  } catch (err) {
    console.error(`[documentos/download] falha inesperada para ${id}:`, err);
    return NextResponse.json(
      {
        error:
          "Não foi possível abrir este arquivo no armazenamento. Ele pode ter sido corrompido ou removido — tente novamente ou contate o suporte.",
      },
      { status: 502 }
    );
  }
}
