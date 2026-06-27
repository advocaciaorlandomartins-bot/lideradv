/**
 * POST /api/ia/peticao
 * Gera petição jurídica com streaming usando skill especializada.
 * Body: { skill, tipoPeticao, clienteId?, processoId?, instrucaoExtra? }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { gerarPeticaoStream, SKILLS, type SkillId } from "@/lib/ai-juridico";
import { buildContextoTexto } from "@/lib/ai-juridico";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chave de IA não configurada." },
      { status: 503 }
    );
  }

  let body: {
    skill?: string;
    tipoPeticao?: string;
    clienteId?: string;
    processoId?: string;
    instrucaoExtra?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { skill, tipoPeticao, clienteId, processoId, instrucaoExtra } = body;

  if (!skill || !tipoPeticao) {
    return NextResponse.json(
      { error: "skill e tipoPeticao são obrigatórios." },
      { status: 400 }
    );
  }

  if (!SKILLS[skill as SkillId]) {
    return NextResponse.json({ error: "Skill inválida." }, { status: 400 });
  }

  const [escritorio, cliente, processo] = await Promise.all([
    getEscritorioConfig(),
    clienteId ? getClientFull(clienteId).catch(() => null) : null,
    processoId ? getProcessoById(processoId).catch(() => null) : null,
  ]);

  const stream = await gerarPeticaoStream({
    skill: skill as SkillId,
    tipoPeticao,
    contexto: {
      escritorio,
      cliente: cliente ?? undefined,
      processo: processo ?? undefined,
      instrucaoExtra,
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
