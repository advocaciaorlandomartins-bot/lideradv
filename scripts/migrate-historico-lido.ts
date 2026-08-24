import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // A tela de Andamentos usava historico_registros.situacao (campo de texto
  // livre digitado no formulário do processo, ex: "Em análise" — não tem
  // relação com leitura) para decidir "lido"/"não lido". Nunca havia nenhum
  // UPDATE gravando 'lido' ali, então a badge "não lidos" e o filtro
  // correspondente ficavam permanentemente errados. Coluna dedicada, só
  // gravada quando o usuário efetivamente marca como lido.
  await sql`
    ALTER TABLE historico_registros ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ
  `;
  console.log("✓ coluna lido_em garantida em historico_registros");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
