import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // "usar_timbrado" (por modelo) só controla o cabeçalho/rodapé do papel
  // timbrado (TimbradoHeader/TimbradoFooter). Existe um SEGUNDO mecanismo,
  // "fundo timbrado" (imagem de fundo em Configurações), que era aplicado a
  // TODO PDF gerado incondicionalmente em modelo-pdf-render.ts — sem opção
  // de desligar por modelo. Formulários oficiais (ex: Formulário LOAS do
  // JEF/AL) precisam sair sem nenhuma marca do escritório, então cada
  // modelo agora pode desligar o fundo timbrado independente da
  // configuração geral do escritório.
  await sql`
    ALTER TABLE modelos_documento
      ADD COLUMN IF NOT EXISTS usar_fundo_timbrado BOOLEAN NOT NULL DEFAULT true
  `;
  console.log(
    "✓ coluna usar_fundo_timbrado garantida em modelos_documento (default true, preserva o comportamento atual)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
