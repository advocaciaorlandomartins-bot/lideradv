import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// Histórico de triagens feitas pelo PrevBot (WhatsApp) antes do cliente
// chegar ao escritório — documento médico analisado + CID encontrado +
// resumo da conversa até aquele ponto, pra o advogado abrir o caso já
// sabendo o que foi conversado, sem perguntar tudo de novo. Array (não um
// campo único) porque pode haver mais de uma triagem ao longo do tempo.
async function migrate() {
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS prevbot_triagens JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  console.log("✓ clients.prevbot_triagens");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
