import sql from "./db";
import { MENSAGENS_PADROES, type MensagensConfig } from "@/config/mensagens";

export type { MensagensConfig };

// Templates INSS que tinham erro de concordância ("seu {{servico}}" para substantivos femininos).
// Quando detectado, o template salvo no DB é ignorado em favor do padrão corrigido.
const INSS_TEMPLATES_CORRIGIDOS: (keyof MensagensConfig)[] = [
  "inss_lembrete1",
  "inss_lembrete2",
  "inss_lembrete3",
  "inss_vespera_manha",
  "inss_vespera_tarde",
];

export async function getMensagensConfig(): Promise<MensagensConfig> {
  try {
    const rows = await sql`SELECT config FROM mensagens_config LIMIT 1`;
    const saved = (rows[0]?.config ?? {}) as Partial<MensagensConfig>;

    // Migração automática: descarta qualquer versão salva dos templates INSS que ainda
    // contenha artigo antes de {{servico}} (versão antiga com "seu/Seu" ou "o/O").
    // O template corrigido usa apenas *{{servico}}* sem artigo.
    for (const key of INSS_TEMPLATES_CORRIGIDOS) {
      const val = saved[key] as string | undefined;
      if (
        val &&
        /(\bseu\s+\{\{servico\}\}|\bSeu\s+\{\{servico\}\}|\bo\s+\*\{\{servico\}\}|\bO\s+\*\{\{servico\}\})/i.test(
          val
        )
      ) {
        delete saved[key];
      }
    }

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
