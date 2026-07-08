/**
 * POST /api/ia/analisar
 * Analisa um documento PDF ou imagem com IA.
 *
 * Aceita dois formatos:
 *   1. FormData: campo "arquivo" (File), + clienteId?, processoId?, tipoAnalise?
 *   2. JSON: { documentoUrl, nomeArquivo, mimeType, clienteId?, processoId?, tipoAnalise? }
 *      (para documentos já salvos no Supabase Storage)
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumentoExtendido } from "@/lib/ai-juridico";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function isUrlPermitida(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    const allowed = ["blob.vercel-storage.com", "supabase.co", "supabase.in"];
    return allowed.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

async function fetchBlobContent(url: string): Promise<Response | null> {
  if (url.includes(".private.blob.vercel-storage.com")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
  }
  return fetch(url).catch(() => null);
}

const MAX_MB = 20;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chave de IA não configurada." },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  let nomeArquivo: string;
  let mimeType: string;
  let base64: string;
  let clienteId: string | null = null;
  let processoId: string | null = null;
  let tipoAnalise = "completa";

  if (contentType.includes("application/json")) {
    // Modo URL: busca o arquivo do Supabase Storage
    const body = await req.json().catch(() => null);
    if (!body?.documentoUrl || !body?.nomeArquivo || !body?.mimeType) {
      return NextResponse.json(
        { error: "documentoUrl, nomeArquivo e mimeType são obrigatórios." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(body.mimeType)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado." },
        { status: 400 }
      );
    }

    if (!isUrlPermitida(body.documentoUrl)) {
      return NextResponse.json(
        { error: "URL de documento não permitida." },
        { status: 400 }
      );
    }

    const fileRes = await fetchBlobContent(body.documentoUrl);
    if (!fileRes || !fileRes.ok) {
      return NextResponse.json(
        {
          error:
            "Não foi possível acessar o documento. Verifique as permissões.",
        },
        { status: 400 }
      );
    }

    const arrayBuf = await fileRes.arrayBuffer();
    if (arrayBuf.byteLength > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Limite: ${MAX_MB}MB.` },
        { status: 400 }
      );
    }

    nomeArquivo = body.nomeArquivo;
    mimeType = body.mimeType;
    base64 = Buffer.from(arrayBuf).toString("base64");
    clienteId = body.clienteId ?? null;
    processoId = body.processoId ?? null;
    tipoAnalise = body.tipoAnalise ?? "completa";
  } else {
    // Modo FormData: arquivo enviado diretamente
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Erro ao processar o formulário." },
        { status: 400 }
      );
    }

    const arquivo = form.get("arquivo") as File | null;
    if (!arquivo) {
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(arquivo.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use PDF, JPG, PNG ou WebP." },
        { status: 400 }
      );
    }

    if (arquivo.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Limite: ${MAX_MB}MB.` },
        { status: 400 }
      );
    }

    const buffer = await arquivo.arrayBuffer();
    nomeArquivo = arquivo.name;
    mimeType = arquivo.type;
    base64 = Buffer.from(buffer).toString("base64");
    clienteId = form.get("clienteId") as string | null;
    processoId = form.get("processoId") as string | null;
    tipoAnalise = (form.get("tipoAnalise") as string | null) ?? "completa";
  }

  const [escritorio, cliente, processo] = await Promise.all([
    getEscritorioConfig(),
    clienteId ? getClientFull(clienteId).catch(() => null) : null,
    processoId ? getProcessoById(processoId).catch(() => null) : null,
  ]);

  try {
    const { resultado, dadosExtraidos } = await analisarDocumentoExtendido({
      nomeArquivo,
      conteudoBase64: base64,
      mimeType,
      tipoAnalise: tipoAnalise as "completa" | "resumo" | "riscos",
      contexto: {
        escritorio,
        cliente: cliente ?? undefined,
        processo: processo ?? undefined,
      },
      extrairDados: !!clienteId,
    });

    // Salva no banco para o Cérebro poder ler depois
    if (processoId) {
      try {
        await sql`
          INSERT INTO cerebro_analises (processo_id, tipo, titulo, analise, metadata)
          VALUES (
            ${processoId}::uuid,
            'documento',
            ${"Análise: " + nomeArquivo},
            ${resultado},
            ${JSON.stringify({ nome: nomeArquivo, tipo_analise: tipoAnalise })}
          )
        `;
      } catch {
        // não bloqueia a resposta se falhar
      }
    }

    return NextResponse.json({
      resultado,
      dadosExtraidos: dadosExtraidos ?? null,
    });
  } catch (err) {
    console.error("[/api/ia/analisar]", err);
    const raw = err instanceof Error ? err.message : String(err);
    let msg = "Erro ao analisar o documento.";
    if (
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
