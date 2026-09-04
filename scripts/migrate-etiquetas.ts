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

  // Seed com os grupos padrão pra não começar em branco. Sem STATUS
  // (ATIVO/INATIVO) — já existe status/deleted_at reais em clients/processos,
  // uma etiqueta duplicando isso só confundiria.
  const seed: {
    categoria: string;
    valor: string;
    cor: string;
    escopo: string;
  }[] = [
    // FASE — esteira de atendimento (mais usada em cliente, mas cabe em ambos)
    { categoria: "FASE", valor: "MARKETING", cor: "amber", escopo: "ambos" },
    {
      categoria: "FASE",
      valor: "EM_NEGOCIACAO",
      cor: "amber",
      escopo: "ambos",
    },
    { categoria: "FASE", valor: "CONSULTORIA", cor: "amber", escopo: "ambos" },
    {
      categoria: "FASE",
      valor: "ADMINISTRATIVA",
      cor: "amber",
      escopo: "ambos",
    },
    { categoria: "FASE", valor: "JUDICIAL", cor: "amber", escopo: "ambos" },
    { categoria: "FASE", valor: "RECURSAL", cor: "amber", escopo: "ambos" },
    { categoria: "FASE", valor: "EXECUCAO", cor: "amber", escopo: "ambos" },
    { categoria: "FASE", valor: "ARQUIVADO", cor: "amber", escopo: "ambos" },
    // AREA
    { categoria: "AREA", valor: "CIVIL", cor: "blue", escopo: "ambos" },
    { categoria: "AREA", valor: "CONSUMIDOR", cor: "blue", escopo: "ambos" },
    { categoria: "AREA", valor: "CRIMINAL", cor: "blue", escopo: "ambos" },
    { categoria: "AREA", valor: "FAMILIA", cor: "blue", escopo: "ambos" },
    {
      categoria: "AREA",
      valor: "PREVIDENCIARIO",
      cor: "blue",
      escopo: "ambos",
    },
    { categoria: "AREA", valor: "TRABALHISTA", cor: "blue", escopo: "ambos" },
    { categoria: "AREA", valor: "TRIBUTARIO", cor: "blue", escopo: "ambos" },
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
    // ORIGEM — de onde veio o cliente/lead
    { categoria: "ORIGEM", valor: "FACEBOOK", cor: "slate", escopo: "cliente" },
    {
      categoria: "ORIGEM",
      valor: "GOOGLE_ADS",
      cor: "slate",
      escopo: "cliente",
    },
    {
      categoria: "ORIGEM",
      valor: "INDICACAO",
      cor: "slate",
      escopo: "cliente",
    },
    {
      categoria: "ORIGEM",
      valor: "INSTAGRAM",
      cor: "slate",
      escopo: "cliente",
    },
    { categoria: "ORIGEM", valor: "PARCEIRO", cor: "slate", escopo: "cliente" },
    { categoria: "ORIGEM", valor: "SITE", cor: "slate", escopo: "cliente" },
    { categoria: "ORIGEM", valor: "WHATSAPP", cor: "slate", escopo: "cliente" },
    // PRIORIDADE — cor por valor (semântica), não por categoria
    { categoria: "PRIORIDADE", valor: "URGENTE", cor: "red", escopo: "ambos" },
    { categoria: "PRIORIDADE", valor: "ALTA", cor: "orange", escopo: "ambos" },
    { categoria: "PRIORIDADE", valor: "NORMAL", cor: "cyan", escopo: "ambos" },
    { categoria: "PRIORIDADE", valor: "BAIXA", cor: "slate", escopo: "ambos" },
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
