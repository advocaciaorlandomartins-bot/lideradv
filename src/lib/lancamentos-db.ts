import sql from "./db";

export interface Lancamento {
  id: string;
  tipo: "entrada" | "saida";
  categoria: string | null;
  descricao: string;
  valor: number;
  client_id: string | null;
  client_name: string | null;
  processo_id: string | null;
  processo_tipo: string | null;
  remuneracao_id: string | null;
  status: "pendente" | "pago" | "cancelado";
  data_vencimento: string;
  data_pagamento: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
  grupo_parcelas: string | null;
  observacoes: string | null;
  created_at_formatted: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Lancamento {
  return {
    id: r.id,
    tipo: r.tipo as "entrada" | "saida",
    categoria: r.categoria ?? null,
    descricao: r.descricao,
    valor: Number(r.valor),
    client_id: r.client_id ?? null,
    client_name: r.client_name ?? null,
    processo_id: r.processo_id ?? null,
    processo_tipo: r.processo_tipo ?? null,
    remuneracao_id: r.remuneracao_id ?? null,
    status: r.status as "pendente" | "pago" | "cancelado",
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento ?? null,
    parcela_atual: r.parcela_atual ?? null,
    total_parcelas: r.total_parcelas ?? null,
    grupo_parcelas: r.grupo_parcelas ?? null,
    observacoes: r.observacoes ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  };
}

export async function getLancamentoById(
  id: string
): Promise<Lancamento | null> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.categoria,
      l.descricao,
      l.valor,
      l.client_id::text,
      c.name  AS client_name,
      l.processo_id::text,
      p.tipo_acao AS processo_tipo,
      l.remuneracao_id::text,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
      l.parcela_atual,
      l.total_parcelas,
      l.grupo_parcelas::text,
      l.observacoes,
      l.created_at
    FROM lancamentos l
    LEFT JOIN clients   c ON c.id = l.client_id
    LEFT JOIN processos p ON p.id = l.processo_id
    WHERE l.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function getAllLancamentos(): Promise<Lancamento[]> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.categoria,
      l.descricao,
      l.valor,
      l.client_id::text,
      c.name  AS client_name,
      l.processo_id::text,
      p.tipo_acao AS processo_tipo,
      l.remuneracao_id::text,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
      l.parcela_atual,
      l.total_parcelas,
      l.grupo_parcelas::text,
      l.observacoes,
      l.created_at
    FROM lancamentos l
    LEFT JOIN clients   c ON c.id = l.client_id
    LEFT JOIN processos p ON p.id = l.processo_id
    ORDER BY l.data_vencimento ASC, l.created_at DESC
    LIMIT 1000
  `;
  return rows.map(mapRow);
}

export interface LancamentoKpis {
  aReceber: number;
  recebido: number;
  aPagar: number;
  pago: number;
  folhaPendente: number;
  folhaPaga: number;
}

export async function getLancamentoKpis(): Promise<LancamentoKpis> {
  const rows = await sql`
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pendente'), 0)                              AS a_receber,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'),     0)                              AS recebido,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pendente'), 0)                              AS a_pagar,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pago'),     0)                              AS pago,
      COALESCE(SUM(valor) FILTER (WHERE remuneracao_id IS NOT NULL AND status = 'pendente'), 0)                    AS folha_pendente,
      COALESCE(SUM(valor) FILTER (WHERE remuneracao_id IS NOT NULL AND status = 'pago'),     0)                    AS folha_paga
    FROM lancamentos
    WHERE status != 'cancelado'
  `;
  const r = rows[0];
  return {
    aReceber: Number(r.a_receber),
    recebido: Number(r.recebido),
    aPagar: Number(r.a_pagar),
    pago: Number(r.pago),
    folhaPendente: Number(r.folha_pendente),
    folhaPaga: Number(r.folha_paga),
  };
}

export interface ClientSaidaItem {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  categoria: string | null;
  valor: number;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
}

export interface ClientDebito {
  totalPendente: number;
  totalPago: number;
  items: ClientSaidaItem[];
}

export async function getClientDebito(clientId: string): Promise<ClientDebito> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.descricao,
      l.categoria,
      l.valor,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento
    FROM lancamentos l
    WHERE l.client_id = ${clientId}::uuid
      AND l.status != 'cancelado'
    ORDER BY l.data_vencimento ASC NULLS LAST, l.created_at DESC
  `;

  let totalPendente = 0;
  let totalPago = 0;
  const items: ClientSaidaItem[] = rows.map((r) => {
    const val = Number(r.valor);
    if (r.status === "pago") totalPago += val;
    else totalPendente += val;
    return {
      id: r.id,
      tipo: r.tipo as "entrada" | "saida",
      descricao: r.descricao,
      categoria: r.categoria ?? null,
      valor: val,
      status: r.status,
      data_vencimento: r.data_vencimento ?? null,
      data_pagamento: r.data_pagamento ?? null,
    };
  });

  return { totalPendente, totalPago, items };
}

export interface ContaClienteItem {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  categoria: string | null;
  valor: number;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  processo_id: string | null;
}

export interface ContaCliente {
  client_id: string;
  client_name: string;
  client_doc: string;
  totalPendente: number;
  totalPago: number;
  items: ContaClienteItem[];
}

export async function getContasAReceber(): Promise<ContaCliente[]> {
  const rows = await sql`
    SELECT
      c.id::text      AS client_id,
      c.name          AS client_name,
      c.doc           AS client_doc,
      l.id::text,
      l.tipo,
      l.descricao,
      l.categoria,
      l.valor,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY')  AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY')  AS data_pagamento,
      l.processo_id::text
    FROM lancamentos l
    JOIN clients c ON c.id = l.client_id
    WHERE l.client_id IS NOT NULL
      AND l.status != 'cancelado'
    ORDER BY c.name, l.data_vencimento ASC NULLS LAST, l.created_at DESC
  `;

  const map = new Map<string, ContaCliente>();
  for (const r of rows) {
    if (!map.has(r.client_id)) {
      map.set(r.client_id, {
        client_id: r.client_id,
        client_name: r.client_name,
        client_doc: r.client_doc,
        totalPendente: 0,
        totalPago: 0,
        items: [],
      });
    }
    const conta = map.get(r.client_id)!;
    const valor = Number(r.valor);
    if (r.status === "pago") conta.totalPago += valor;
    else conta.totalPendente += valor;
    conta.items.push({
      id: r.id,
      tipo: r.tipo as "entrada" | "saida",
      descricao: r.descricao,
      categoria: r.categoria ?? null,
      valor,
      status: r.status,
      data_vencimento: r.data_vencimento ?? null,
      data_pagamento: r.data_pagamento ?? null,
      processo_id: r.processo_id ?? null,
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => b.totalPendente - a.totalPendente
  );
}
