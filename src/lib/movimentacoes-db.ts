import sql from "./db";

/**
 * Movimentações judiciais (andamentos do processo vindos do tribunal via
 * DataJud) — diferente de `publicacoes` (que são só as comunicações/
 * intimações com prazo) e de `historico_registros` (anotações internas
 * manuais do escritório, aba "Linha do Tempo"). Essa tabela guarda o
 * histórico processual bruto: distribuição, decisões, petições, atos
 * ordinatórios etc. — pedido do Orlando depois de comparar com o painel
 * do TramitaSign, que mostra isso separado das publicações.
 */
export interface Movimentacao {
  id: string;
  processoId: string;
  codigo: number | null;
  nome: string;
  dataHora: string;
  grau: string | null;
  complementos: string | null;
}

let ready = false;

async function ensureTable() {
  if (ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processo_id    UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
      codigo         INT,
      nome           TEXT NOT NULL,
      data_hora      TIMESTAMPTZ NOT NULL,
      grau           TEXT,
      complementos   TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Índice único via índice parcial (não via UNIQUE de coluna) porque
  // `complementos`/`grau` podem ser NULL e dois movimentos distintos
  // podem legitimamente ter o mesmo código+nome+data_hora só diferindo
  // nesses campos — a chave de dedupe real é processo+código+data_hora+nome.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_movimentacoes_dedupe
      ON movimentacoes (processo_id, COALESCE(codigo, -1), data_hora, nome)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_data
      ON movimentacoes (processo_id, data_hora DESC)
  `;
  ready = true;
}

export async function getMovimentacoesByProcesso(
  processoId: string
): Promise<Movimentacao[]> {
  await ensureTable();
  const rows = await sql`
    SELECT id::text, processo_id::text, codigo, nome, data_hora::text,
           grau, complementos
    FROM movimentacoes
    WHERE processo_id = ${processoId}::uuid
    ORDER BY data_hora DESC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    processoId: String(r.processo_id),
    codigo: r.codigo != null ? Number(r.codigo) : null,
    nome: String(r.nome),
    dataHora: String(r.data_hora),
    grau: r.grau ? String(r.grau) : null,
    complementos: r.complementos ? String(r.complementos) : null,
  }));
}

export interface NovaMovimentacao {
  codigo: number | null;
  nome: string;
  dataHora: string;
  grau: string | null;
  complementos: string | null;
}

/**
 * Insere em lote, ignorando duplicatas (mesmo processo+código+data_hora+
 * nome já capturado antes) — chamada toda vez que o processo é
 * resincronizado com o DataJud, então a maioria das linhas já existe.
 */
export async function inserirMovimentacoes(
  processoId: string,
  itens: NovaMovimentacao[]
): Promise<number> {
  if (itens.length === 0) return 0;
  await ensureTable();
  let inseridos = 0;
  for (const m of itens) {
    try {
      const res = await sql`
        INSERT INTO movimentacoes
          (processo_id, codigo, nome, data_hora, grau, complementos)
        VALUES (
          ${processoId}::uuid, ${m.codigo}, ${m.nome},
          ${m.dataHora}::timestamptz, ${m.grau}, ${m.complementos}
        )
        ON CONFLICT (processo_id, COALESCE(codigo, -1), data_hora, nome)
          DO NOTHING
        RETURNING id
      `;
      if (res.length > 0) inseridos++;
    } catch (err) {
      console.error(
        `[movimentacoes] falha ao inserir movimento do processo ${processoId}:`,
        err
      );
    }
  }
  return inseridos;
}
