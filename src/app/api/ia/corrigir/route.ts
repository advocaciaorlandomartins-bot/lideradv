/**
 * POST /api/ia/corrigir
 * Aplica as correções da revisão ao texto da petição.
 * Body: { textoPeticao, revisao, tipoPeticao, skill, clienteId?, processoId? }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { corrigirPeticao, SKILLS, type SkillId } from "@/lib/ai-juridico";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { gerarContextoPeticao } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
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

  let body: {
    textoPeticao?: string;
    revisao?: string;
    tipoPeticao?: string;
    skill?: string;
    clienteId?: string;
    processoId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { textoPeticao, revisao, tipoPeticao, skill, clienteId, processoId } =
    body;

  if (!textoPeticao || !revisao || !tipoPeticao || !skill) {
    return NextResponse.json(
      { error: "textoPeticao, revisao, tipoPeticao e skill são obrigatórios." },
      { status: 400 }
    );
  }

  if (!SKILLS[skill as SkillId]) {
    return NextResponse.json({ error: "Skill inválida." }, { status: 400 });
  }

  const [escritorio, cliente, processo, cerebroCtx] = await Promise.all([
    getEscritorioConfig(),
    clienteId ? getClientFull(clienteId).catch(() => null) : null,
    processoId ? getProcessoById(processoId).catch(() => null) : null,
    processoId
      ? gerarContextoPeticao(processoId, tipoPeticao).catch(() => "")
      : Promise.resolve(""),
  ]);

  try {
    const resultado = await corrigirPeticao({
      textoPeticao,
      revisao,
      tipoPeticao,
      skill: skill as SkillId,
      contexto: {
        escritorio,
        cliente: cliente ?? undefined,
        processo: processo ?? undefined,
        instrucaoExtra: cerebroCtx || undefined,
      },
    });
    return NextResponse.json({ resultado });
  } catch (err) {
    console.error(
      "[/api/ia/corrigir]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro ao aplicar correções." },
      { status: 500 }
    );
  }
}
