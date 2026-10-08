import sql from "./db";

export interface Dispositivo {
  id: string;
  norma: string;
  apelido: string | null;
  caminho: string;
  texto: string;
  redacaoDadaPor: string | null;
  vigenteDe: string | null;
  vigenteAte: string | null;
  revogado: boolean;
  observacao: string | null;
  urlOficial: string;
  verificadoEm: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Dispositivo {
  return {
    id: r.id,
    norma: r.norma,
    apelido: r.apelido,
    caminho: r.caminho,
    texto: r.texto,
    redacaoDadaPor: r.redacao_dada_por,
    vigenteDe: r.vigente_de,
    vigenteAte: r.vigente_ate,
    revogado: r.revogado,
    observacao: r.observacao,
    urlOficial: r.url_oficial,
    verificadoEm: r.verificado_em,
  };
}

/** Todos os dispositivos cadastrados de uma norma (ex.: "Lei 8.742/1993"),
 * ordenados pelo caminho (art./§). Usado pra montar a "Base Legal Viva" que
 * vai no prompt — nunca a memória do modelo. */
export async function listarDispositivosPorNorma(
  norma: string
): Promise<Dispositivo[]> {
  const rows = await sql`
    SELECT d.id::text, f.norma, f.apelido, d.caminho, d.texto,
           d.redacao_dada_por, d.vigente_de::text, d.vigente_ate::text,
           d.revogado, d.observacao, f.url_oficial, d.verificado_em::text
    FROM dispositivos d
    JOIN fontes_legais f ON f.id = d.fonte_id
    WHERE f.norma = ${norma}
    ORDER BY d.caminho
  `;
  return rows.map(mapRow);
}

/** Um dispositivo específico (ex.: norma="Lei 8.742/1993", caminho="art. 20, § 2º").
 * Retorna null se não estiver cadastrado — nesse caso quem chamar deve tratar
 * como [LACUNA], nunca completar com a memória do modelo. */
export async function getDispositivo(
  norma: string,
  caminho: string
): Promise<Dispositivo | null> {
  const rows = await sql`
    SELECT d.id::text, f.norma, f.apelido, d.caminho, d.texto,
           d.redacao_dada_por, d.vigente_de::text, d.vigente_ate::text,
           d.revogado, d.observacao, f.url_oficial, d.verificado_em::text
    FROM dispositivos d
    JOIN fontes_legais f ON f.id = d.fonte_id
    WHERE f.norma = ${norma} AND d.caminho = ${caminho}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Lista as normas já cadastradas na Base Legal Viva (pra UI/diagnóstico). */
export async function listarNormasCadastradas(): Promise<
  { norma: string; apelido: string | null; totalDispositivos: number }[]
> {
  const rows = await sql`
    SELECT f.norma, f.apelido, count(d.id)::int AS total_dispositivos
    FROM fontes_legais f
    LEFT JOIN dispositivos d ON d.fonte_id = f.id
    WHERE f.status = 'ativa'
    GROUP BY f.norma, f.apelido
    ORDER BY f.norma
  `;
  return rows.map((r) => ({
    norma: r.norma,
    apelido: r.apelido,
    totalDispositivos: r.total_dispositivos,
  }));
}
