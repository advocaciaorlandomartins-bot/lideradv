import sql from "./db";

export interface LancamentoPessoal {
  id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  status: "recebido" | "a_receber" | "pago" | "pendente";
  recorrente: boolean;
  periodicidade: string | null;
  created_at: string;
}

export interface MeuFinanceiroInitial {
  lancamentos: LancamentoPessoal[];
  honorariosEscritorio: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLancamento(r: any): LancamentoPessoal {
  return {
    id: String(r.id),
    tipo: r.tipo as "receita" | "despesa",
    categoria: String(r.categoria),
    descricao: String(r.descricao),
    valor: Number(r.valor),
    data: String(r.data).slice(0, 10),
    status: r.status as "recebido" | "a_receber" | "pago" | "pendente",
    recorrente: Boolean(r.recorrente),
    periodicidade: r.periodicidade ? String(r.periodicidade) : null,
    created_at: String(r.created_at),
  };
}

export async function getMeuFinanceiroInitial(
  userId: string
): Promise<MeuFinanceiroInitial> {
  const [lancamentosRows, honorariosRows] = await Promise.all([
    sql`
      SELECT id::text, tipo, categoria, descricao, valor,
             data::text, status, recorrente, periodicidade, created_at::text
      FROM meu_financeiro_lancamentos
      WHERE usuario_id = ${userId}::uuid
      ORDER BY data DESC, created_at DESC
    `,
    sql`
      SELECT COALESCE(SUM(
        COALESCE(p.valor_honorario,
          CASE WHEN p.percentual_honorario IS NOT NULL AND p.valor_causa IS NOT NULL
               THEN p.percentual_honorario / 100.0 * p.valor_causa
               ELSE 0 END
        )
      ), 0) AS total
      FROM processos p
      WHERE p.status IN ('ativo', 'em_andamento')
        AND (p.valor_honorario IS NOT NULL
             OR (p.percentual_honorario IS NOT NULL AND p.valor_causa IS NOT NULL))
    `,
  ]);

  return {
    lancamentos: lancamentosRows.map(mapLancamento),
    honorariosEscritorio: Number(honorariosRows[0]?.total ?? 0),
  };
}

export async function criarLancamentoPessoal(
  userId: string,
  data: Omit<LancamentoPessoal, "id" | "created_at">
): Promise<LancamentoPessoal> {
  const rows = await sql`
    INSERT INTO meu_financeiro_lancamentos
      (usuario_id, tipo, categoria, descricao, valor, data, status, recorrente, periodicidade)
    VALUES
      (${userId}::uuid, ${data.tipo}, ${data.categoria}, ${data.descricao},
       ${data.valor}, ${data.data}::date, ${data.status}, ${data.recorrente},
       ${data.periodicidade ?? null})
    RETURNING id::text, tipo, categoria, descricao, valor,
              data::text, status, recorrente, periodicidade, created_at::text
  `;
  return mapLancamento(rows[0]);
}

export async function atualizarLancamentoPessoal(
  id: string,
  userId: string,
  data: Omit<LancamentoPessoal, "id" | "created_at">
): Promise<LancamentoPessoal | null> {
  const rows = await sql`
    UPDATE meu_financeiro_lancamentos SET
      tipo          = ${data.tipo},
      categoria     = ${data.categoria},
      descricao     = ${data.descricao},
      valor         = ${data.valor},
      data          = ${data.data}::date,
      status        = ${data.status},
      recorrente    = ${data.recorrente},
      periodicidade = ${data.periodicidade ?? null},
      updated_at    = NOW()
    WHERE id = ${id}::uuid AND usuario_id = ${userId}::uuid
    RETURNING id::text, tipo, categoria, descricao, valor,
              data::text, status, recorrente, periodicidade, created_at::text
  `;
  return rows.length > 0 ? mapLancamento(rows[0]) : null;
}

export async function deletarLancamentoPessoal(
  id: string,
  userId: string
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM meu_financeiro_lancamentos
    WHERE id = ${id}::uuid AND usuario_id = ${userId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
