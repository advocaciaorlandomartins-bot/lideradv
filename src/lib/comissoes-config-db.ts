import sql from "./db";

export interface ComissaoConfig {
  id: string;
  nome: string;
  tipo_origem: string | null;
  cargo_colaborador: string | null;
  tipo_trabalho: string | null;
  comissao_tipo: "percentual" | "valor";
  comissao_valor: number;
  bonificacao_tipo: string | null;
  bonificacao_valor: number | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ComissaoConfig {
  return {
    id: r.id,
    nome: r.nome,
    tipo_origem: r.tipo_origem ?? null,
    cargo_colaborador: r.cargo_colaborador ?? null,
    tipo_trabalho: r.tipo_trabalho ?? null,
    comissao_tipo: r.comissao_tipo as "percentual" | "valor",
    comissao_valor: Number(r.comissao_valor),
    bonificacao_tipo: r.bonificacao_tipo ?? null,
    bonificacao_valor:
      r.bonificacao_valor != null ? Number(r.bonificacao_valor) : null,
    ativo: r.ativo,
    observacoes: r.observacoes ?? null,
    created_at: new Date(r.created_at).toLocaleDateString("pt-BR"),
    updated_at: new Date(r.updated_at).toLocaleDateString("pt-BR"),
  };
}

export async function getAllComissoesConfig(): Promise<ComissaoConfig[]> {
  const rows = await sql`
    SELECT id::text, nome, tipo_origem, cargo_colaborador, tipo_trabalho,
           comissao_tipo, comissao_valor, bonificacao_tipo, bonificacao_valor,
           ativo, observacoes, created_at, updated_at
    FROM comissoes_config
    ORDER BY ativo DESC, nome ASC
  `;
  return rows.map(mapRow);
}

export async function getComissaoConfigById(
  id: string
): Promise<ComissaoConfig | null> {
  const rows = await sql`
    SELECT id::text, nome, tipo_origem, cargo_colaborador, tipo_trabalho,
           comissao_tipo, comissao_valor, bonificacao_tipo, bonificacao_valor,
           ativo, observacoes, created_at, updated_at
    FROM comissoes_config
    WHERE id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function getComissoesConfigAtivos(): Promise<ComissaoConfig[]> {
  const rows = await sql`
    SELECT id::text, nome, tipo_origem, cargo_colaborador, tipo_trabalho,
           comissao_tipo, comissao_valor, bonificacao_tipo, bonificacao_valor,
           ativo, observacoes, created_at, updated_at
    FROM comissoes_config
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `;
  return rows.map(mapRow);
}
