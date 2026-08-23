import sql from "./db";

// Limite por usuário por hora em endpoints de IA custosos
const IA_LIMIT_POR_HORA = 60;

// Máximo de cadastros por IP em 24 horas
const REGISTRO_LIMIT_24H = 5;

// Máximo de tentativas de login malsucedidas por login em 15 minutos
const LOGIN_LIMIT_15MIN = 8;

// Máximo de tentativas de login malsucedidas por IP em 15 minutos — mais
// alto que o limite por login porque um IP de escritório legítimo pode ter
// vários usuários reais errando a senha ao mesmo tempo.
const LOGIN_IP_LIMIT_15MIN = 30;

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

/**
 * Verifica se um login OU o IP de origem excedeu o limite de tentativas
 * malsucedidas — proteção contra força bruta/credential stuffing E contra
 * password spraying (mesma senha testada contra muitos logins diferentes
 * a partir do mesmo IP, que sozinho o limite por login não detecta, já
 * que cada login tem contador independente).
 * Não registra nada; use `registrarLoginFalho` após uma senha incorreta.
 */
export async function loginRateLimitExcedido(
  login: string,
  ip: string | null
): Promise<boolean> {
  try {
    const [row] = await sql`
      SELECT COUNT(*)::int AS total
      FROM login_tentativas
      WHERE login = ${login}
        AND criado_em >= NOW() - INTERVAL '15 minutes'
    `;
    if ((row.total as number) >= LOGIN_LIMIT_15MIN) return true;

    if (ip) {
      const [rowIp] = await sql`
        SELECT COUNT(*)::int AS total
        FROM login_tentativas
        WHERE ip = ${ip}
          AND criado_em >= NOW() - INTERVAL '15 minutes'
      `;
      if ((rowIp.total as number) >= LOGIN_IP_LIMIT_15MIN) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Registra uma tentativa de login malsucedida para o rate limit acima. */
export async function registrarLoginFalho(
  login: string,
  ip: string | null
): Promise<void> {
  try {
    await sql`INSERT INTO login_tentativas (login, ip) VALUES (${login}, ${ip})`;
    sql`DELETE FROM login_tentativas WHERE criado_em < NOW() - INTERVAL '48 hours'`.catch(
      () => {}
    );
  } catch {
    // Em caso de erro no DB, não bloqueia o fluxo de login
  }
}
