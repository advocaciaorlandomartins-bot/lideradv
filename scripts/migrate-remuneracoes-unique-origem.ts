import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Impede duas comissões geradas pro mesmo lançamento+colaborador — sem
  // isso, um double-click ou retry em "Registrar Pagamento" podia disparar
  // gerarComissaoAutomaticaPorPagamento() duas vezes em paralelo: como a
  // checagem de "já existe" é um SELECT separado do INSERT (sem transação),
  // as duas chamadas passavam pela checagem antes de qualquer uma inserir,
  // duplicando a comissão paga.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_remuneracoes_origem_colaborador
      ON remuneracoes (origem_lancamento_id, colaborador_id)
      WHERE origem_lancamento_id IS NOT NULL
  `;
  console.log(
    "✓ índice único uq_remuneracoes_origem_colaborador criado (ou já existia)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
