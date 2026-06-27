/**
 * GET /api/cron/limpeza
 * Política de retenção automática — art. 16 LGPD.
 * Executado diariamente às 02h via Vercel Cron.
 *
 * Regras:
 *  1. Tokens de redefinição de senha: purge após 7 dias (já expiram em 1h)
 *  2. Leads CRM não convertidos: anonimizar após 180 dias sem atividade
 *  3. Clientes em soft-delete: anonimizar PII após 90 dias
 *  4. Audit logs: purge registros com mais de 2 anos
 *  5. Prevbot webhook log com status 'falhou': purge após 30 dias
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resultados: Record<string, number | string> = {};

  // 1. Tokens de senha expirados há mais de 7 dias
  try {
    const r = await sql`
      DELETE FROM password_reset_tokens
      WHERE expires_at < NOW() - INTERVAL '7 days'
    `;
    resultados.tokens_senha_removidos = r.length ?? 0;
  } catch (e) {
    resultados.tokens_senha_erro = String(e);
  }

  // 2. Leads não convertidos sem atividade há 180 dias — anonimizar
  try {
    const r = await sql`
      UPDATE crm_leads SET
        nome        = '[ANONIMIZADO]',
        email       = NULL,
        telefone    = NULL,
        notas       = NULL,
        updated_at  = NOW()
      WHERE client_id IS NULL
        AND updated_at < NOW() - INTERVAL '180 days'
        AND nome != '[ANONIMIZADO]'
    `;
    resultados.leads_antigos_anonimizados = r.length ?? 0;
  } catch (e) {
    resultados.leads_antigos_erro = String(e);
  }

  // 3. Clientes em soft-delete há mais de 90 dias — anonimizar PII
  try {
    const r = await sql`
      UPDATE clients SET
        name                  = '[ANONIMIZADO]',
        doc                   = '',
        email                 = '',
        phone                 = '',
        rg                    = NULL,
        rg_orgao              = NULL,
        cep                   = '',
        street                = '',
        addr_number           = '',
        complement            = NULL,
        neighborhood          = '',
        city                  = '',
        state                 = '',
        birth_date            = NULL,
        estado_civil          = NULL,
        genero                = NULL,
        profissao             = NULL,
        nacionalidade         = NULL,
        naturalidade_cidade   = NULL,
        naturalidade_estado   = NULL,
        filiacao_mae          = NULL,
        filiacao_pai          = NULL,
        nis                   = NULL,
        num_beneficio         = NULL,
        cid_principal         = NULL,
        tipo_incapacidade     = NULL,
        data_diagnostico      = NULL,
        data_afastamento      = NULL,
        notes                 = NULL,
        updated_at            = NOW()
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '90 days'
        AND name != '[ANONIMIZADO]'
    `;
    resultados.clientes_deletados_anonimizados = r.length ?? 0;
  } catch (e) {
    resultados.clientes_deletados_erro = String(e);
  }

  // 4. Audit logs com mais de 2 anos
  try {
    const r = await sql`
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '2 years'
    `;
    resultados.audit_logs_removidos = r.length ?? 0;
  } catch (e) {
    resultados.audit_logs_erro = String(e);
  }

  // 5. Prevbot webhook log com status 'falhou' há mais de 30 dias
  try {
    const r = await sql`
      DELETE FROM prevbot_webhook_log
      WHERE status = 'falhou'
        AND created_at < NOW() - INTERVAL '30 days'
    `;
    resultados.prevbot_log_removidos = r.length ?? 0;
  } catch (e) {
    resultados.prevbot_log_erro = String(e);
  }

  console.info("[cron/limpeza] Concluído:", resultados);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    resultados,
  });
}
