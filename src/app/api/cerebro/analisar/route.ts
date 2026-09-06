import "server-only";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { prepararAnalise, salvarAnalise } from "@/lib/cerebroJuridico";
import { iaRateLimitExcedido } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let processo_id: string;
  try {
    const body = await req.json();
    processo_id = body.processo_id;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!processo_id || !UUID_RE.test(processo_id)) {
    return NextResponse.json(
      { error: "processo_id obrigatório e deve ser UUID válido" },
      { status: 400 }
    );
  }

  // Preparação síncrona (DB queries + build prompt) — rápido, < 2s
  let prepared;
  try {
    prepared = await prepararAnalise(processo_id);
  } catch (e) {
    console.error(
      "[cerebro/analisar] prepararAnalise:",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Erro ao preparar análise. Tente novamente." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  // Streaming SSE — o Vercel não aplica timeout enquanto dados chegam
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller já fechado
        }
      };

      try {
        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY!,
        });

        // O prompt pede 12 seções (risco, probabilidade de êxito, tese
        // principal, base legal, próxima ação etc.) — max_tokens já foi
        // subido de 1500 pra 4096 (era o suspeito óbvio), mas análises
        // reais continuaram chegando cortadas bem abaixo desse limite
        // (uma de 04/09/2026 parou em 918 caracteres, no meio de uma
        // frase) — ou seja, o corte não é (só) tamanho de resposta, é o
        // stream da Anthropic terminando cedo por algum motivo que o
        // código nunca registrava. Em vez de confiar cegamente que o
        // loop `for await` terminar = sucesso, agora: (1) confere
        // stop_reason via finalMessage(), (2) confere se a seção "RISCO
        // GERAL" realmente veio (mesmo regex que salvarAnalise usa pra
        // extrair o risco — se não casar, é sinal de corte), (3) tenta
        // de novo uma única vez antes de desistir, (4) registra o
        // diagnóstico em metadata pra dar pra investigar depois sem
        // depender do log da Vercel (que no plano Hobby só guarda 12h).
        const MAX_TENTATIVAS = 2;
        const RISCO_RE = /RISCO GERAL[:\s*]+(\w+)/i;
        let fullText = "";
        let stopReason: string | null = null;
        let tentativa = 0;

        for (tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
          if (tentativa > 1) {
            fullText = "";
            send({ retry: true });
          }

          try {
            const claudeStream = client.messages.stream(
              {
                model: "claude-sonnet-5",
                max_tokens: 4096,
                system: [
                  {
                    type: "text",
                    text: prepared.systemPrompt,
                    cache_control: { type: "ephemeral" },
                  },
                ],
                messages: [{ role: "user", content: prepared.userContent }],
              },
              { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } }
            );

            for await (const event of claudeStream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                fullText += event.delta.text;
                send({ t: event.delta.text });
              }
            }

            const finalMsg = await claudeStream.finalMessage();
            stopReason = finalMsg.stop_reason;
          } catch (streamErr) {
            if (tentativa === MAX_TENTATIVAS) throw streamErr;
            stopReason = null;
            continue;
          }

          const completa = stopReason === "end_turn" && RISCO_RE.test(fullText);
          if (completa || tentativa === MAX_TENTATIVAS) break;
        }

        const truncada = !RISCO_RE.test(fullText);

        // Salva resultado no banco e cria tarefa
        const result = await salvarAnalise(
          processo_id,
          prepared.clientId,
          fullText,
          prepared.modo,
          prepared.completudePct,
          prepared.faltantes,
          prepared.alertas,
          {
            stopReason: stopReason ?? undefined,
            tentativas: tentativa,
            truncada,
          }
        );

        send({ done: true, ...result });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        console.error("[cerebro/analisar]", raw);
        let msg = "Erro ao gerar análise. Tente novamente.";
        if (
          raw.includes("credit balance is too low") ||
          raw.includes("insufficient_quota")
        )
          msg =
            "Créditos da API de IA esgotados. Acesse console.anthropic.com → Billing para recarregar.";
        else if (raw.includes("overloaded") || raw.includes("529"))
          msg =
            "Serviço de IA temporariamente sobrecarregado. Aguarde 1 minuto e tente novamente.";
        else if (raw.includes("rate_limit") || raw.includes("429"))
          msg =
            "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.";
        send({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
