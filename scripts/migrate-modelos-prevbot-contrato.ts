import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // /api/integracoes/prevbot/contrato escolhia o modelo automático com
  // `modelos.find(m => m.requer_responsavel_legal === client.menor_incapaz)`
  // — funcionava enquanto só existia UM modelo com essa flag em cada valor.
  // Ao marcar o Formulário LOAS como requer_responsavel_legal=true (pra
  // puxar nome/CPF do responsável na declaração), ele passou a colidir com
  // "Procuração e Contrato de Honorários Advocatícios" (também true) — e
  // como "Previdenciário" vem antes de "Procurações" na ordenação, o
  // .find() passou a devolver o Formulário LOAS: um lead do PrevBot
  // marcado menor/incapaz receberia o formulário errado pra assinar em vez
  // do contrato de honorários.
  //
  // Flag nova e específica pra essa rota, independente de
  // requer_responsavel_legal (que só descreve o TEXTO do modelo, não pra
  // que ele serve) — evita a mesma colisão com qualquer modelo futuro que
  // também precise da variante "com responsável legal".
  await sql`
    ALTER TABLE modelos_documento
      ADD COLUMN IF NOT EXISTS usar_prevbot_contrato BOOLEAN NOT NULL DEFAULT false
  `;
  const res = await sql`
    UPDATE modelos_documento
    SET usar_prevbot_contrato = true
    WHERE titulo = 'Procuração e Contrato de Honorários Advocatícios'
    RETURNING id::text, requer_responsavel_legal
  `;
  console.log(
    `✓ coluna usar_prevbot_contrato garantida; marcada true em ${res.length} modelo(s):`,
    JSON.stringify(res)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
