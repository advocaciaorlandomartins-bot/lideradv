/**
 * POST /api/ia/analisar
 * Analisa um documento PDF ou imagem com IA.
 * Body: FormData com campos: arquivo (File), clienteId?, processoId?, tipoAnalise?
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumento } from "@/lib/ai-juridico";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MB = 8;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

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

  if (!ALLOWED_TYPES.includes(arquivo.type)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não suportado. Use PDF, JPG ou PNG." },
      { status: 400 }
    );
  }

  if (arquivo.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Limite: ${MAX_MB}MB.` },
      { status: 400 }
    );
  }

  const clienteId = form.get("clienteId") as string | null;
  const processoId = form.get("processoId") as string | null;
  const tipoAnalise = (form.get("tipoAnalise") as string | null) ?? "completa";

  const [escritorio, cliente, processo] = await Promise.all([
    getEscritorioConfig(),
    clienteId ? getClientFull(clienteId).catch(() => null) : null,
    processoId ? getProcessoById(processoId).catch(() => null) : null,
  ]);

  const buffer = await arquivo.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const resultado = await analisarDocumento({
    nomeArquivo: arquivo.name,
    conteudoBase64: base64,
    mimeType: arquivo.type,
    tipoAnalise: tipoAnalise as "completa" | "resumo" | "riscos",
    contexto: {
      escritorio,
      cliente: cliente ?? undefined,
      processo: processo ?? undefined,
    },
  });

  return NextResponse.json({ resultado });
}
