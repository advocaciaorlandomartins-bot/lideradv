import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // O envio pro TramitaSign podia falhar silenciosamente (usuário/cliente
  // não obtido na API deles) e a tela de detalhe do envelope não mostrava
  // nada — parecia "aguardando" pra sempre sem explicar por quê. Guarda o
  // motivo do último erro por assinante pra exibir na tela e permitir
  // reenviar.
  await sql`
    ALTER TABLE envelope_assinantes
      ADD COLUMN IF NOT EXISTS tramitasign_erro TEXT
  `;
  console.log("✓ coluna tramitasign_erro garantida em envelope_assinantes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
