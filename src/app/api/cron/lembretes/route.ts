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
    // Reivindica o lote numa única instrução atômica (CTE + FOR UPDATE SKIP
    // LOCKED + UPDATE já incrementando tentativas) — antes era um SELECT
    // solto seguido de UPDATE só depois de enviar, então duas execuções do
    // cron rodando ao mesmo tempo (ex: um trigger manual em cima do
    // agendado, ou uma reexecução por timeout) liam os MESMOS lembretes
    // pendentes e mandavam a mesma cobrança duas vezes pro cliente.
    const pendentes = await sql`
      WITH claimed AS (
        SELECT l.id
        FROM lembretes_agendados l
        LEFT JOIN clients c ON c.id = l.cliente_id
        WHERE NOT l.enviado
          AND l.enviar_em <= NOW()
          AND l.tentativas < 3
          AND (c.id IS NULL OR c.bloquear_mensagens IS NOT TRUE)
        ORDER BY l.enviar_em ASC
        LIMIT ${BATCH}
        FOR UPDATE OF l SKIP LOCKED
      )
      UPDATE lembretes_agendados l2
      SET tentativas = tentativas + 1
      FROM claimed
      WHERE l2.id = claimed.id
      RETURNING l2.id::text, l2.destinatario_telefone, l2.destinatario_nome, l2.mensagem, l2.tipo
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
          SET enviado = TRUE, enviado_em = NOW()
          WHERE id = ${id}::uuid
        `;
        enviados++;
      } else {
        await sql`
          UPDATE lembretes_agendados
          SET erro = ${resultado.error ?? "erro desconhecido"}
          WHERE id = ${id}::uuid
        `;
        erros++;
        console.warn(
          `[cron/lembretes] Falha ao enviar ${id}:`,
          resultado.error
        );
      }
    }

    await sql`
      INSERT INTO cron_execucoes (rota, processados, enviados, erros)
      VALUES ('/api/cron/lembretes', ${pendentes.length}, ${enviados}, ${erros})
    `.catch(() => null);

    return NextResponse.json({
      ok: true,
      processados: pendentes.length,
      enviados,
      erros,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/lembretes]", msg);
    await sql`
      INSERT INTO cron_execucoes (rota, erros, detalhe)
      VALUES ('/api/cron/lembretes', 1, ${msg.slice(0, 500)})
    `.catch(() => null);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
