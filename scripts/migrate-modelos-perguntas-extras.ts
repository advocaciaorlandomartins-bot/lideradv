import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Modelos como o Formulário LOAS têm seções que não vêm do cadastro do
  // cliente nem podem ser puxadas de documento nenhum (ex: "quais bens
  // guarnecem o imóvel") — até agora ficavam em branco no PDF pra escrever
  // à mão depois de impresso. perguntas_extras permite que QUALQUER modelo
  // declare perguntas de texto livre que o usuário responde na hora de
  // gerar o documento (tela "Gerar Documento"), substituídas como variável
  // normal ({{tag}}) no conteúdo — mesmo mecanismo de vars já existente,
  // só que a fonte do valor é a resposta digitada, não o cadastro.
  await sql`
    ALTER TABLE modelos_documento
      ADD COLUMN IF NOT EXISTS perguntas_extras JSONB
  `;
  console.log("✓ coluna perguntas_extras garantida em modelos_documento");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
