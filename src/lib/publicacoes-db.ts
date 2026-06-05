import sql from "./db";

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
  conteudo: string | null;
  created_at: string;
}

export async function getAllPublicacoes(): Promise<Publicacao[]> {
  const rows = await sql`
    SELECT
      id,
      processo,
      tipo,
      destinatario,
      advogados,
      orgao,
      tribunal,
      TO_CHAR(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao,
      status,
      conteudo,
      created_at::text
    FROM publicacoes
    ORDER BY disponibilizacao DESC, id DESC
  `;

  return rows.map((r) => ({
    id: Number(r.id),
    processo: String(r.processo),
    tipo: String(r.tipo),
    destinatario: String(r.destinatario),
    advogados: (r.advogados as string[]) ?? [],
    orgao: String(r.orgao),
    tribunal: String(r.tribunal),
    disponibilizacao: String(r.disponibilizacao),
    status: String(r.status) as "nao_lida" | "tratada",
    conteudo: r.conteudo ? String(r.conteudo) : null,
    created_at: String(r.created_at),
  }));
}
