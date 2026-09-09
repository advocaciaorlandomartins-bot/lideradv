import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS etiquetas (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      categoria  VARCHAR(40) NOT NULL,
      valor      VARCHAR(60) NOT NULL,
      cor        VARCHAR(20) NOT NULL DEFAULT 'slate',
      escopo     VARCHAR(10) NOT NULL DEFAULT 'ambos' CHECK (escopo IN ('cliente', 'processo', 'ambos')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (categoria, valor)
    )
  `;
  console.log("✓ Tabela etiquetas");

  await sql`
    CREATE TABLE IF NOT EXISTS etiquetas_clientes (
      etiqueta_id UUID NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
      cliente_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (etiqueta_id, cliente_id)
    )
  `;
  console.log("✓ Tabela etiquetas_clientes");

  await sql`
    CREATE TABLE IF NOT EXISTS etiquetas_processos (
      etiqueta_id UUID NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
      processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (etiqueta_id, processo_id)
    )
  `;
  console.log("✓ Tabela etiquetas_processos");

  await sql`CREATE INDEX IF NOT EXISTS idx_etiquetas_clientes_cliente ON etiquetas_clientes (cliente_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_etiquetas_processos_processo ON etiquetas_processos (processo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_etiquetas_categoria ON etiquetas (categoria)`;
  console.log("✓ Índices");

  // Seed com os grupos padrão pra não começar em branco. Catálogo do
  // concorrente (TramitaIA) tinha STATUS/AREA/ORIGEM/PRIORIDADE além de FASE
  // completo e BENEFICIO — cortado pro que não duplica dado que o LiderAdv já
  // tem em coluna real (viraria uma segunda fonte de verdade, divergente da
  // primeira, exatamente o tipo de coisa que devia ter sido pego antes):
  // - STATUS: já existe status/deleted_at reais em clients/processos.
  // - AREA: já existe processos.area — e o escritório é 100% previdenciário
  //   (área nunca varia), então a etiqueta nunca discriminaria nada.
  // - ORIGEM: já existe crm_leads.origem — e hoje 100% dos leads chegam via
  //   PrevBot, então idem, nunca discriminaria nada.
  // - PRIORIDADE: já existe processos.prioridade (editável, exibido na ficha
  //   do processo).
  // - FASE: a maior parte dos valores do concorrente (MARKETING/
  //   EM_NEGOCIACAO/CONSULTORIA/ADMINISTRATIVA/JUDICIAL/ARQUIVADO) já é
  //   coberta pelos dois kanbans reais e orientados a estágio que o LiderAdv
  //   tem (funil do CRM + Linha de Produção) — uma etiqueta manual por cima
  //   disso pode divergir do estágio real sem ninguém perceber. Sobra só
  //   RECURSAL/EXECUCAO, que não têm estágio dedicado em lugar nenhum hoje.
  const seed: {
    categoria: string;
    valor: string;
    cor: string;
    escopo: string;
  }[] = [
    // FASE — só as sub-fases judiciais que não têm estágio real no sistema.
    { categoria: "FASE", valor: "RECURSAL", cor: "amber", escopo: "ambos" },
    { categoria: "FASE", valor: "EXECUCAO", cor: "amber", escopo: "ambos" },
    // BENEFICIO — específico do caso previdenciário
    {
      categoria: "BENEFICIO",
      valor: "APIU",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "APTC",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "BPC_LOAS",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "INCAPACIDADE",
      cor: "violet",
      escopo: "processo",
    },
    { categoria: "BENEFICIO", valor: "PCD", cor: "violet", escopo: "processo" },
    {
      categoria: "BENEFICIO",
      valor: "PENSAO_POR_MORTE",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "SALARIO_MATERNIDADE",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "APOSENTADORIA_IDADE",
      cor: "violet",
      escopo: "processo",
    },
    {
      categoria: "BENEFICIO",
      valor: "APOSENTADORIA_INVALIDEZ",
      cor: "violet",
      escopo: "processo",
    },
  ];

  let inseridas = 0;
  for (const e of seed) {
    const rows = await sql`
      INSERT INTO etiquetas (categoria, valor, cor, escopo)
      VALUES (${e.categoria}, ${e.valor}, ${e.cor}, ${e.escopo})
      ON CONFLICT (categoria, valor) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) inseridas++;
  }
  console.log(
    `✓ Seed: ${inseridas} etiqueta(s) nova(s) inserida(s) de ${seed.length} no catálogo padrão.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
