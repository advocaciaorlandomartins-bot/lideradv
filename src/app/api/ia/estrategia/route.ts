/**
 * POST /api/ia/estrategia
 * Diagnóstico estratégico do processo com probabilidade de êxito.
 * Body: { skill, clienteId?, processoId? }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { estrategiaProcessual, SKILLS, type SkillId } from "@/lib/ai-juridico";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { obterContextoCerebro } from "@/lib/cerebroJuridico";

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

  let body: { skill?: string; clienteId?: string; processoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { skill, clienteId, processoId } = body;

  if (!skill) {
    return NextResponse.json(
      { error: "skill é obrigatório." },
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

  const cerebroCtx = processo
    ? await obterContextoCerebro(
        processo.tipo_acao || "",
        processo.area || "Previdenciário"
      ).catch(() => "")
    : "";

  const resultado = await estrategiaProcessual({
    skill: skill as SkillId,
    contexto: {
      escritorio,
      cliente: cliente ?? undefined,
      processo: processo ?? undefined,
      instrucaoExtra: cerebroCtx || undefined,
    },
  });

  return NextResponse.json(resultado);
}
