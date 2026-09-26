import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Suporte ao Formulário LOAS: a tabela "RENDA FAMILIAR" do formulário
  // precisa dos membros do grupo familiar (nome/parentesco/nascimento/CPF)
  // e a faixa de renda per capita do CadÚnico (critério de elegibilidade do
  // BPC/LOAS) — nenhum dos dois existia no cadastro do cliente, só dados da
  // própria pessoa titular e do responsável legal.
  await sql`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS membros_familia JSONB,
      ADD COLUMN IF NOT EXISTS renda_familiar_per_capita TEXT
  `;
  console.log(
    "✓ colunas membros_familia e renda_familiar_per_capita garantidas em clients"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
