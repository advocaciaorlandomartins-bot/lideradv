import sql from "./db";
import type {
  ProcessoProducao,
  EstagioProducao,
  ResultadoAdmin,
  ResultadoJudicial,
} from "./producao-types";

export interface EstagioSnapshot {
  porEstagio: { estagio: EstagioProducao; count: number }[];
  comAdministrativo: number;
  comJudicial: number;
  comAmbos: number;
}

/**
 * Contagem de processos ativos (estagio_producao != 'arquivado') por estágio,
 * e quantos já têm resultado administrativo/judicial/ambos registrado —
 * usado tanto em "Meu Financeiro" (colaboradorId do usuário logado) quanto
 * no perfil do colaborador (admin vendo qualquer colaborador).
 * colaboradorId = null mostra o escritório inteiro (ex: admin sem vínculo).
 */
export async function getEstagioSnapshotByResponsavel(
  colaboradorId: string | null
): Promise<EstagioSnapshot> {
  const rows = colaboradorId
    ? await sql`
        SELECT estagio_producao, resultado_administrativo, resultado_judicial
        FROM processos
        WHERE responsavel_id = ${colaboradorId}::uuid
          AND deleted_at IS NULL
          AND estagio_producao != 'arquivado'
      `
    : await sql`
        SELECT estagio_producao, resultado_administrativo, resultado_judicial
        FROM processos
        WHERE deleted_at IS NULL
          AND estagio_producao != 'arquivado'
      `;

  const porEstagioMap = new Map<string, number>();
  let comAdministrativo = 0;
  let comJudicial = 0;
  let comAmbos = 0;
  for (const r of rows) {
    const estagio = (r.estagio_producao as string) ?? "analise";
    porEstagioMap.set(estagio, (porEstagioMap.get(estagio) ?? 0) + 1);
    const temAdmin = r.resultado_administrativo != null;
    const temJudicial = r.resultado_judicial != null;
    if (temAdmin) comAdministrativo++;
    if (temJudicial) comJudicial++;
    if (temAdmin && temJudicial) comAmbos++;
  }

  return {
    porEstagio: Array.from(porEstagioMap.entries()).map(([estagio, count]) => ({
      estagio: estagio as EstagioProducao,
      count,
    })),
    comAdministrativo,
    comJudicial,
    comAmbos,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ProcessoProducao {
  const dataEstagio = new Date(r.data_estagio_at);
  const dias = Math.max(
    0,
    Math.floor((Date.now() - dataEstagio.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    id: r.id,
    client_id: r.client_id,
    client_name: r.client_name,
    numero: r.numero ?? null,
    tipo_acao: r.tipo_acao,
    area: r.area,
    estagio_producao: r.estagio_producao as EstagioProducao,
    resultado_administrativo: (r.resultado_administrativo ??
      null) as ResultadoAdmin | null,
    resultado_judicial: (r.resultado_judicial ??
      null) as ResultadoJudicial | null,
    dias_no_estagio: dias,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    tarefas_pendentes: Number(r.tarefas_pendentes ?? 0),
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    protocolo_inss: r.protocolo_inss ?? null,
    data_distribuicao_iso: r.data_distribuicao_iso ?? null,
  };
}

export async function getAllProcessosProducao(): Promise<ProcessoProducao[]> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.client_id::text,
      c.name AS client_name,
      p.numero,
      p.tipo_acao,
      p.area,
      p.estagio_producao,
      p.resultado_administrativo,
      p.resultado_judicial,
      p.data_estagio_at,
      p.created_at,
      p.responsavel_id::text,
      resp.nome AS responsavel_nome,
      p.protocolo_inss,
      to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao_iso,
      COUNT(t.id) FILTER (WHERE t.status IN ('Pendente', 'Em andamento'))::int AS tarefas_pendentes
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN colaboradores resp ON resp.id = p.responsavel_id
    LEFT JOIN tarefas_processo t ON t.processo_id = p.id AND t.status != 'Cancelada'
    WHERE p.deleted_at IS NULL
    GROUP BY p.id, c.name, resp.nome
    ORDER BY p.data_estagio_at ASC
  `;
  return rows.map(mapRow);
}
