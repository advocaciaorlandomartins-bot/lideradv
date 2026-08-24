import "server-only";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { aprenderComResultado } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // 'Concluída' nunca é um valor de processos.status (esse fluxo usa
  // 'ativo'/'arquivado'/'encerrado' — 'Concluída' só existe em
  // tarefas_processo.status, uma tabela diferente). Esse scheduler
  // processava zero processos todo dia, silenciosamente, desde que foi
  // criado — confirmado contra produção (0 processos com status
  // 'Concluída', mas 3 arquivados com resultado preenchido que deveriam
  // ter virado aprendizado). Também faltava resultado_administrativo na
  // checagem — é o campo que o fluxo atual de Produção realmente grava
  // (registrarResultadoAdminAction), os outros três são de um fluxo mais
  // antigo/paralelo de edição manual do processo.
  const pendentes = await sql`
    SELECT p.id FROM processos p
    LEFT JOIN cerebro_juridico cj ON cj.processo_id = p.id
    WHERE p.status IN ('arquivado', 'encerrado')
      AND p.deleted_at IS NULL
      AND cj.id IS NULL
      AND (
        p.resultado_administrativo IS NOT NULL
        OR p.resultado_admin IS NOT NULL
        OR p.resultado_judicial IS NOT NULL
        OR p.resultado IS NOT NULL
      )
    LIMIT 20
  `;

  const resultados = await Promise.allSettled(
    pendentes.map((p) => aprenderComResultado(String(p.id)))
  );

  const aprendidos = resultados.filter(
    (r) => r.status === "fulfilled" && r.value
  ).length;

  console.log(
    `[CerebroScheduler] ${aprendidos}/${pendentes.length} processos aprendidos`
  );

  return NextResponse.json({
    ok: true,
    aprendidos,
    total: pendentes.length,
  });
}
