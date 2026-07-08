import "server-only";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { prepararAnalise, salvarAnalise } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let processo_id: string;
  try {
    const body = await req.json();
    processo_id = body.processo_id;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!processo_id) {
    return NextResponse.json(
      { error: "processo_id obrigatório" },
      { status: 400 }
    );
  }

  // Preparação síncrona (DB queries + build prompt) — rápido, < 2s
  let prepared;
  try {
    prepared = await prepararAnalise(processo_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
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

        const claudeStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prepared.prompt }],
        });

        let fullText = "";

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            send({ t: event.delta.text });
          }
        }

        // Salva resultado no banco e cria tarefa
        const result = await salvarAnalise(
          processo_id,
          prepared.clientId,
          fullText,
          prepared.modo,
          prepared.completudePct,
          prepared.faltantes,
          prepared.alertas
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
