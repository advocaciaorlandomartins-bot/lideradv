import sql from "./db";

const PREVBOT_WEBHOOK_URL =
  process.env.PREVBOT_WEBHOOK_URL ??
  "https://prevbot-production.up.railway.app/webhook/lideradv";

export type PrevBotEvento =
  | "honorario_pago"
  | "processo_deferido"
  | "processo_indeferido"
  | "processo_extinto"
  | "cliente_inativo";

interface ContatoPrevBot {
  leadId: string;
  prevbotLeadId: string | null;
  telefone: string | null;
  tipoAcao: string | null;
  numeroProcesso: string | null;
}

async function buscarContatoPrevBot(opts: {
  processoId?: string | null;
  clientId?: string | null;
}): Promise<ContatoPrevBot | null> {
  let rows: Array<Record<string, unknown>> = [];

  if (opts.processoId) {
    rows = await sql`
      SELECT
        cl.id::text          AS lead_id,
        cl.prevbot_lead_id,
        cl.telefone,
        p.tipo_acao,
        p.numero             AS numero_processo
      FROM processos p
      JOIN crm_leads cl ON cl.id = p.lead_id
      WHERE p.id = ${opts.processoId}::uuid
        AND cl.origem = 'prevbot'
        AND p.deleted_at IS NULL
      LIMIT 1
    `;
  } else if (opts.clientId) {
    rows = await sql`
      SELECT
        cl.id::text          AS lead_id,
        cl.prevbot_lead_id,
        cl.telefone,
        NULL::text           AS tipo_acao,
        NULL::text           AS numero_processo
      FROM crm_leads cl
      WHERE cl.client_id = ${opts.clientId}::uuid
        AND cl.origem = 'prevbot'
      ORDER BY cl.created_at DESC
      LIMIT 1
    `;
  }

  if (!rows.length) return null;
  const r = rows[0];
  return {
    leadId: String(r.lead_id),
    prevbotLeadId: r.prevbot_lead_id ? String(r.prevbot_lead_id) : null,
    telefone: r.telefone ? String(r.telefone) : null,
    tipoAcao: r.tipo_acao ? String(r.tipo_acao) : null,
    numeroProcesso: r.numero_processo ? String(r.numero_processo) : null,
  };
}

export async function _enviarWebhook(
  key: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(PREVBOT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 500) };
  }
}

/**
 * Envia um evento de saída para o PrevBot.
 * - Idempotente: não reenvia o mesmo evento para o mesmo lead.
 * - Registra todas as tentativas em prevbot_webhook_log.
 * - Em caso de falha, o cron /api/cron/prevbot-retries tenta mais 2 vezes.
 */
export async function notificarPrevBot(opts: {
  evento: PrevBotEvento;
  processoId?: string | null;
  clientId?: string | null;
  dados?: Record<string, unknown>;
}): Promise<void> {
  const webhookKey =
    process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
  if (!webhookKey) return;

  try {
    const contato = await buscarContatoPrevBot({
      processoId: opts.processoId,
      clientId: opts.clientId,
    });
    if (!contato) return; // não é um lead do PrevBot

    // Idempotência: ignora se já foi enviado com sucesso
    const jaEnviado = await sql`
      SELECT id FROM prevbot_webhook_log
      WHERE evento     = ${opts.evento}
        AND crm_lead_id = ${contato.leadId}::uuid
        AND status      = 'enviado'
      LIMIT 1
    `;
    if (jaEnviado.length > 0) return;

    const payload = {
      evento: opts.evento,
      prevbot_lead_id: contato.prevbotLeadId ?? undefined,
      telefone: contato.telefone ?? undefined,
      dados: {
        beneficio: contato.tipoAcao ?? undefined,
        processo_numero: contato.numeroProcesso ?? undefined,
        ...opts.dados,
      },
    };

    // Insere registro no log (UNIQUE evento+lead previne entradas duplicadas)
    const logRows = await sql`
      INSERT INTO prevbot_webhook_log
        (evento, crm_lead_id, prevbot_lead_id, telefone, payload, status)
      VALUES
        (${opts.evento}, ${contato.leadId}::uuid,
         ${contato.prevbotLeadId}, ${contato.telefone},
         ${JSON.stringify(payload)}, 'pendente')
      ON CONFLICT (evento, crm_lead_id) DO NOTHING
      RETURNING id::text
    `;

    // Se ON CONFLICT bloqueou (já existe pendente/falhou aguardando retry), sai
    if (!logRows.length) return;
    const logId = (logRows[0] as { id: string }).id;

    const resultado = await _enviarWebhook(webhookKey, payload);

    if (resultado.ok) {
      await sql`
        UPDATE prevbot_webhook_log
        SET status = 'enviado', tentativas = 1, enviado_em = NOW()
        WHERE id = ${logId}::uuid
      `;
    } else {
      await sql`
        UPDATE prevbot_webhook_log
        SET tentativas = 1, ultimo_erro = ${resultado.error ?? null}
        WHERE id = ${logId}::uuid
      `;
      console.warn(
        `[prevbot] Evento '${opts.evento}' falhou (1/3):`,
        resultado.error
      );
    }
  } catch (err) {
    console.error("[prevbot] notificarPrevBot erro:", err);
  }
}
