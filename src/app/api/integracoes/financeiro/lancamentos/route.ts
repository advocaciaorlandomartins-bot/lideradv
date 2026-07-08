import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getIntegracoesAuth } from "@/lib/integracoes-jwt";

export const dynamic = "force-dynamic";

const TIPOS_VALIDOS = ["receita", "despesa"] as const;
const STATUS_VALIDOS = ["recebido", "a_receber", "pago", "pendente"] as const;

// POST /api/integracoes/financeiro/lancamentos
export async function POST(req: NextRequest) {
  const auth = getIntegracoesAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  let body: {
    tipo?: string;
    categoria?: string;
    descricao?: string;
    valor?: number;
    data?: string;
    status?: string;
    recorrente?: boolean;
    periodicidade?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    tipo,
    categoria,
    descricao,
    valor,
    data,
    status = "pago",
    recorrente = false,
    periodicidade = null,
  } = body;

  // Validações
  if (
    !tipo ||
    !TIPOS_VALIDOS.includes(tipo as (typeof TIPOS_VALIDOS)[number])
  ) {
    return NextResponse.json(
      { error: `Campo 'tipo' obrigatório. Use: ${TIPOS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!categoria?.trim()) {
    return NextResponse.json(
      { error: "Campo 'categoria' obrigatório" },
      { status: 400 }
    );
  }
  if (!descricao?.trim()) {
    return NextResponse.json(
      { error: "Campo 'descricao' obrigatório" },
      { status: 400 }
    );
  }
  if (typeof valor !== "number" || valor <= 0) {
    return NextResponse.json(
      { error: "Campo 'valor' obrigatório e deve ser positivo" },
      { status: 400 }
    );
  }
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { error: "Campo 'data' obrigatório no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (!STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
    return NextResponse.json(
      { error: `Status inválido. Use: ${STATUS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  // Resolve colaborador → usuário
  const userRows = await sql`
    SELECT id::text FROM usuarios
    WHERE colaborador_id = ${auth.sub}::uuid
      AND ativo = true
    LIMIT 1
  `;

  if (userRows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum usuário ativo encontrado para este colaborador" },
      { status: 404 }
    );
  }

  const usuarioId = String(userRows[0].id);

  const rows = await sql`
    INSERT INTO meu_financeiro_lancamentos
      (usuario_id, tipo, categoria, descricao, valor, data, status, recorrente, periodicidade)
    VALUES (
      ${usuarioId}::uuid,
      ${tipo},
      ${categoria.trim()},
      ${descricao.trim()},
      ${valor},
      ${data}::date,
      ${status},
      ${recorrente},
      ${periodicidade ?? null}
    )
    RETURNING id::text, tipo, categoria, descricao, valor,
              data::text, status, recorrente, periodicidade, created_at::text
  `;

  const r = rows[0];
  return NextResponse.json(
    {
      ok: true,
      lancamento: {
        id: String(r.id),
        tipo: r.tipo,
        categoria: r.categoria,
        descricao: r.descricao,
        valor: Number(r.valor),
        data: String(r.data).slice(0, 10),
        status: r.status,
        recorrente: Boolean(r.recorrente),
        periodicidade: r.periodicidade ?? null,
        created_at: String(r.created_at),
      },
    },
    { status: 201 }
  );
}
