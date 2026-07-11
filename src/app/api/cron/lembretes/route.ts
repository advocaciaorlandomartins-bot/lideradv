import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 30; // máximo por execução

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const pendentes = await sql`
      SELECT l.id::text, l.destinatario_telefone, l.destinatario_nome, l.mensagem, l.tipo
      FROM lembretes_agendados l
      LEFT JOIN clients c ON c.id = l.cliente_id
      WHERE NOT l.enviado
        AND l.enviar_em <= NOW()
        AND l.tentativas < 3
        AND (c.id IS NULL OR c.bloquear_mensagens IS NOT TRUE)
      ORDER BY l.enviar_em ASC
      LIMIT ${BATCH}
    `;

    let enviados = 0;
    let erros = 0;

    for (const lembrete of pendentes) {
      const id = String(lembrete.id);
      const telefone = String(lembrete.destinatario_telefone ?? "");
      const mensagem = String(lembrete.mensagem ?? "");

      if (!telefone || !mensagem) {
        await sql`
          UPDATE lembretes_agendados
          SET enviado = TRUE, enviado_em = NOW(), erro = 'telefone ou mensagem vazio'
          WHERE id = ${id}::uuid
        `;
        continue;
      }

      const resultado = await enviarMensagemDireta({ telefone, mensagem });

      if (resultado.ok) {
        await sql`
          UPDATE lembretes_agendados
          SET enviado = TRUE, enviado_em = NOW(), tentativas = tentativas + 1
          WHERE id = ${id}::uuid
        `;
        enviados++;
      } else {
        await sql`
          UPDATE lembretes_agendados
          SET tentativas = tentativas + 1, erro = ${resultado.error ?? "erro desconhecido"}
          WHERE id = ${id}::uuid
        `;
        erros++;
        console.warn(
          `[cron/lembretes] Falha ao enviar ${id}:`,
          resultado.error
        );
      }
    }

    return NextResponse.json({
      ok: true,
      processados: pendentes.length,
      enviados,
      erros,
    });
  } catch (err) {
    console.error("[cron/lembretes]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
