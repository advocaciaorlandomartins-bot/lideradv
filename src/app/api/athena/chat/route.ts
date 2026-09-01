import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { buildAthenaContextText } from "@/lib/athena-context";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasPermission(session, "controladoria", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (await iaRateLimitExcedido(session.login))
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );

  let messages: Message[];
  try {
    ({ messages } = await req.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!messages?.length) {
    return NextResponse.json(
      { error: "Mensagens inválidas." },
      { status: 400 }
    );
  }

  const contexto = await buildAthenaContextText();

  const systemPrompt = `Você é Athena, a assistente de IA de controladoria do escritório de advocacia LiderAdv. Você tem acesso aos dados reais e atuais da equipe abaixo — use-os para responder com precisão.

REGRAS:
- Responda com base SOMENTE nos dados fornecidos abaixo. Se a pergunta pedir algo que não está nos dados, diga que não tem essa informação disponível agora.
- Seja direta e objetiva — vá direto ao ponto, cite nomes e números concretos dos dados.
- Se perguntarem sobre sobrecarga de equipe, aponte quem tem mais itens vencidos/abertos.
- Se perguntarem sobre desempenho, use o ranking de pontos.
- Nunca invente processos, clientes ou valores que não estão no contexto.
- Não responda perguntas de direito, jurisprudência ou fora do escopo de gestão do escritório — diga que isso não é sua função.
- Respostas curtas: 3-8 linhas, direto ao ponto.

━━━━━━━━━━━━━━━━━━━━━━━━
DADOS ATUAIS DO ESCRITÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━
${contexto}`;

  const recentMessages = messages.slice(-20);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      temperature: 0,
      system: systemPrompt,
      messages: recentMessages,
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[athena/chat] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar resposta. Tente novamente." },
      { status: 500 }
    );
  }
}
