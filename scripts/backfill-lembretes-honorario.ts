import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Reprocessa lançamentos "entrada" pendentes, com vencimento e cliente com
 * telefone válido, que nunca tiveram NENHUM lembrete agendado em
 * lembretes_agendados — achado real em produção (Célia Vieira Rodrigues:
 * cliente com telefone cadastrado, 2 cobranças, zero lembretes) — provável
 * lançamento criado antes do fluxo de agendamento existir/ser editado
 * depois, sem nunca passar por reagendarLembretesHonorarioLancamento.
 *
 * Idempotente: só processa quem realmente não tem nenhum lembrete
 * (NOT EXISTS), então rodar de novo não duplica nada.
 */
async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const { agendarLembretesHonorario } = await import("../src/lib/lembretes");

  const candidatos = await sql`
    SELECT
      l.id::text AS lancamento_id,
      l.client_id::text AS client_id,
      l.valor,
      to_char(l.data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
      l.descricao,
      c.name AS cliente_nome,
      c.phone,
      c.menor_incapaz,
      c.responsavel_nome,
      c.responsavel_telefone
    FROM lancamentos l
    JOIN clients c ON c.id = l.client_id
    WHERE l.tipo = 'entrada'
      AND l.status = 'pendente'
      AND l.data_vencimento IS NOT NULL
      AND c.deleted_at IS NULL
      AND (
        (c.phone IS NOT NULL AND c.phone <> '')
        OR (c.responsavel_telefone IS NOT NULL AND c.responsavel_telefone <> '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM lembretes_agendados la
        WHERE la.referencia_tipo = 'lancamento' AND la.referencia_id = l.id
      )
  `;

  console.log(
    `Encontrados ${candidatos.length} lançamento(s) sem lembrete algum, com telefone válido.`
  );

  for (const row of candidatos) {
    const responsavel =
      row.menor_incapaz && row.responsavel_nome && row.responsavel_telefone
        ? {
            nome: String(row.responsavel_nome),
            telefone: String(row.responsavel_telefone),
          }
        : null;

    await agendarLembretesHonorario({
      lancamentoId: String(row.lancamento_id),
      clienteId: String(row.client_id),
      clienteNome: String(row.cliente_nome),
      telefone: row.phone ? String(row.phone) : null,
      responsavel,
      valor: Number(row.valor),
      dataVencimento: new Date(`${row.data_vencimento}T12:00:00`),
      descricao: String(row.descricao ?? ""),
    });
    console.log(
      `✓ Lembretes agendados: "${row.descricao}" — ${row.cliente_nome} (vence ${row.data_vencimento})`
    );
  }

  console.log(`Concluído: ${candidatos.length} lançamento(s) reprocessado(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
