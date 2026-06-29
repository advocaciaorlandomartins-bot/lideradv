/**
 * GET    /api/admin/cleanup  — preview: mostra registros de teste que seriam apagados
 * DELETE /api/admin/cleanup  — executa a limpeza (requer Administrador(a))
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (session.categoria !== "Administrador(a)") {
      return NextResponse.json(
        { error: "Apenas administradores podem executar esta operação." },
        { status: 403 }
      );
    }

    const [clientes, leads, disc] = await Promise.all([
      sql`
      SELECT id, name, doc, email, created_at,
        (SELECT COUNT(*)::int FROM processos
         WHERE client_id = clients.id AND deleted_at IS NULL) AS processos_ativos
      FROM clients
      WHERE deleted_at IS NULL
        AND (
          name ILIKE '%teste%'
          OR name ILIKE '%ficticio%'
          OR name ILIKE '%fictício%'
          OR name ILIKE '%joao silva%'
          OR name ILIKE '%joão silva%'
          OR name ILIKE '%maria silva%'
          OR name ILIKE '%jose silva%'
          OR name ILIKE '%josé silva%'
          OR name ILIKE '%fulano%'
          OR name ILIKE '%beltrano%'
          OR name ILIKE '%sicrano%'
          OR name ILIKE '%exemplo%'
          OR name ILIKE '%example%'
        )
      ORDER BY created_at DESC
    `,
      sql`
      SELECT id, nome, email, telefone, status, created_at
      FROM crm_leads
      WHERE
        nome ILIKE '%teste%'
        OR nome ILIKE '%ficticio%'
        OR nome ILIKE '%fictício%'
        OR nome ILIKE '%joao silva%'
        OR nome ILIKE '%joão silva%'
        OR nome ILIKE '%maria silva%'
        OR nome ILIKE '%jose silva%'
        OR nome ILIKE '%josé silva%'
        OR nome ILIKE '%fulano%'
        OR nome ILIKE '%beltrano%'
        OR nome ILIKE '%sicrano%'
        OR nome ILIKE '%exemplo%'
        OR nome ILIKE '%example%'
      ORDER BY created_at DESC
    `,
      sql`
      SELECT id, nome_candidato, cargo_vaga, perfil_dominante, created_at
      FROM testes_comportamentais
      WHERE
        nome_candidato ILIKE '%teste%'
        OR nome_candidato ILIKE '%ficticio%'
        OR nome_candidato ILIKE '%joao silva%'
        OR nome_candidato ILIKE '%joão silva%'
        OR nome_candidato ILIKE '%maria silva%'
        OR nome_candidato ILIKE '%fulano%'
        OR nome_candidato ILIKE '%beltrano%'
        OR nome_candidato ILIKE '%exemplo%'
      ORDER BY created_at DESC
    `,
    ]);

    return NextResponse.json({
      preview: true,
      aviso:
        "Estes são os registros identificados como teste. Para apagar, envie DELETE /api/admin/cleanup.",
      clientes: { total: clientes.length, itens: clientes },
      leads: { total: leads.length, itens: leads },
      testes_disc: { total: disc.length, itens: disc },
      total_geral: clientes.length + leads.length + disc.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Erro interno", detalhe: msg },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (session.categoria !== "Administrador(a)") {
    return NextResponse.json(
      { error: "Apenas administradores podem executar esta operação." },
      { status: 403 }
    );
  }

  const resultados: { operacao: string; removidos: number }[] = [];

  // 1. Testes DISC fictícios — hard delete
  const discDel = await sql`
    DELETE FROM testes_comportamentais
    WHERE
      nome_candidato ILIKE '%teste%'
      OR nome_candidato ILIKE '%ficticio%'
      OR nome_candidato ILIKE '%joao silva%'
      OR nome_candidato ILIKE '%joão silva%'
      OR nome_candidato ILIKE '%maria silva%'
      OR nome_candidato ILIKE '%fulano%'
      OR nome_candidato ILIKE '%beltrano%'
      OR nome_candidato ILIKE '%exemplo%'
    RETURNING id
  `;
  resultados.push({ operacao: "testes_disc", removidos: discDel.length });

  // 2. CRM leads fictícios — hard delete
  const leadsDel = await sql`
    DELETE FROM crm_leads
    WHERE
      nome ILIKE '%teste%'
      OR nome ILIKE '%ficticio%'
      OR nome ILIKE '%fictício%'
      OR nome ILIKE '%joao silva%'
      OR nome ILIKE '%joão silva%'
      OR nome ILIKE '%maria silva%'
      OR nome ILIKE '%jose silva%'
      OR nome ILIKE '%josé silva%'
      OR nome ILIKE '%fulano%'
      OR nome ILIKE '%beltrano%'
      OR nome ILIKE '%sicrano%'
      OR nome ILIKE '%exemplo%'
      OR nome ILIKE '%example%'
    RETURNING id
  `;
  resultados.push({ operacao: "crm_leads", removidos: leadsDel.length });

  // 3. Clientes fictícios — soft delete (preserva integridade referencial)
  const clientesDel = await sql`
    UPDATE clients
    SET deleted_at = NOW()
    WHERE deleted_at IS NULL
      AND (
        name ILIKE '%teste%'
        OR name ILIKE '%ficticio%'
        OR name ILIKE '%fictício%'
        OR name ILIKE '%joao silva%'
        OR name ILIKE '%joão silva%'
        OR name ILIKE '%maria silva%'
        OR name ILIKE '%jose silva%'
        OR name ILIKE '%josé silva%'
        OR name ILIKE '%fulano%'
        OR name ILIKE '%beltrano%'
        OR name ILIKE '%sicrano%'
        OR name ILIKE '%exemplo%'
        OR name ILIKE '%example%'
      )
    RETURNING id
  `;
  resultados.push({ operacao: "clientes", removidos: clientesDel.length });

  // 4. Soft delete nos processos dos clientes removidos
  if (clientesDel.length > 0) {
    const ids = clientesDel.map((c) => c.id as string);
    const processosDel = await sql`
      UPDATE processos
      SET deleted_at = NOW()
      WHERE deleted_at IS NULL
        AND client_id = ANY(${ids}::uuid[])
      RETURNING id
    `;
    resultados.push({
      operacao: "processos_vinculados",
      removidos: processosDel.length,
    });
  }

  const total = resultados.reduce((s, r) => s + r.removidos, 0);

  return NextResponse.json({
    ok: true,
    mensagem: `Limpeza concluída. ${total} registros removidos.`,
    detalhes: resultados,
  });
}
