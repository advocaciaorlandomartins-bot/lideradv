import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // "Exigir assinatura desenhada" — o assinante desenha a própria
  // assinatura na tela (dedo/mouse) em vez de só clicar pra assinar; o
  // TramitaSign tem essa opção na interface deles (handwritten_signature_required
  // na API), mas o nosso formulário de novo envelope não tinha esse campo.
  await sql`
    ALTER TABLE envelope_assinantes
      ADD COLUMN IF NOT EXISTS val_assinatura_desenhada BOOLEAN NOT NULL DEFAULT false
  `;
  console.log(
    "✓ coluna val_assinatura_desenhada garantida em envelope_assinantes"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
