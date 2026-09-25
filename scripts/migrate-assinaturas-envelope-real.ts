import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // A API real de assinatura do TramitaSign modela isso como UM envelope
  // remoto por envelope nosso (não um "documento" por assinante, como a
  // implementação anterior assumia errado). Guarda o id numérico do
  // envelope lá, e por assinante troca o antigo tramitasign_documento_id
  // (não fazia sentido nesse modelo) pelo id real do "signer" devolvido
  // por POST /assinaturas/{id}/envio.
  await sql`
    ALTER TABLE envelopes
      ADD COLUMN IF NOT EXISTS tramitasign_envelope_id INTEGER
  `;
  await sql`
    ALTER TABLE envelope_assinantes
      ADD COLUMN IF NOT EXISTS tramitasign_signer_id TEXT
  `;
  console.log(
    "✓ envelopes.tramitasign_envelope_id e envelope_assinantes.tramitasign_signer_id garantidos"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
