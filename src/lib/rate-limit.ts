import sql from "./db";

// Limite por usuário por hora em endpoints de IA custosos
const IA_LIMIT_POR_HORA = 60;

/**
 * Verifica se o usuário excedeu o limite de chamadas de IA.
 * Usa a tabela `ia_usage_log` para contar chamadas na última hora.
 * Retorna true se o limite foi excedido.
 */
export async function iaRateLimitExcedido(userLogin: string): Promise<boolean> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ia_usage_log (
        id         BIGSERIAL PRIMARY KEY,
        user_login VARCHAR(100) NOT NULL,
        criado_em  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    const [row] = await sql`
      SELECT COUNT(*)::int AS total
      FROM ia_usage_log
      WHERE user_login = ${userLogin}
        AND criado_em  >= NOW() - INTERVAL '1 hour'
    `;

    if ((row.total as number) >= IA_LIMIT_POR_HORA) return true;

    await sql`
      INSERT INTO ia_usage_log (user_login) VALUES (${userLogin})
    `;

    // Limpa registros antigos (> 2 horas) para não crescer indefinidamente
    sql`DELETE FROM ia_usage_log WHERE criado_em < NOW() - INTERVAL '2 hours'`.catch(
      () => {}
    );

    return false;
  } catch {
    // Em caso de erro no DB, deixa passar para não bloquear o serviço
    return false;
  }
}
