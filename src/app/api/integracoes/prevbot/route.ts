import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { converterLeadAssinado } from "@/lib/crm-contrato";

export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const expectedKey = process.env.PREVBOT_API_KEY;
  return !!expectedKey && token === expectedKey;
}

// POST /api/integracoes/prevbot — cria lead no CRM (ou atualiza contrato se lead já existe)
export async function POST(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const nome = ((body.nome as string | undefined) ?? "").trim();
  if (!nome) {
    return NextResponse.json(
      { error: "Campo 'nome' é obrigatório." },
      { status: 422 }
    );
  }

  const email = ((body.email as string | undefined) ?? "").trim() || null;
  const telefone = ((body.telefone as string | undefined) ?? "").trim() || null;
  const prevbotLeadId =
    ((body.prevbot_lead_id as string | undefined) ?? "").trim() || null;
  const tipo =
    ((body.tipo as string | undefined) ?? "PF") === "PJ" ? "PJ" : "PF";
  const areaInteresse =
    ((body.area_interesse as string | undefined) ?? "").trim() || null;
  const notas = ((body.notas as string | undefined) ?? "").trim() || null;

  // Campos de contrato (opcionais — enviados pelo PrevBot quando gera contrato)
  const contratoId =
    ((body.contrato_id as string | undefined) ?? "").trim() || null;
  const contratoStatus = (body.contrato_status as string | undefined) ?? null;
  const contratoUrl =
    ((body.contrato_url as string | undefined) ?? "").trim() || null;

  const contratoStatusValido =
    contratoStatus === "aguardando_assinatura" || contratoStatus === "assinado"
      ? contratoStatus
      : null;

  try {
    // Evita duplicata: se já existe lead com mesmo telefone e origem prevbot, atualiza contrato
    if (telefone) {
      const existing = await sql`
        SELECT id::text FROM crm_leads
        WHERE telefone = ${telefone} AND origem = 'prevbot'
        LIMIT 1
      `;
      if (existing.length > 0) {
        const leadId = (existing[0] as { id: string }).id;

        // Atualiza dados de contrato se vieram no payload
        if (
          contratoId ||
          contratoUrl ||
          contratoStatusValido ||
          prevbotLeadId
        ) {
          await sql`
            UPDATE crm_leads SET
              contrato_id          = COALESCE(${contratoId}, contrato_id),
              contrato_status      = COALESCE(${contratoStatusValido}, contrato_status),
              contrato_url         = COALESCE(${contratoUrl}, contrato_url),
              prevbot_lead_id      = COALESCE(${prevbotLeadId}, prevbot_lead_id),
              contrato_assinado_em = CASE
                WHEN ${contratoStatusValido === "assinado"} AND contrato_assinado_em IS NULL THEN now()
                ELSE contrato_assinado_em
              END,
              updated_at = now()
            WHERE id = ${leadId}::uuid
          `;
        }

        // Converte em cliente + processo se contrato assinado
        let clientId: string | null = null;
        let processoId: string | null = null;
        if (contratoStatusValido === "assinado") {
          const result = await converterLeadAssinado(leadId, contratoUrl);
          clientId = result.clientId;
          processoId = result.processoId;
        }

        return NextResponse.json(
          {
            success: true,
            lead_id: leadId,
            client_id: clientId,
            processo_id: processoId,
            message: "Lead já existe.",
            duplicate: true,
            contrato_atualizado: !!(
              contratoId ||
              contratoUrl ||
              contratoStatusValido
            ),
          },
          { status: 200 }
        );
      }
    }

    const rows = await sql`
      INSERT INTO crm_leads
        (nome, email, telefone, tipo, area_interesse, estagio, origem, notas,
         prevbot_lead_id, contrato_id, contrato_status, contrato_url)
      VALUES
        (${nome}, ${email}, ${telefone}, ${tipo}, ${areaInteresse},
         'novo_contato', 'prevbot', ${notas},
         ${prevbotLeadId}, ${contratoId}, ${contratoStatusValido}, ${contratoUrl})
      RETURNING id::text
    `;

    const id = (rows[0] as { id: string }).id;

    // Se chegou já como assinado, converte imediatamente
    let clientId: string | null = null;
    let processoId: string | null = null;
    if (contratoStatusValido === "assinado") {
      const result = await converterLeadAssinado(id, contratoUrl);
      clientId = result.clientId;
      processoId = result.processoId;
    }

    return NextResponse.json(
      {
        success: true,
        lead_id: id,
        client_id: clientId,
        processo_id: processoId,
        message: "Lead criado com sucesso.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("prevbot webhook POST error:", err);
    return NextResponse.json(
      { error: "Erro interno ao criar lead." },
      { status: 500 }
    );
  }
}

// PATCH /api/integracoes/prevbot — atualiza contrato de um lead existente pelo lead_id
export async function PATCH(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const leadId = ((body.lead_id as string | undefined) ?? "").trim();
  if (!leadId) {
    return NextResponse.json(
      { error: "Campo 'lead_id' é obrigatório." },
      { status: 422 }
    );
  }

  const contratoId =
    ((body.contrato_id as string | undefined) ?? "").trim() || null;
  const contratoStatus = (body.contrato_status as string | undefined) ?? null;
  const contratoUrl =
    ((body.contrato_url as string | undefined) ?? "").trim() || null;

  const contratoStatusValido =
    contratoStatus === "aguardando_assinatura" || contratoStatus === "assinado"
      ? contratoStatus
      : null;

  const assinado = contratoStatusValido === "assinado";

  try {
    await sql`
      UPDATE crm_leads SET
        contrato_id          = COALESCE(${contratoId}, contrato_id),
        contrato_status      = COALESCE(${contratoStatusValido}, contrato_status),
        contrato_url         = COALESCE(${contratoUrl}, contrato_url),
        contrato_assinado_em = CASE
          WHEN ${assinado} AND contrato_assinado_em IS NULL THEN now()
          ELSE contrato_assinado_em
        END,
        updated_at = now()
      WHERE id = ${leadId}::uuid
    `;

    // Converte em cliente + processo se contrato assinado
    let clientId: string | null = null;
    let processoId: string | null = null;
    if (assinado) {
      const result = await converterLeadAssinado(leadId, contratoUrl);
      clientId = result.clientId;
      processoId = result.processoId;
    }

    return NextResponse.json({
      success: true,
      client_id: clientId,
      processo_id: processoId,
    });
  } catch (err) {
    console.error("prevbot webhook PATCH error:", err);
    return NextResponse.json(
      { error: "Erro interno ao atualizar lead." },
      { status: 500 }
    );
  }
}

// GET /api/integracoes/prevbot?telefone=11999999999 — busca lead por telefone
export async function GET(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json(
      { status: "ok", authenticated: false },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const telefone = (searchParams.get("telefone") ?? "").trim();

  if (!telefone) {
    return NextResponse.json({
      status: "ok",
      authenticated: true,
      service: "LiderAdv CRM",
      version: "1.0",
    });
  }

  try {
    const leads = await sql`
      SELECT id::text, nome, email, telefone, estagio,
             contrato_id, contrato_status, contrato_url
      FROM crm_leads
      WHERE telefone = ${telefone}
      LIMIT 1
    `;

    if (leads.length > 0) {
      return NextResponse.json({
        found: true,
        lead_id: (leads[0] as { id: string }).id,
        data: leads[0],
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("prevbot webhook GET error:", err);
    return NextResponse.json({ found: false });
  }
}
