/**
 * GET /api/cron/alertas-colaborador
 * Avisa por WhatsApp cada colaborador que teve uma tarefa ficando atrasada
 * (prazo = ontem) — pedido do Orlando (2026-10-31): hoje uma tarefa
 * atrasada só aparece passivamente em "Minhas Tarefas", sem avisar
 * ninguém. Roda 1x/dia, só sobre o que ficou atrasado desde ONTEM (não
 * reenvia todo dia a mesma lista de coisa já atrasada há semanas) — evita
 * virar spam diário repetindo o mesmo aviso.
 *
 * Escopo v1: só tarefas_processo (mesma fonte do aviso manual em
 * createTarefaProcessoAction). Controles/CRM que também aparecem em
 * "Carga da equipe" (controladoria-db.ts) ficam de fora por ora — juntar
 * as duas fontes é mais trabalho de categorização e risco de duplicar
 * aviso; ver se vale a pena depois de usar esta versão mais simples.
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const atrasadas = await sql`
    SELECT
      t.responsavel, col.telefone,
      t.titulo, c.name AS cliente_nome, p.numero AS processo_numero
    FROM tarefas_processo t
    JOIN colaboradores col ON col.nome = t.responsavel AND col.status = 'ativo'
    JOIN processos p ON p.id = t.processo_id
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE t.status IN ('Pendente', 'Em andamento')
      AND t.prazo = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 1
      AND col.telefone IS NOT NULL
    ORDER BY t.responsavel
  `;

  const porColaborador = new Map<
    string,
    {
      telefone: string;
      itens: {
        titulo: string;
        cliente: string | null;
        processo: string | null;
      }[];
    }
  >();
  for (const r of atrasadas) {
    const nome = String(r.responsavel);
    if (!porColaborador.has(nome)) {
      porColaborador.set(nome, { telefone: String(r.telefone), itens: [] });
    }
    porColaborador.get(nome)!.itens.push({
      titulo: String(r.titulo),
      cliente: r.cliente_nome ? String(r.cliente_nome) : null,
      processo: r.processo_numero ? String(r.processo_numero) : null,
    });
  }

  let enviados = 0;
  let falhos = 0;
  for (const [nome, { telefone, itens }] of porColaborador) {
    const linhas = itens
      .slice(0, 10)
      .map((i) => {
        const contexto = [i.cliente, i.processo].filter(Boolean).join(" · ");
        return `• ${i.titulo}${contexto ? ` (${contexto})` : ""}`;
      })
      .join("\n");
    const resto = itens.length > 10 ? `\n+${itens.length - 10} mais...` : "";
    const plural = itens.length > 1;
    const mensagem =
      `⏰ *Tarefa${plural ? "s" : ""} atrasada${plural ? "s" : ""}*\n\n` +
      linhas +
      resto +
      `\n\n_Acesse Minhas Tarefas no LiderAdv pra resolver ou ajustar o prazo._`;
    const res = await enviarMensagemDireta({ telefone, mensagem }).catch(
      () => ({ ok: false })
    );
    if (res.ok) enviados++;
    else falhos++;
    void nome; // só usado pra agrupar acima
  }

  return NextResponse.json({
    ok: true,
    colaboradores_notificados: enviados,
    falhas: falhos,
    total_tarefas_atrasadas_ontem: atrasadas.length,
    timestamp: new Date().toISOString(),
  });
}
