import sql from "./db";

export interface Precedente {
  id: string;
  tribunal: string;
  identificacao: string;
  tese: string;
  beneficios: string[];
  status: "vigente" | "superado";
  observacao: string | null;
  verificadoEm: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Precedente {
  return {
    id: r.id,
    tribunal: r.tribunal,
    identificacao: r.identificacao,
    tese: r.tese,
    beneficios: r.beneficios ?? [],
    status: r.status,
    observacao: r.observacao,
    verificadoEm: r.verificado_em,
  };
}

/** Todos os precedentes cadastrados (Jurisprudência Viva) — escopo reduzido
 * a LOAS/BPC (B87/B88) e salário-maternidade (B80), ver seed-jurisprudencia-viva.ts. */
export async function listarPrecedentes(): Promise<Precedente[]> {
  const rows = await sql`
    SELECT id::text, tribunal, identificacao, tese, beneficios, status,
           observacao, verificado_em::text
    FROM precedentes
    ORDER BY tribunal, identificacao
  `;
  return rows.map(mapRow);
}

/** Precedentes relevantes pro código de benefício (ex.: "B87") — [] se não
 * há nenhum cadastrado pra esse código ainda (Jurisprudência Viva ainda é
 * parcial, não é "a lei não prevê isso"). */
export async function getPrecedentesParaBeneficio(
  codigoBeneficio: string | null
): Promise<Precedente[]> {
  if (!codigoBeneficio) return [];
  const rows = await sql`
    SELECT id::text, tribunal, identificacao, tese, beneficios, status,
           observacao, verificado_em::text
    FROM precedentes
    WHERE ${codigoBeneficio} = ANY(beneficios)
    ORDER BY tribunal, identificacao
  `;
  return rows.map(mapRow);
}

export function formatarPrecedentesParaPrompt(
  precedentes: Precedente[]
): string {
  if (precedentes.length === 0) return "";
  const linhas = precedentes.map((p) => {
    const statusNota =
      p.status === "superado"
        ? " [TESE SUPERADA — não usar como favorável]"
        : "";
    return `• ${p.tribunal} — ${p.identificacao}${statusNota}: ${p.tese}${p.observacao ? ` (${p.observacao})` : ""}`;
  });
  return `=== JURISPRUDÊNCIA VERIFICADA (VIGENTE) — cite SOMENTE estes precedentes com número exato; se precisar de outro, descreva a regra em texto corrido sem apontar número/tribunal ===\n${linhas.join("\n")}`;
}
