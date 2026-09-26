import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // As respostas de perguntas_extras (ex: b.1 a b.5 do Formulário LOAS) só
  // viviam no state do modal "Gerar Documento" — fechava a tela e sumia,
  // obrigando digitar tudo de novo a cada geração do mesmo cliente. Guarda
  // por tag no próprio cliente (mesmo espírito de membros_familia), pra
  // pré-preencher da próxima vez e só precisar editar o que mudou.
  await sql`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS respostas_extras JSONB
  `;
  console.log("✓ coluna respostas_extras garantida em clients");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
