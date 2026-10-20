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
  fonte: string;
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
  // "fonte" — de onde veio o movimento (datajud | tramitasign). Adicionado
  // quando o TramitaSign entrou como reforço ao DataJud (2026-10-20):
  // os dois podem trazer o mesmo evento do tribunal, então a chave de
  // dedupe abaixo foi relaxada (ver nota) pra reconhecer isso como a
  // MESMA movimentação, não duas.
  await sql`
    ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS fonte TEXT NOT NULL DEFAULT 'datajud'
  `;
  // O código (campo numérico padrão CNJ) só existe nos dados do DataJud —
  // o TramitaSign não expõe código, só o nome do tipo. Com "código" na
  // chave de dedupe, o mesmo evento vindo das duas fontes nunca colidia
  // (código real vs sempre NULL) e virava duplicata na timeline. A chave
  // de dedupe real agora é processo+data_hora+nome — código fica só como
  // dado informativo, fora da unicidade.
  await sql`DROP INDEX IF EXISTS idx_movimentacoes_dedupe`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_movimentacoes_dedupe
      ON movimentacoes (processo_id, data_hora, nome)
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
           grau, complementos, fonte
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
    fonte: String(r.fonte ?? "datajud"),
  }));
}

export interface NovaMovimentacao {
  codigo: number | null;
  nome: string;
  dataHora: string;
  grau: string | null;
  complementos: string | null;
  fonte?: string;
}

/**
 * Insere em lote, ignorando duplicatas (mesmo processo+data_hora+nome já
 * capturado antes, de qualquer fonte) — chamada toda vez que o processo é
 * resincronizado com o DataJud e/ou o TramitaSign, então a maioria das
 * linhas já existe. Em conflito, mantém a linha existente (não troca a
 * fonte) — a primeira fonte a trazer o evento "ganha" o registro.
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
          (processo_id, codigo, nome, data_hora, grau, complementos, fonte)
        VALUES (
          ${processoId}::uuid, ${m.codigo}, ${m.nome},
          ${m.dataHora}::timestamptz, ${m.grau}, ${m.complementos},
          ${m.fonte ?? "datajud"}
        )
        ON CONFLICT (processo_id, data_hora, nome)
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
