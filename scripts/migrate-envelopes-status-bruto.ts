import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Sem chave da API do TramitaSign disponível localmente, não dá pra
  // consultar o status remoto direto por curl pra diagnosticar o envelope
  // "Procuração Regina" (assinante já assinado há mais de 1h, envelope
  // ainda "aguardando", PDF nunca chegou na área do cliente). Grava o
  // status bruto que o TramitaSign devolve a cada sincronização (webhook
  // ou botão "Verificar status"), mesmo quando não é "finalizado" — sem
  // isso, o único jeito de saber o que eles realmente respondem era pedir
  // pro Orlando colar aqui, ou eu ter a chave em mãos.
  await sql`
    ALTER TABLE envelopes
      ADD COLUMN IF NOT EXISTS tramitasign_ultimo_status TEXT,
      ADD COLUMN IF NOT EXISTS tramitasign_ultima_sync TIMESTAMPTZ
  `;
  console.log(
    "✓ colunas tramitasign_ultimo_status e tramitasign_ultima_sync garantidas em envelopes"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
