import sql from "./db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResumoIa {
  texto: string;
  prazo_dias: number | null;
  acao_necessaria: string | null;
  audiencia: string | null; // DD/MM/YYYY ou null
}

export interface Publicacao {
  id: number;
  processo: string;
  tipo: string;
  destinatario: string;
  advogados: string[];
  orgao: string;
  tribunal: string;
  disponibilizacao: string; // DD/MM/YYYY
  status: "nao_lida" | "tratada";
  origem: "automatica" | "manual";
  conteudo: string | null;
  conteudo_completo: string | null;
  resumo_ia: ResumoIa | null;
  created_at: string;
}

export interface OabMonitorada {
  id: string;
  numero: string;
  estado: string;
  nome_advogado: string | null;
  ativa: boolean;
  ultima_busca: string | null;
  created_at: string;
}

// ── Publicações ───────────────────────────────────────────────────────────────

export async function getAllPublicacoes(): Promise<Publicacao[]> {
  const rows = await sql`
    SELECT
      id, processo, tipo, destinatario, advogados, orgao, tribunal,
      TO_CHAR(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao,
      status, origem, conteudo, conteudo_completo, resumo_ia, created_at::text
    FROM publicacoes
    ORDER BY disponibilizacao DESC, id DESC
  `;
  return rows.map(mapPublicacao);
}

export async function getPublicacaoById(
  id: number
): Promise<Publicacao | null> {
  const rows = await sql`
    SELECT
      id, processo, tipo, destinatario, advogados, orgao, tribunal,
      TO_CHAR(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao,
      status, origem, conteudo, conteudo_completo, resumo_ia, created_at::text
    FROM publicacoes
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapPublicacao(rows[0]) : null;
}

export async function searchPublicacoes(q: string): Promise<Publicacao[]> {
  const term = `%${q}%`;
  const rows = await sql`
    SELECT
      id, processo, tipo, destinatario, advogados, orgao, tribunal,
      TO_CHAR(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao,
      status, origem, conteudo, conteudo_completo, resumo_ia, created_at::text
    FROM publicacoes
    WHERE
      processo ILIKE ${term}
      OR destinatario ILIKE ${term}
      OR EXISTS (
        SELECT 1 FROM unnest(advogados) a WHERE a ILIKE ${term}
      )
      OR orgao ILIKE ${term}
    ORDER BY disponibilizacao DESC, id DESC
    LIMIT 50
  `;
  return rows.map(mapPublicacao);
}

function mapPublicacao(r: Record<string, unknown>): Publicacao {
  return {
    id: Number(r.id),
    processo: String(r.processo),
    tipo: String(r.tipo),
    destinatario: String(r.destinatario),
    advogados: (r.advogados as string[]) ?? [],
    orgao: String(r.orgao),
    tribunal: String(r.tribunal),
    disponibilizacao: String(r.disponibilizacao),
    status: String(r.status) as "nao_lida" | "tratada",
    origem: (String(r.origem) as "automatica" | "manual") ?? "automatica",
    conteudo: r.conteudo ? String(r.conteudo) : null,
    conteudo_completo: r.conteudo_completo ? String(r.conteudo_completo) : null,
    resumo_ia: r.resumo_ia ? (r.resumo_ia as ResumoIa) : null,
    created_at: String(r.created_at),
  };
}

// ── OABs monitoradas ──────────────────────────────────────────────────────────

export async function getAllOabs(): Promise<OabMonitorada[]> {
  const rows = await sql`
    SELECT id::text, numero, estado, nome_advogado, ativa,
           ultima_busca::text, created_at::text
    FROM oabs_monitoradas
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    numero: String(r.numero),
    estado: String(r.estado),
    nome_advogado: r.nome_advogado ? String(r.nome_advogado) : null,
    ativa: Boolean(r.ativa),
    ultima_busca: r.ultima_busca ? String(r.ultima_busca) : null,
    created_at: String(r.created_at),
  }));
}
