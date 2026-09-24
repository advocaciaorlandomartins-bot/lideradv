import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver")) {
    return NextResponse.json([], { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  // Sem "clientes_ver_todos", este autocomplete deixava qualquer usuário
  // logado descobrir, digitando qualquer nome, se a pessoa é cliente do
  // escritório e o telefone direto de quem cuida do caso — mesmo pra
  // clientes que a tela normal de Clientes/podeAcessarCliente esconderiam
  // dele. Mesma restrição "só o que é seu" aplicada em todo outro lugar.
  const verTodos = hasPermission(session, "clientes_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : await getColaboradorIdForUser(session.id);
  if (!verTodos && !colaboradorId) return NextResponse.json([]);

  const rows = await sql`
    SELECT
      cl.id::text      AS id,
      cl.name,
      col.nome         AS resp_nome,
      col.telefone     AS resp_telefone,
      u.id::text       AS resp_usuario_id,
      u.login          AS resp_login
    FROM clients cl
    LEFT JOIN LATERAL (
      SELECT p.responsavel_id
      FROM processos p
      WHERE p.client_id = cl.id
        AND p.responsavel_id IS NOT NULL
        AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    ) lp ON true
    LEFT JOIN colaboradores col ON col.id = lp.responsavel_id AND col.status = 'ativo'
    LEFT JOIN usuarios u ON u.colaborador_id = col.id AND u.ativo = true
    WHERE cl.name ILIKE ${"%" + q + "%"}
      AND cl.deleted_at IS NULL
      AND (
        ${verTodos}
        OR EXISTS (
          SELECT 1 FROM processos p2
          WHERE p2.client_id = cl.id
            AND p2.deleted_at IS NULL
            AND p2.responsavel_id = ${colaboradorId}::uuid
        )
      )
    ORDER BY cl.name
    LIMIT 10
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      responsavel: r.resp_usuario_id
        ? {
            usuarioId: String(r.resp_usuario_id),
            login: String(r.resp_login),
            nome: String(r.resp_nome),
            telefone: r.resp_telefone ? String(r.resp_telefone) : null,
          }
        : null,
    }))
  );
}
