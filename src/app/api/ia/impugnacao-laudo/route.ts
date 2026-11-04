import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeEditarProcesso } from "@/lib/processo-ownership";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { getProcessoById } from "@/lib/processos-db";
import { gerarImpugnacaoLaudo } from "@/lib/impugnacao-laudo";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_MB = 20;
const MAX_DOCS = 4;

async function fetchBlobContent(url: string): Promise<Response | null> {
  if (url.includes(".private.blob.vercel-storage.com")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
  }
  return fetch(url).catch(() => null);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const processoId = body?.processoId;
  const documentoIds = body?.documentoIds;
  if (!processoId || !UUID_RE.test(processoId)) {
    return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
  }
  if (
    !Array.isArray(documentoIds) ||
    documentoIds.length === 0 ||
    documentoIds.length > MAX_DOCS ||
    !documentoIds.every((id) => typeof id === "string" && UUID_RE.test(id))
  ) {
    return NextResponse.json(
      { error: `Selecione de 1 a ${MAX_DOCS} documentos.` },
      { status: 400 }
    );
  }

  if (!(await podeEditarProcesso(session, processoId))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chave de IA não configurada." },
      { status: 503 }
    );
  }

  const processo = await getProcessoById(processoId);
  if (!processo) {
    return NextResponse.json(
      { error: "Processo não encontrado." },
      { status: 404 }
    );
  }

  // Só documentos que realmente pertencem a este processo ou ao cliente dele
  // (mesmo escopo mostrado na aba Documentos do processo) — mesma regra do
  // endpoint irmão /api/ia/quesitos.
  const rows = await sql`
    SELECT id::text, nome, tipo, url
    FROM documentos
    WHERE id = ANY(${documentoIds}::uuid[])
      AND (
        (entity_type = 'processo' AND entity_id = ${processoId}::uuid)
        OR (entity_type = 'cliente' AND entity_id = ${processo.client_id}::uuid)
      )
  `;
  if (rows.length !== documentoIds.length) {
    return NextResponse.json(
      { error: "Um ou mais documentos não pertencem a este processo." },
      { status: 400 }
    );
  }
  for (const r of rows) {
    if (!ALLOWED_TYPES.has(String(r.tipo))) {
      return NextResponse.json(
        {
          error: `"${r.nome}" não é PDF/imagem suportada — remova esse documento da seleção.`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const documentos = await Promise.all(
      rows.map(async (r) => {
        const fileRes = await fetchBlobContent(String(r.url));
        if (!fileRes || !fileRes.ok) {
          throw new Error(`Não foi possível baixar "${r.nome}".`);
        }
        const arrayBuf = await fileRes.arrayBuffer();
        if (arrayBuf.byteLength > MAX_MB * 1024 * 1024) {
          throw new Error(`"${r.nome}" é grande demais (limite ${MAX_MB}MB).`);
        }
        return {
          nome: String(r.nome),
          mimeType: String(r.tipo),
          base64: Buffer.from(arrayBuf).toString("base64"),
        };
      })
    );

    const resultado = await gerarImpugnacaoLaudo(documentos, {
      processoNumero: processo.numero,
      clienteNome: processo.client_name,
      tipoAcao: processo.tipo_acao,
    });

    await sql`
      INSERT INTO cerebro_analises (processo_id, tipo, titulo, analise, metadata)
      VALUES (
        ${processoId}::uuid,
        'impugnacao_laudo',
        'Impugnação ao laudo pericial',
        ${resultado.minutaImpugnacao},
        ${JSON.stringify({
          vicios: resultado.vicios,
          quesitos_complementares: resultado.quesitosComplementares,
          teses_juridicas: resultado.tesesJuridicas,
          documentos: rows.map((r) => r.nome),
        })}
      )
    `.catch(() => null);

    return NextResponse.json({
      vicios: resultado.vicios,
      quesitosComplementares: resultado.quesitosComplementares,
      tesesJuridicas: resultado.tesesJuridicas,
      minutaImpugnacao: resultado.minutaImpugnacao,
    });
  } catch (err) {
    console.error(
      "[/api/ia/impugnacao-laudo]",
      err instanceof Error ? err.message : String(err)
    );
    const raw = err instanceof Error ? err.message : String(err);
    let msg = "Erro ao gerar a impugnação do laudo.";
    if (
      raw.includes("Não foi possível baixar") ||
      raw.includes("é grande demais")
    )
      msg = raw;
    else if (
      raw.includes("credit balance is too low") ||
      raw.includes("insufficient_quota")
    )
      msg =
        "Créditos da API de IA esgotados. Acesse console.anthropic.com → Billing para recarregar.";
    else if (raw.includes("overloaded") || raw.includes("529"))
      msg = "Serviço de IA sobrecarregado. Aguarde 1 minuto e tente novamente.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
