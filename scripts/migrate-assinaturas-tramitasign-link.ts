import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Guarda o retorno do TramitaSign por assinante — precisa pra mostrar o
  // link de assinatura na tela de detalhe mesmo quando a notificação
  // automática (email/WhatsApp) estiver desligada pro assinante.
  await sql`
    ALTER TABLE envelope_assinantes
      ADD COLUMN IF NOT EXISTS tramitasign_documento_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tramitasign_link TEXT
  `;
  console.log(
    "✓ colunas tramitasign_documento_id/tramitasign_link garantidas em envelope_assinantes"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
