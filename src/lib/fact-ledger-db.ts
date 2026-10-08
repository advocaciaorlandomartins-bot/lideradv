import sql from "./db";

export interface FatoCaso {
  id: string;
  processoId: string;
  campo: string;
  valor: string;
  documentoId: string | null;
  pagina: number | null;
  trecho: string | null;
  status: "confirmado" | "documental" | "alegado" | "ausente" | "conflitante";
  extraidoPor: string;
  criadoEm: string;
}

/** Registra um fato no Fact Ledger. Não sobrescreve: cada chamada cria uma
 * nova linha (histórico completo), inclusive quando o mesmo campo já tinha
 * um fato anterior — útil pra detectar `conflitante` entre documentos
 * diferentes depois. Página/trecho ainda não são capturados pela extração
 * automática do Dr. Lex (limitação conhecida — ver docs/auditoria-tecnica.md). */
export async function registrarFato(params: {
  processoId: string;
  campo: string;
  valor: string;
  documentoId?: string | null;
  pagina?: number | null;
  trecho?: string | null;
  status?: FatoCaso["status"];
  extraidoPor: string;
}): Promise<void> {
  await sql`
    INSERT INTO fatos_caso
      (processo_id, campo, valor, documento_id, pagina, trecho, status, extraido_por)
    VALUES
      (${params.processoId}::uuid, ${params.campo}, ${params.valor},
       ${params.documentoId ?? null}, ${params.pagina ?? null}, ${params.trecho ?? null},
       ${params.status ?? "documental"}, ${params.extraidoPor})
  `;
}

/** Registra vários fatos de uma vez (ex.: todos os campos não-nulos de uma
 * extração do Dr. Lex). Ignora campos com valor vazio/null/undefined. */
export async function registrarFatosEmLote(
  processoId: string,
  campos: Record<string, unknown>,
  opts: { documentoId?: string | null; extraidoPor: string }
): Promise<number> {
  let gravados = 0;
  for (const [campo, valorBruto] of Object.entries(campos)) {
    if (valorBruto === null || valorBruto === undefined || valorBruto === "")
      continue;
    // objetos/arrays (ex.: cids_encontrados) viram um fato por item quando
    // fizer sentido; por ora grava como JSON legível pra não perder o dado.
    const valor =
      typeof valorBruto === "object"
        ? JSON.stringify(valorBruto)
        : String(valorBruto);
    await registrarFato({
      processoId,
      campo,
      valor,
      documentoId: opts.documentoId,
      extraidoPor: opts.extraidoPor,
    });
    gravados++;
  }
  return gravados;
}

/** Fato mais recente de cada campo (o "estado atual" do ledger), pra exibir
 * ou pra alimentar um prompt — nunca a lista bruta com histórico. */
export async function listarFatosAtuaisPorProcesso(
  processoId: string
): Promise<FatoCaso[]> {
  const rows = await sql`
    SELECT DISTINCT ON (campo) id::text, processo_id::text, campo, valor,
           documento_id::text, pagina, trecho, status, extraido_por,
           criado_em::text
    FROM fatos_caso
    WHERE processo_id = ${processoId}::uuid
    ORDER BY campo, criado_em DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processoId: r.processo_id,
    campo: r.campo,
    valor: r.valor,
    documentoId: r.documento_id,
    pagina: r.pagina,
    trecho: r.trecho,
    status: r.status,
    extraidoPor: r.extraido_por,
    criadoEm: r.criado_em,
  }));
}
