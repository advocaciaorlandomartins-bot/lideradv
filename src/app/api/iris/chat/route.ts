import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { buildIrisContextText } from "@/lib/iris-context";
import { IRIS_TOOLS, executarFerramentaIris } from "@/lib/iris-tools";
import { LIDERADV_DOCS } from "@/lib/lideradv-docs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_MENSAGENS = 30;
const MAX_CHARS_TEXTO = 8000;
const MAX_LOOP = 6;

/**
 * O cliente envia o histórico inteiro. Aceitamos apenas texto simples em
 * turnos user/assistant: blocos tool_use/tool_result forjados deixariam o
 * chamador inventar resultados de ferramentas (ex: fingir que uma checagem
 * passou) e conduzir a Íris a executar ações reais com premissas falsas.
 */
function sanitizarHistorico(raw: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Anthropic.MessageParam[] = [];
  for (const m of raw.slice(-MAX_MENSAGENS)) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;

    let texto = "";
    if (typeof content === "string") texto = content;
    else if (Array.isArray(content))
      texto = content
        .filter(
          (b): b is { type: "text"; text: string } =>
            !!b &&
            typeof b === "object" &&
            (b as { type?: unknown }).type === "text" &&
            typeof (b as { text?: unknown }).text === "string"
        )
        .map((b) => b.text)
        .join("\n");

    texto = texto.trim().slice(0, MAX_CHARS_TEXTO);
    if (!texto) continue;
    out.push({ role, content: texto });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length ? out : null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (await iaRateLimitExcedido(session.login))
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );

  const body = (await req.json().catch(() => null)) as {
    messages?: unknown;
  } | null;

  const currentMessages = sanitizarHistorico(body?.messages);
  if (!currentMessages)
    return NextResponse.json(
      { error: "Mensagens inválidas." },
      { status: 400 }
    );

  const ehAdmin = hasPermission(session, "configuracoes", "editar");
  const contexto = await buildIrisContextText(session);

  const systemPrompt = `Você é Íris, a única assistente de IA do sistema LiderAdv (plataforma de gestão para escritórios de advocacia previdenciária). Você é responsável por TUDO relacionado a IA no sistema: tirar dúvidas de uso, mostrar dados reais e atuais do escritório (agenda, equipe, financeiro, produtividade) e executar ações reais quando autorizada.

REGRAS GERAIS:
- Sobre COMO USAR O SISTEMA (telas, botões, campos, fluxos): responda SOMENTE com base na documentação abaixo. Nunca invente funcionalidade que não está documentada. Se não souber, diga que não tem essa informação.
- Sobre DADOS REAIS (agenda, equipe, ranking, financeiro): responda SOMENTE com base no que está no contexto de dados abaixo ou no que as ferramentas retornarem. Nunca invente compromisso, cliente, processo ou valor. Se uma seção do contexto disser que não há acesso, informe isso em vez de inventar.
- Sobre AÇÕES REAIS (sincronizar, reenviar mensagem, mexer em OAB, mudar dados do escritório): use as ferramentas disponíveis. ${ehAdmin ? "Este usuário TEM permissão de administrador — pode executar." : "Este usuário NÃO tem permissão de administrador — se a ferramenta retornar erro de permissão, explique isso educadamente e não insista."}
- Sobre RISCO/PROBABILIDADE DE ÊXITO de processos: use as ferramentas listar_processos_risco e consultar_analise_cerebro — elas trazem o que o Cérebro Jurídico já analisou de cada caso (risco, % de êxito, próxima ação, base legal). Nunca estime risco de cabeça; sempre consulte essas ferramentas.
- Perguntas de direito, jurisprudência ou fora do sistema: diga que isso não é sua função.
- Seja direta e organizada — liste itens por data quando fizer sentido, cite nomes e números concretos, sem enrolação.

━━━━━━━━━━━━━━━━━━━━━━━━
DADOS ATUAIS DO ESCRITÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━
${contexto}

━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTAÇÃO DO SISTEMA (como usar cada tela)
━━━━━━━━━━━━━━━━━━━━━━━━
${LIDERADV_DOCS}`;

  try {
    for (let i = 0; i < MAX_LOOP; i++) {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        temperature: 0,
        system: systemPrompt,
        tools: IRIS_TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === "tool_use") {
        currentMessages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executarFerramentaIris(
              session,
              block.name,
              block.input as Record<string, string>
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }
        currentMessages.push({ role: "user", content: toolResults });
        continue;
      }

      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");
      return NextResponse.json({ reply });
    }
  } catch (err) {
    console.error("[iris/chat] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar resposta. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    reply: "Não consegui completar a operação. Tente novamente.",
  });
}
