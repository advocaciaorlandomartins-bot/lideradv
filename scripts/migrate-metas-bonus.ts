import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE colaboradores
      ADD COLUMN IF NOT EXISTS meta1_valor NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS meta1_bonus NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS meta2_valor NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS meta2_bonus NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS meta3_valor NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS meta3_bonus NUMERIC(12,2)
  `;

  // Marca de que remuneração X já é o bônus de meta do mês Y — evita gerar
  // duas vezes pro mesmo colaborador na mesma competência (índice único
  // parcial, só entra em jogo pra linhas que de fato são bônus de meta).
  await sql`
    ALTER TABLE remuneracoes
      ADD COLUMN IF NOT EXISTS origem_meta_competencia DATE
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_remuneracoes_meta_unica
    ON remuneracoes (colaborador_id, origem_meta_competencia)
    WHERE origem_meta_competencia IS NOT NULL
  `;

  console.log("Migração concluída: metas + bônus escalonado.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
