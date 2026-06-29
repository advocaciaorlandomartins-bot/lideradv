/**
 * GET    /api/admin/cleanup  — preview: mostra registros de teste que seriam apagados
 * DELETE /api/admin/cleanup  — executa a limpeza (requer Administrador(a))
 *
 * Identifica "dados de teste" pelo padrão de nome (regex case-insensitive):
 * teste, test, demo, ficticio, joão/joao silva, maria silva, jose silva,
 * fake, exemplo, example, fulano, beltrano, sicrano
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Regex PostgreSQL — case-insensitive via ~*
const PATTERN =
  "\\mteste\\M|\\mtest\\M|\\mdemo\\M|ficticio|fictício|joão silva|joao silva|maria silva|jose silva|josé silva|\\mfake\\M|exemplo|example|\\mfulano\\M|beltrano|sicrano";

export async function GET() {
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
        AND name ~* ${PATTERN}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT id, nome_completo, email, telefone, status, created_at
      FROM crm_leads
      WHERE nome_completo ~* ${PATTERN}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT id, nome_candidato, cargo_vaga, perfil_dominante, created_at
      FROM testes_comportamentais
      WHERE nome_candidato ~* ${PATTERN}
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

  // 1. Testes DISC fictícios — hard delete (sem vínculos)
  const discDel = await sql`
    DELETE FROM testes_comportamentais
    WHERE nome_candidato ~* ${PATTERN}
    RETURNING id
  `;
  resultados.push({ operacao: "testes_disc", removidos: discDel.length });

  // 2. CRM leads fictícios — hard delete
  const leadsDel = await sql`
    DELETE FROM crm_leads
    WHERE nome_completo ~* ${PATTERN}
    RETURNING id
  `;
  resultados.push({ operacao: "crm_leads", removidos: leadsDel.length });

  // 3. Clientes fictícios — soft delete (preserva integridade referencial)
  const clientesDel = await sql`
    UPDATE clients
    SET deleted_at = NOW()
    WHERE deleted_at IS NULL
      AND name ~* ${PATTERN}
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
