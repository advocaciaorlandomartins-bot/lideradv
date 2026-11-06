import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import {
  criarItemBiblioteca,
  salvarClassificacao,
  marcarErroClassificacao,
  getBibliotecaItemById,
} from "@/lib/biblioteca-juridica-db";
import { classificarDocumentoBiblioteca } from "@/lib/biblioteca-juridica-ia";

export const dynamic = "force-dynamic";
// Generoso de propósito (mesmo motivo de /api/ia/impugnacao-laudo e
// /api/ia/quesitos): claude-sonnet-5 usa thinking automaticamente, e ler +
// classificar um PDF pode passar de 1 minuto. Esse upload é uma ação
// deliberada do usuário esperando o resultado aparecer na tela — não é um
// upload qualquer do sistema (aquele continua sem IA automática, decisão
// de custo do Orlando de 2026-10-12).
export const maxDuration = 180;

const MAX_MB = 25;

async function fetchBlobContent(url: string): Promise<Response | null> {
  if (url.includes(".private.blob.vercel-storage.com")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
  }
  return fetch(url).catch(() => null);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "biblioteca_juridica", "criar")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: {
    nome?: string;
    tipo?: string;
    tamanho?: number;
    url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { nome, tipo, tamanho, url } = body;
  if (!nome || !tipo || !url) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes." },
      { status: 400 }
    );
  }
  if (!url.includes(".blob.vercel-storage.com")) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(tipo)
  ) {
    return NextResponse.json(
      { error: "Tipo de arquivo não suportado." },
      { status: 400 }
    );
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
      { error: "API de IA não configurada." },
      { status: 503 }
    );
  }

  const id = await criarItemBiblioteca({
    nomeOriginal: nome,
    tipo,
    tamanho: tamanho ?? null,
    caminho: new URL(url).pathname.replace(/^\//, ""),
    url,
    enviadoPor: session.id,
  });

  try {
    const fileRes = await fetchBlobContent(url);
    if (!fileRes || !fileRes.ok)
      throw new Error("Não foi possível baixar o arquivo enviado.");
    const arrayBuf = await fileRes.arrayBuffer();
    if (arrayBuf.byteLength > MAX_MB * 1024 * 1024)
      throw new Error(`Arquivo grande demais (limite ${MAX_MB}MB).`);
    const buffer = Buffer.from(arrayBuf);

    const resultado = await classificarDocumentoBiblioteca(buffer, tipo);

    await salvarClassificacao(id, {
      categoria: resultado.categoria,
      nomeSugerido: resultado.nomeSugerido,
      resumo: resultado.resumo,
      area: resultado.area,
      tipoPeticao: resultado.tipoPeticao,
      tribunal: resultado.tribunal,
      identificacao: resultado.identificacao,
      tese: resultado.tese,
      beneficiosAplicaveis: resultado.beneficiosAplicaveis,
      textoExtraido: resultado.textoExtraido,
    });
  } catch (err) {
    console.error("[/api/biblioteca/confirmar] classificação falhou:", err);
    const msg = err instanceof Error ? err.message : "Erro ao classificar.";
    await marcarErroClassificacao(id, msg);
  }

  const item = await getBibliotecaItemById(id);
  return NextResponse.json({ item });
}
