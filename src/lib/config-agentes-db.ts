import sql from "./db";

const CHAVE_AGENTES_ATIVOS = "agentes_ativos";

/** Kill switch global — ausência de linha = ativo (default seguro: a
 * tabela vazia nunca trava o sistema por engano). Lido antes de cada
 * chamada de IA/job que respeita o kill switch; cacheado por request, não
 * entre requests (uma troca no toggle deve valer na próxima chamada, não
 * só depois de alguns minutos). */
export async function agentesEstaoAtivos(): Promise<boolean> {
  const [row] = await sql`
    SELECT valor FROM config_agentes WHERE chave = ${CHAVE_AGENTES_ATIVOS}
  `;
  if (!row) return true;
  const valor = row.valor as { ativo?: boolean } | null;
  return valor?.ativo !== false;
}

export async function definirAgentesAtivos(
  ativo: boolean,
  usuarioId: string | null
): Promise<void> {
  await sql`
    INSERT INTO config_agentes (chave, valor, atualizado_por)
    VALUES (${CHAVE_AGENTES_ATIVOS}, ${JSON.stringify({ ativo })}, ${usuarioId})
    ON CONFLICT (chave) DO UPDATE SET
      valor = EXCLUDED.valor,
      atualizado_em = NOW(),
      atualizado_por = EXCLUDED.atualizado_por
  `;
}
