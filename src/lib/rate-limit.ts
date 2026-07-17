import sql from "./db";

// Limite por usuário por hora em endpoints de IA custosos
const IA_LIMIT_POR_HORA = 60;

// Máximo de cadastros por IP em 24 horas
const REGISTRO_LIMIT_24H = 5;

/**
 * Verifica se o usuário excedeu o limite de chamadas de IA.
 * Usa a tabela `ia_usage_log` para contar chamadas na última hora.
 * Retorna true se o limite foi excedido.
 */
export async function iaRateLimitExcedido(userLogin: string): Promise<boolean> {
  try {
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

/**
 * Verifica se o IP excedeu o limite de tentativas de cadastro (5 por 24h).
 * Retorna true se bloqueado. Registra a tentativa automaticamente quando permitido.
 */
export async function registroRateLimitExcedido(ip: string): Promise<boolean> {
  try {
    const [row] = await sql`
      SELECT COUNT(*)::int AS total
      FROM registro_tentativas
      WHERE ip = ${ip}
        AND criado_em >= NOW() - INTERVAL '24 hours'
    `;

    if ((row.total as number) >= REGISTRO_LIMIT_24H) return true;

    await sql`INSERT INTO registro_tentativas (ip) VALUES (${ip})`;

    // Limpeza assíncrona de registros antigos (> 48h)
    sql`DELETE FROM registro_tentativas WHERE criado_em < NOW() - INTERVAL '48 hours'`.catch(
      () => {}
    );

    return false;
  } catch {
    return false;
  }
}
