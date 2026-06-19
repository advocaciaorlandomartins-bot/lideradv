import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const expectedKey = process.env.PREVBOT_API_KEY;
  return !!expectedKey && token === expectedKey;
}

// POST /api/integracoes/prevbot — cria lead no CRM do LiderAdv
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
  const tipo =
    ((body.tipo as string | undefined) ?? "PF") === "PJ" ? "PJ" : "PF";
  const areaInteresse =
    ((body.area_interesse as string | undefined) ?? "").trim() || null;
  const notas = ((body.notas as string | undefined) ?? "").trim() || null;

  try {
    // Evita duplicata: se já existe lead com mesmo telefone e origem prevbot, retorna o existente
    if (telefone) {
      const existing = await sql`
        SELECT id::text FROM crm_leads
        WHERE telefone = ${telefone} AND origem = 'prevbot'
        LIMIT 1
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          {
            success: true,
            lead_id: (existing[0] as { id: string }).id,
            message: "Lead já existe.",
            duplicate: true,
          },
          { status: 200 }
        );
      }
    }

    const rows = await sql`
      INSERT INTO crm_leads
        (nome, email, telefone, tipo, area_interesse, estagio, origem, notas)
      VALUES
        (${nome}, ${email}, ${telefone}, ${tipo}, ${areaInteresse},
         'novo_contato', 'prevbot', ${notas})
      RETURNING id::text
    `;

    const id = (rows[0] as { id: string }).id;

    return NextResponse.json(
      { success: true, lead_id: id, message: "Lead criado com sucesso." },
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
    // Busca em crm_leads por telefone
    const leads = await sql`
      SELECT id::text, nome, email, telefone, estagio
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
