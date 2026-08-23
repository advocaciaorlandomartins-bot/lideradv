import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  // Rate limit de login era só por username — um atacante com uma lista de
  // e-mails vazados podia tentar a mesma senha contra milhares de contas
  // diferentes sem nunca acionar o bloqueio (cada login tem contador
  // independente). Adiciona IP pra também limitar por origem da requisição.
  await sql`
    ALTER TABLE login_tentativas ADD COLUMN IF NOT EXISTS ip VARCHAR(64)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS login_tentativas_ip_criado_em
      ON login_tentativas (ip, criado_em)
  `;
  console.log("✓ coluna ip + índice criados em login_tentativas");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
