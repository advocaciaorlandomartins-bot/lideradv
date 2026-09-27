import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // usar_timbrado=false já tira o timbrado completo, mas ainda cai no
  // cabeçalho "simples" (nome do escritório em texto no topo de cada
  // página) — sem opção de tirar isso também. Formulários oficiais como o
  // LOAS do JEF/AL precisam sair 100% neutros, sem identificação nenhuma
  // do escritório em lugar algum da folha.
  await sql`
    ALTER TABLE modelos_documento
      ADD COLUMN IF NOT EXISTS ocultar_identificacao_escritorio BOOLEAN NOT NULL DEFAULT false
  `;
  console.log(
    "✓ coluna ocultar_identificacao_escritorio garantida em modelos_documento (default false, preserva o comportamento atual)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
