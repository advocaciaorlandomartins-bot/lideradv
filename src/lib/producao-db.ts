import sql from "./db";
import type {
  ProcessoProducao,
  EstagioProducao,
  ResultadoAdmin,
  ResultadoJudicial,
} from "./producao-types";

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
      COUNT(t.id) FILTER (WHERE t.status IN ('Pendente', 'Em andamento'))::int AS tarefas_pendentes
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN tarefas_processo t ON t.processo_id = p.id AND t.status != 'Cancelada'
    GROUP BY p.id, c.name
    ORDER BY p.data_estagio_at ASC
  `;
  return rows.map(mapRow);
}
