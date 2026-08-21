import sql from "./db";
import { getProximaAcaoProcesso } from "./processo-fases";

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

/**
 * Ação pendente derivada do próprio estado do processo (estágio + resultados),
 * sem depender de alguém ter criado uma tarefa/controle manual — ex.: "dar
 * entrada no requerimento administrativo" aparece assim que o processo entra
 * em produção/administrativo sem protocolo, mesmo sem data agendada.
 */
export interface MinhaAcaoProcesso {
  id: string;
  titulo: string;
  urgente: boolean;
  aguardando: boolean;
  processo_id: string;
  processo_numero: string | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  estagio_producao: string | null;
  source: "processo";
}

export type MinhaItem = MinhaControle | MinhaTarefa | MinhaAcaoProcesso;

/**
 * tarefas_processo.responsavel é texto livre (sem FK) preenchido a partir do
 * nome em colaboradores — que pode divergir do usuarios.nome da sessão.
 * Resolve as variantes de nome (sessão + colaborador vinculado) para casar
 * com qualquer uma delas, em vez de depender só de usuarios.nome, e devolve
 * também o colaborador_id vinculado (usado para achar os processos dele).
 */
async function nomesResponsavel(
  login: string,
  nomeSessao: string
): Promise<{ nomes: string[]; colaboradorId: string | null }> {
  const rows = await sql`
    SELECT c.id::text AS colaborador_id, c.nome AS colaborador_nome
    FROM usuarios u
    LEFT JOIN colaboradores c ON c.id = u.colaborador_id
    WHERE u.login = ${login}
    LIMIT 1
  `;
  const nomes = new Set<string>([nomeSessao]);
  const colaboradorNome = rows[0]?.colaborador_nome;
  if (colaboradorNome) nomes.add(String(colaboradorNome));
  return {
    nomes: Array.from(nomes),
    colaboradorId: rows[0]?.colaborador_id
      ? String(rows[0].colaborador_id)
      : null,
  };
}

export async function getMinhasTarefas(
  login: string,
  nome: string
): Promise<{
  pendentes: MinhaItem[];
  emAndamento: MinhaItem[];
  concluidas: MinhaItem[];
}> {
  const { nomes, colaboradorId } = await nomesResponsavel(login, nome);
  const [controlesRows, tarefasRows, processosRows] = await Promise.all([
    sql`
      SELECT
        c.id::text, c.tipo, c.descricao, c.data_evento::text,
        c.status::text,
        cl.id::text AS cliente_id, cl.name AS cliente_nome,
        p.id::text AS processo_id, p.numero AS processo_numero,
        p.estagio_producao
      FROM controles c
      LEFT JOIN usuarios u ON u.id = c.responsavel_id
      LEFT JOIN clients cl ON cl.id = c.cliente_id
      LEFT JOIN processos p ON p.id = c.processo_id
      WHERE (u.login = ${login} OR c.responsavel_id IS NULL)
        AND (c.status IS NULL OR c.status IN ('pendente', 'em_andamento', 'concluido'))
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
      WHERE t.responsavel = ANY(${nomes})
        AND t.status != 'Cancelada'
      ORDER BY
        CASE t.prioridade WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
        t.prazo ASC NULLS LAST
    `,
    colaboradorId
      ? sql`
          SELECT
            p.id::text AS processo_id, p.numero AS processo_numero,
            p.estagio_producao, p.resultado_administrativo,
            p.resultado_judicial, p.protocolo_inss,
            to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
            to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao,
            cl.id::text AS cliente_id, cl.name AS cliente_nome
          FROM processos p
          LEFT JOIN clients cl ON cl.id = p.client_id
          WHERE p.responsavel_id = ${colaboradorId}::uuid
            AND p.deleted_at IS NULL
            AND p.status IN ('ativo', 'em_andamento')
        `
      : Promise.resolve([]),
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

  const acoesProcesso: MinhaAcaoProcesso[] = processosRows
    .map((r) => {
      const acao = getProximaAcaoProcesso({
        estagio_producao: r.estagio_producao
          ? String(r.estagio_producao)
          : null,
        resultado_administrativo: r.resultado_administrativo
          ? String(r.resultado_administrativo)
          : null,
        resultado_judicial: r.resultado_judicial
          ? String(r.resultado_judicial)
          : null,
        protocolo_inss: r.protocolo_inss ? String(r.protocolo_inss) : null,
        data_protocolo_inss: r.data_protocolo_inss
          ? String(r.data_protocolo_inss)
          : null,
        data_distribuicao: r.data_distribuicao
          ? String(r.data_distribuicao)
          : null,
      });
      if (!acao) return null;
      return {
        id: `acao-${r.processo_id}`,
        titulo: acao.label,
        urgente: acao.urgente,
        aguardando: acao.aguardando,
        processo_id: String(r.processo_id),
        processo_numero: r.processo_numero ? String(r.processo_numero) : null,
        cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
        cliente_id: r.cliente_id ? String(r.cliente_id) : null,
        estagio_producao: r.estagio_producao
          ? String(r.estagio_producao)
          : null,
        source: "processo" as const,
      };
    })
    .filter((a): a is MinhaAcaoProcesso => a !== null)
    .sort((a, b) => Number(b.urgente) - Number(a.urgente));

  // Ações que exigem que o colaborador faça algo agora (dar entrada, preparar
  // petição etc.) ficam em Pendente. Ações "aguardando" significam que o caso
  // já está andando, só esperando um terceiro (INSS, justiça) — ficam em Em
  // Andamento, para não parecer que ninguém fez nada.
  const acoesPendentes = acoesProcesso.filter((a) => !a.aguardando);
  const acoesAcompanhamento = acoesProcesso.filter((a) => a.aguardando);

  const all: MinhaItem[] = [...controles, ...tarefas];

  return {
    pendentes: [
      ...acoesPendentes,
      ...all.filter((i) =>
        i.source === "controle"
          ? (i as MinhaControle).status === "pendente"
          : (i as MinhaTarefa).status === "Pendente"
      ),
    ],
    emAndamento: [
      ...acoesAcompanhamento,
      ...all.filter((i) =>
        i.source === "controle"
          ? (i as MinhaControle).status === "em_andamento"
          : (i as MinhaTarefa).status === "Em andamento"
      ),
    ],
    concluidas: all.filter((i) =>
      i.source === "controle"
        ? (i as MinhaControle).status === "concluido"
        : (i as MinhaTarefa).status === "Concluída"
    ),
  };
}

export async function countMinhasPendentes(
  login: string,
  nome: string
): Promise<number> {
  const { pendentes } = await getMinhasTarefas(login, nome);
  return pendentes.length;
}
