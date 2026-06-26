import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PrazoItem {
  tipo: "controle" | "tarefa";
  titulo: string;
  cliente: string | null;
  processo: string | null;
  data: string;
  diasRestantes: number;
  prioridade: string | null;
}

function urgencyLabel(dias: number): string {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `${dias} dias`;
}

function buildHtml(items: PrazoItem[], hoje: string): string {
  const vencem1 = items.filter((i) => i.diasRestantes <= 1);
  const vencem3 = items.filter(
    (i) => i.diasRestantes > 1 && i.diasRestantes <= 3
  );
  const vencem7 = items.filter((i) => i.diasRestantes > 3);

  function section(titulo: string, cor: string, grupo: PrazoItem[]): string {
    if (grupo.length === 0) return "";
    return `
      <tr><td style="padding:18px 32px 4px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:${cor};letter-spacing:0.08em;text-transform:uppercase;">${titulo} (${grupo.length})</p>
      </td></tr>
      ${grupo
        .map(
          (item) => `
      <tr><td style="padding:2px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid ${cor};border-radius:8px;margin-bottom:6px;overflow:hidden;">
          <tr>
            <td style="padding:10px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">${item.titulo}</p>
                  ${item.cliente ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b;">Cliente: ${item.cliente}${item.processo ? ` · ${item.processo}` : ""}</p>` : ""}
                  <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${item.tipo === "controle" ? "Prazo / Controle" : "Tarefa"}${item.prioridade && item.prioridade !== "media" ? ` · ${item.prioridade}` : ""}</p>
                </div>
                <div style="white-space:nowrap;">
                  <span style="display:inline-block;background:${cor}15;color:${cor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;">${urgencyLabel(item.diasRestantes)}</span>
                  <p style="margin:3px 0 0;font-size:11px;color:#94a3b8;text-align:right;">${item.data}</p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>`
        )
        .join("")}
    `;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#000D25,#001848,#003080);padding:28px 32px;border-radius:14px 14px 0 0;">
            <p style="margin:0;color:#8FBEFF;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Sistema Jurídico</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">⏰ Prazos e Tarefas — ${hoje}</h1>
            <p style="margin:6px 0 0;color:#8FBEFF;font-size:13px;">${items.length} item${items.length !== 1 ? "s" : ""} vencendo nos próximos 7 dias</p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:0;border:1px solid #e2e8f0;border-top:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${section("🔴 Urgente — vence em até 1 dia", "#dc2626", vencem1)}
              ${section("🟡 Atenção — vence em 2–3 dias", "#d97706", vencem3)}
              ${section("🔵 Próximos — vence em 4–7 dias", "#2563eb", vencem7)}
              <tr><td style="padding:20px 32px;">
                <div style="text-align:center;">
                  <a href="https://lideradv.vercel.app/dashboard/prazos"
                     style="display:inline-block;background:#005DFF;color:#ffffff;padding:13px 28px;border-radius:50px;text-decoration:none;font-weight:700;font-size:14px;">
                    Ver todos os prazos →
                  </a>
                </div>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:14px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">LiderAdv — Sistema Jurídico &nbsp;|&nbsp; Notificação automática diária</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get office email
    const configRows = await sql`SELECT email FROM escritorio_config LIMIT 1`;
    const emailDestino =
      ((configRows[0] as { email?: string } | undefined)?.email ?? "").trim() ||
      null;

    if (!emailDestino) {
      return NextResponse.json({ ok: false, reason: "email não configurado" });
    }

    const hoje = new Date();
    const dataMin = hoje.toISOString().slice(0, 10);
    const dataMax = new Date(hoje.getTime() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    // Controles vencendo nos próximos 7 dias
    const controles = await sql`
      SELECT
        c.descricao,
        c.data_evento,
        c.prazo_interno,
        c.prioridade,
        cl.name AS cliente_nome,
        p.numero AS numero_processo
      FROM controles c
      LEFT JOIN clients cl ON cl.id = c.cliente_id
      LEFT JOIN processos p ON p.id = c.processo_id
      WHERE (c.status IS NULL OR c.status NOT IN ('concluido', 'cancelado'))
        AND (
          (c.data_evento IS NOT NULL AND c.data_evento BETWEEN ${dataMin}::date AND ${dataMax}::date)
          OR
          (c.prazo_interno IS NOT NULL AND c.prazo_interno BETWEEN ${dataMin}::date AND ${dataMax}::date)
        )
      ORDER BY LEAST(
        COALESCE(c.data_evento, '9999-12-31'::date),
        COALESCE(c.prazo_interno, '9999-12-31'::date)
      ) ASC
    `;

    // Tarefas vencendo nos próximos 7 dias (crm_tarefas só tem lead_id)
    const tarefas = await sql`
      SELECT
        t.titulo,
        t.data_vencimento,
        l.nome AS cliente_nome
      FROM crm_tarefas t
      LEFT JOIN crm_leads l ON l.id = t.lead_id
      WHERE t.concluida = false
        AND t.data_vencimento IS NOT NULL
        AND t.data_vencimento BETWEEN ${dataMin}::date AND ${dataMax}::date
      ORDER BY t.data_vencimento ASC
    `;

    const items: PrazoItem[] = [];

    for (const c of controles) {
      const dataBase =
        (c.prazo_interno as string | null) ?? (c.data_evento as string | null);
      if (!dataBase) continue;
      const dataVenc = new Date(dataBase);
      const diff = Math.round((dataVenc.getTime() - hoje.getTime()) / 86400000);
      if (diff < 0) continue;
      items.push({
        tipo: "controle",
        titulo: (c.descricao as string) || "Prazo sem descrição",
        cliente: (c.cliente_nome as string | null) ?? null,
        processo: (c.numero_processo as string | null) ?? null,
        data: dataVenc.toLocaleDateString("pt-BR"),
        diasRestantes: diff,
        prioridade: (c.prioridade as string | null) ?? null,
      });
    }

    for (const t of tarefas) {
      const dataVenc = new Date(t.data_vencimento as string);
      const diff = Math.round((dataVenc.getTime() - hoje.getTime()) / 86400000);
      if (diff < 0) continue;
      items.push({
        tipo: "tarefa",
        titulo: (t.titulo as string) || "Tarefa sem título",
        cliente: (t.cliente_nome as string | null) ?? null,
        processo: null,
        data: dataVenc.toLocaleDateString("pt-BR"),
        diasRestantes: diff,
        prioridade: null,
      });
    }

    items.sort((a, b) => a.diasRestantes - b.diasRestantes);

    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        enviado: false,
        reason: "nenhum prazo",
      });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ ok: false, reason: "RESEND_API_KEY ausente" });
    }

    const resend = new Resend(resendKey);
    const hojeLabel = hoje.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    await resend.emails.send({
      from: "LiderAdv <onboarding@resend.dev>",
      to: emailDestino,
      subject: `[LiderAdv] ⏰ ${items.length} prazo${items.length !== 1 ? "s" : ""} vencendo nos próximos 7 dias`,
      html: buildHtml(items, hojeLabel),
      text: items
        .map(
          (i) =>
            `${urgencyLabel(i.diasRestantes).toUpperCase()} — ${i.titulo} (${i.data})${i.cliente ? ` | ${i.cliente}` : ""}`
        )
        .join("\n"),
    });

    return NextResponse.json({
      ok: true,
      enviado: true,
      para: emailDestino,
      totalItens: items.length,
    });
  } catch (err) {
    console.error("[cron/prazos] erro:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
