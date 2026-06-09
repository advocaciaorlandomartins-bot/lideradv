import sql from "./db";

export interface MinhaControle {
  id: string;
  tipo: string;
  descricao: string;
  data_evento: string | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  processo_numero: string | null;
  processo_id: string | null;
  estagio_producao: string | null;
  status: "pendente" | "em_andamento" | "concluido";
  source: "controle";
}

export interface MinhaTarefa {
  id: string;
  titulo: string;
  prioridade: string;
  prazo: string | null;
  status: string;
  processo_id: string;
  processo_numero: string | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  estagio_producao: string | null;
  source: "tarefa";
}

export type MinhaItem = MinhaControle | MinhaTarefa;

export async function getMinhasTarefas(login: string): Promise<{
  pendentes: MinhaItem[];
  emAndamento: MinhaItem[];
  concluidas: MinhaItem[];
}> {
  const [controlesRows, tarefasRows] = await Promise.all([
    sql`
      SELECT
        c.id::text, c.tipo, c.descricao, c.data_evento::text,
        c.status::text,
        cl.id::text AS cliente_id, cl.name AS cliente_nome,
        p.id::text AS processo_id, p.numero AS processo_numero,
        p.estagio_producao
      FROM controles c
      JOIN usuarios u ON u.id = c.responsavel_id
      LEFT JOIN clients cl ON cl.id = c.cliente_id
      LEFT JOIN processos p ON p.id = c.processo_id
      WHERE u.login = ${login}
        AND (c.status IS NULL OR c.status IN ('em_andamento', 'concluido'))
      ORDER BY c.data_evento ASC NULLS LAST
    `,
    sql`
      SELECT
        t.id::text, t.titulo, t.prioridade,
        to_char(t.prazo, 'DD/MM/YYYY') AS prazo,
        t.status,
        p.id::text AS processo_id, p.numero AS processo_numero,
        p.estagio_producao,
        cl.id::text AS cliente_id, cl.name AS cliente_nome
      FROM tarefas_processo t
      JOIN processos p ON p.id = t.processo_id
      LEFT JOIN clients cl ON cl.id = p.client_id
      WHERE t.responsavel = ${login}
        AND t.status != 'Cancelada'
      ORDER BY
        CASE t.prioridade WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
        t.prazo ASC NULLS LAST
    `,
  ]);

  const controles: MinhaControle[] = controlesRows.map((r) => ({
    id: String(r.id),
    tipo: String(r.tipo),
    descricao: String(r.descricao),
    data_evento: r.data_evento ? String(r.data_evento).slice(0, 10) : null,
    cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
    cliente_id: r.cliente_id ? String(r.cliente_id) : null,
    processo_numero: r.processo_numero ? String(r.processo_numero) : null,
    processo_id: r.processo_id ? String(r.processo_id) : null,
    estagio_producao: r.estagio_producao ? String(r.estagio_producao) : null,
    status:
      r.status === "concluido"
        ? "concluido"
        : r.status === "em_andamento"
          ? "em_andamento"
          : "pendente",
    source: "controle" as const,
  }));

  const tarefas: MinhaTarefa[] = tarefasRows.map((r) => ({
    id: String(r.id),
    titulo: String(r.titulo),
    prioridade: String(r.prioridade),
    prazo: r.prazo ? String(r.prazo) : null,
    status: String(r.status),
    processo_id: String(r.processo_id),
    processo_numero: r.processo_numero ? String(r.processo_numero) : null,
    cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
    cliente_id: r.cliente_id ? String(r.cliente_id) : null,
    estagio_producao: r.estagio_producao ? String(r.estagio_producao) : null,
    source: "tarefa" as const,
  }));

  const all: MinhaItem[] = [...controles, ...tarefas];

  return {
    pendentes: all.filter((i) =>
      i.source === "controle"
        ? (i as MinhaControle).status === "pendente"
        : (i as MinhaTarefa).status === "Pendente"
    ),
    emAndamento: all.filter((i) =>
      i.source === "controle"
        ? (i as MinhaControle).status === "em_andamento"
        : (i as MinhaTarefa).status === "Em andamento"
    ),
    concluidas: all.filter((i) =>
      i.source === "controle"
        ? (i as MinhaControle).status === "concluido"
        : (i as MinhaTarefa).status === "Concluída"
    ),
  };
}

export async function countMinhasPendentes(login: string): Promise<number> {
  const [c, t] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS n FROM controles c
      JOIN usuarios u ON u.id = c.responsavel_id
      WHERE u.login = ${login} AND c.status IS NULL
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM tarefas_processo
      WHERE responsavel = ${login} AND status = 'Pendente'
    `,
  ]);
  return Number(c[0]?.n ?? 0) + Number(t[0]?.n ?? 0);
}
