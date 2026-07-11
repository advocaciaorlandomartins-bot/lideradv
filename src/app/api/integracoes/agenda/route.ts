import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getIntegracoesAuth } from "@/lib/integracoes-jwt";

export const dynamic = "force-dynamic";

// GET /api/integracoes/agenda?data=YYYY-MM-DD[&colaborador_id=uuid]
export async function GET(req: NextRequest) {
  const auth = getIntegracoesAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  // Ignora colaborador_id do caller — sempre usa o sub do token
  const colaboradorId = auth.sub;

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { error: "Parâmetro 'data' obrigatório no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Filtra compromissos do colaborador pelo JOIN usuarios → criado_por
  const rows = await sql`
    SELECT
      c.id::text,
      c.titulo,
      c.tipo,
      c.data_inicio::text,
      c.hora_inicio::text,
      c.hora_fim::text,
      c.local_link,
      c.descricao,
      c.cor,
      c.status
    FROM compromissos c
    JOIN usuarios u ON u.login = c.criado_por
    WHERE u.colaborador_id = ${colaboradorId}::uuid
      AND c.data_inicio = ${data}::date
    ORDER BY c.hora_inicio NULLS LAST
  `;

  return NextResponse.json({
    data,
    compromissos: rows.map((r) => ({
      id: String(r.id),
      titulo: String(r.titulo),
      tipo: String(r.tipo),
      data: String(r.data_inicio).slice(0, 10),
      hora_inicio: r.hora_inicio ? String(r.hora_inicio).slice(0, 5) : null,
      hora_fim: r.hora_fim ? String(r.hora_fim).slice(0, 5) : null,
      local_link: r.local_link ? String(r.local_link) : null,
      descricao: r.descricao ? String(r.descricao) : null,
      cor: String(r.cor),
      status: String(r.status),
    })),
  });
}

// POST /api/integracoes/agenda
export async function POST(req: NextRequest) {
  const auth = getIntegracoesAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  let body: {
    titulo?: string;
    tipo?: string;
    data_inicio?: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    local_link?: string | null;
    descricao?: string | null;
    colaborador_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    titulo,
    tipo = "reuniao",
    data_inicio,
    hora_inicio = null,
    hora_fim = null,
    local_link = null,
    descricao = null,
    // colaborador_id ignorado — sempre vincula ao token do caller
  } = body;
  const colaborador_id = auth.sub;

  if (!titulo?.trim()) {
    return NextResponse.json(
      { error: "Campo 'titulo' obrigatório" },
      { status: 400 }
    );
  }
  if (!data_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
    return NextResponse.json(
      { error: "Campo 'data_inicio' obrigatório no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const TIPOS_VALIDOS = [
    "reuniao",
    "videochamada",
    "fechamento",
    "consulta",
    "audiencia",
    "outro",
  ];
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  // Resolve o login do colaborador para usar como criado_por
  const userRows = await sql`
    SELECT login FROM usuarios
    WHERE colaborador_id = ${colaborador_id}::uuid
      AND ativo = true
    LIMIT 1
  `;

  if (userRows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum usuário ativo encontrado para este colaborador" },
      { status: 404 }
    );
  }

  const criadoPor = String(userRows[0].login);

  const rows = await sql`
    INSERT INTO compromissos
      (titulo, tipo, data_inicio, hora_inicio, hora_fim, local_link, descricao, cor, criado_por)
    VALUES (
      ${titulo.trim()},
      ${tipo},
      ${data_inicio}::date,
      ${hora_inicio || null},
      ${hora_fim || null},
      ${local_link || null},
      ${descricao || null},
      '#0ea5e9',
      ${criadoPor}
    )
    RETURNING id::text
  `;

  return NextResponse.json(
    { ok: true, id: String(rows[0].id) },
    { status: 201 }
  );
}
