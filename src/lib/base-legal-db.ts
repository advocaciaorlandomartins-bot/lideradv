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

// Benefício (código extraído de tipo_acao/tipo_beneficio, ver
// checklist-documentos.ts:codigoDoTipo) → normas relevantes na Base Legal
// Viva. Período de graça/carência (Lei 8.213) vale pra quase todo
// benefício contributivo, por isso entra em todos os códigos abaixo exceto
// BPC (que é assistencial, não depende de carência/qualidade de segurado).
const NORMAS_POR_BENEFICIO: Record<string, string[]> = {
  B80: ["Lei 8.213/1991"], // salário-maternidade (art. 71-73) — NÃO é BPC, não depende da LOAS
  B87: ["Lei 8.742/1993", "Lei 13.146/2015", "Lei 12.764/2012"], // B87 é deficiência — art. 20-B da LOAS cita o art. 2º do Estatuto; Lei 12.764 equipara TEA a pessoa com deficiência (art. 1º, §2º) pra casos de autismo
  B88: ["Lei 8.742/1993"],
  B21: ["Lei 8.213/1991", "EC 103/2019"], // pensão por morte (EC 103 mudou o cálculo e a acumulação)
  B31: ["Lei 8.213/1991"], // auxílio-doença / incapacidade temporária
  B32: ["Lei 8.213/1991"], // aposentadoria por invalidez / incapacidade permanente
  B41: ["Lei 8.213/1991", "EC 103/2019"], // aposentadoria por idade
  B42: ["Lei 8.213/1991", "EC 103/2019"], // aposentadoria por tempo de contribuição — regras de transição
  B46: ["Lei 8.213/1991", "EC 103/2019"], // aposentadoria especial
  B91: ["Lei 8.213/1991"], // acidentário
  B92: ["Lei 8.213/1991"],
  B94: ["Lei 8.213/1991"], // auxílio-acidente (art. 86 — ainda não seedado; citação cai em "não coberta")
};

/** Dispositivos da Base Legal Viva relevantes pro código de benefício
 * detectado (ex.: "B87"). Retorna [] se o código não tem norma mapeada
 * ainda ou se não há dispositivos cadastrados — quem chamar deve tratar
 * isso como "sem grounding disponível", nunca como lacuna da lei em si. */
export async function getBaseLegalParaBeneficio(
  codigoBeneficio: string | null
): Promise<Dispositivo[]> {
  if (!codigoBeneficio) return [];
  const normas = NORMAS_POR_BENEFICIO[codigoBeneficio];
  if (!normas) return [];
  const listas = await Promise.all(
    normas.map((n) => listarDispositivosPorNorma(n))
  );
  return listas.flat();
}

/** Formata uma lista de dispositivos pro bloco "BASE LEGAL APLICÁVEL
 * (VERIFICADA)" que entra no prompt — mesmo formato usado em Gerar Petição
 * e no Cérebro Jurídico, centralizado aqui pra não divergir entre os dois. */
export function formatarDispositivosParaPrompt(
  dispositivos: Dispositivo[]
): string {
  if (dispositivos.length === 0) return "";
  const porNorma = new Map<string, Dispositivo[]>();
  for (const d of dispositivos) {
    if (!porNorma.has(d.norma)) porNorma.set(d.norma, []);
    porNorma.get(d.norma)!.push(d);
  }
  const blocos = [...porNorma.entries()].map(([norma, disps]) => {
    const linhas = disps
      .map(
        (d) =>
          `${d.caminho}${d.revogado ? " [REVOGADO]" : ""}: "${d.texto}"${
            d.redacaoDadaPor ? ` (${d.redacaoDadaPor})` : ""
          }`
      )
      .join("\n");
    return `--- ${norma} ---\n${linhas}`;
  });
  return `=== BASE LEGAL APLICÁVEL (VERIFICADA — coletada de planalto.gov.br) ===\n${blocos.join(
    "\n\n"
  )}\n\nEsses são os dispositivos EXATOS. Cite SOMENTE estes números de artigo/parágrafo das normas listadas acima — não cite nenhum outro parágrafo delas além dos listados.`;
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
