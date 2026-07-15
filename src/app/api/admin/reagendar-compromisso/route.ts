import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import { agendarNotificacoesCompromisso } from "@/lib/lembretes";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reagendar-compromisso
 * Re-cria os lembretes futuros para um compromisso existente.
 * Útil quando o evento foi criado sem telefone do cliente / sem o fix.
 * Body: { compromissoId: string }
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const { compromissoId } = (await req.json()) as { compromissoId?: string };
  if (!compromissoId || !UUID_RE.test(compromissoId))
    return NextResponse.json(
      { error: "compromissoId inválido." },
      { status: 400 }
    );

  // Busca o compromisso com cliente e responsável
  const rows = await sql`
    SELECT
      c.id::text,
      c.titulo,
      c.tipo,
      c.data_inicio,
      c.hora_inicio,
      c.local_link,
      c.descricao,
      c.cliente_id::text,
      cl.name           AS cliente_nome,
      cl.phone          AS cliente_telefone,
      col.nome          AS responsavel_nome,
      col.telefone      AS responsavel_telefone
    FROM compromissos c
    LEFT JOIN clients cl ON cl.id = c.cliente_id
    LEFT JOIN LATERAL (
      SELECT p.responsavel_id
      FROM processos p
      WHERE p.client_id = c.cliente_id
        AND p.deleted_at IS NULL
        AND p.responsavel_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    ) lp ON true
    LEFT JOIN colaboradores col ON col.id = lp.responsavel_id AND col.status = 'ativo'
    WHERE c.id = ${compromissoId}::uuid
    LIMIT 1
  `;

  if (!rows.length)
    return NextResponse.json(
      { error: "Compromisso não encontrado." },
      { status: 404 }
    );

  const r = rows[0];
  const dataEvento = new Date(String(r.data_inicio) + "T12:00:00");

  if (dataEvento <= new Date())
    return NextResponse.json(
      { error: "Compromisso já passou — não há lembretes futuros a agendar." },
      { status: 400 }
    );

  const localLink = r.local_link ? String(r.local_link) : null;
  const link = localLink?.startsWith("http") ? localLink : null;
  const local = !link ? localLink : null;

  await agendarNotificacoesCompromisso({
    compromissoId,
    titulo: String(r.titulo),
    tipo: String(r.tipo),
    dataEvento,
    hora: r.hora_inicio ? String(r.hora_inicio) : null,
    local,
    link,
    colaborador: r.responsavel_telefone
      ? {
          nome: String(r.responsavel_nome),
          telefone: String(r.responsavel_telefone),
        }
      : null,
    cliente:
      r.cliente_id && r.cliente_telefone
        ? {
            id: String(r.cliente_id),
            nome: String(r.cliente_nome),
            telefone: String(r.cliente_telefone),
          }
        : null,
  });

  return NextResponse.json({
    ok: true,
    compromisso: {
      id: r.id,
      titulo: r.titulo,
      tipo: r.tipo,
      data: r.data_inicio,
    },
    cliente: r.cliente_nome
      ? { nome: r.cliente_nome, telefone: r.cliente_telefone }
      : null,
    responsavel: r.responsavel_nome
      ? { nome: r.responsavel_nome, telefone: r.responsavel_telefone }
      : null,
    aviso:
      "Lembretes futuros re-agendados. O convite imediato será enviado em 1 minuto.",
  });
}
