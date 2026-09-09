import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// Migração de correção, one-time: o seed original de etiquetas (migrate-
// etiquetas.ts) copiou de perto o catálogo do concorrente TramitaIA, mas
// 3 das 5 categorias duplicam dado que o LiderAdv já tem em coluna real —
// AREA (processos.area, sempre "Previdenciário" aqui), ORIGEM (crm_leads.
// origem, sempre "prevbot" aqui) e PRIORIDADE (processos.prioridade, já
// editável na ficha do processo). Uma etiqueta manual por cima de um campo
// que já existe não agrega nada e ainda cria uma segunda fonte de verdade
// que pode divergir da primeira sem ninguém perceber — o motivo real por
// trás do pedido do Orlando pra revisar isso. FASE também sobrepunha os
// dois kanbans reais (funil do CRM + Linha de Produção); mantém só
// RECURSAL/EXECUCAO, que não têm estágio dedicado em lugar nenhum hoje.
async function main() {
  const antes = await sql`
    SELECT categoria, COUNT(*)::int AS n FROM etiquetas GROUP BY categoria ORDER BY categoria
  `;
  console.log("Catálogo antes:", antes);

  const removidas = await sql`
    DELETE FROM etiquetas
    WHERE categoria IN ('AREA', 'ORIGEM', 'PRIORIDADE')
       OR (categoria = 'FASE' AND valor NOT IN ('RECURSAL', 'EXECUCAO'))
    RETURNING categoria, valor
  `;
  console.log(`✓ ${removidas.length} etiqueta(s) redundante(s) removida(s):`);
  for (const r of removidas) console.log(`  - ${r.categoria}:${r.valor}`);

  const depois = await sql`
    SELECT categoria, COUNT(*)::int AS n FROM etiquetas GROUP BY categoria ORDER BY categoria
  `;
  console.log("Catálogo depois:", depois);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
