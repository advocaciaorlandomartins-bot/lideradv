import sql from "./db";
import { MENSAGENS_PADROES, type MensagensConfig } from "@/config/mensagens";

export type { MensagensConfig };

export async function getMensagensConfig(): Promise<MensagensConfig> {
  try {
    const rows = await sql`SELECT config FROM mensagens_config LIMIT 1`;
    const saved = (rows[0]?.config ?? {}) as Partial<MensagensConfig>;
    return { ...MENSAGENS_PADROES, ...saved };
  } catch {
    return { ...MENSAGENS_PADROES };
  }
}

export async function saveMensagensConfig(
  updates: Partial<MensagensConfig>
): Promise<void> {
  const current = await getMensagensConfig();
  const merged = { ...current, ...updates };
  await sql`
    INSERT INTO mensagens_config (id, config, updated_at)
    VALUES (1, ${JSON.stringify(merged)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET config = EXCLUDED.config, updated_at = NOW()
  `;
}
