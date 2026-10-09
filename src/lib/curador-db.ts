import sql from "./db";

export interface TeseAprendida {
  id: string;
  titulo: string;
  tese: string;
  area: string;
  tipoAcao: string | null;
  taxaSucesso: number | null;
  vezesAplicada: number;
  vezesVenceu: number;
  ativa: boolean;
  criadoEm: string;
}

/** Teses que o Cérebro "aprendeu" de casos encerrados (aprenderComResultado)
 * — ativas são injetadas de verdade em petições futuras do mesmo tipo de
 * ação (ver obterContextoCerebro). Painel de CURADORIA humana, não
 * aprendizado automático: o volume de casos reais ainda é baixo demais
 * (6 em 2026-10-08) pra confiar em taxa de sucesso sem revisão — por isso
 * isto é uma tela de revisão/desativação manual, não um ranking automático
 * que decide por conta própria o que é "bom". */
export async function listarTeses(): Promise<TeseAprendida[]> {
  const rows = await sql`
    SELECT id::text, titulo, tese, area, tipo_acao, taxa_sucesso,
           vezes_aplicada, vezes_venceu, ativa, created_at::text
    FROM cerebro_teses
    ORDER BY ativa DESC, created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    tese: r.tese,
    area: r.area,
    tipoAcao: r.tipo_acao,
    taxaSucesso: r.taxa_sucesso === null ? null : Number(r.taxa_sucesso),
    vezesAplicada: Number(r.vezes_aplicada),
    vezesVenceu: Number(r.vezes_venceu),
    ativa: r.ativa,
    criadoEm: r.created_at,
  }));
}

export interface CasoAprendido {
  id: string;
  processoId: string | null;
  tipoAcao: string | null;
  resultadoFinal: string | null;
  licao: string | null;
  argumentosVencedores: string[];
  errosCometidos: string[];
  motivoIndeferimento: string | null;
  criadoEm: string;
}

/** Casos encerrados dos quais o Cérebro já extraiu lição — mesma ideia de
 * curadoria: visível pro humano conferir, não oculto numa tabela que só
 * ele mesmo nunca olha. */
export async function listarCasosAprendidos(): Promise<CasoAprendido[]> {
  const rows = await sql`
    SELECT id::text, processo_id::text, tipo_acao, resultado_final, licao,
           argumentos_vencedores, erros_cometidos, motivo_indeferimento,
           created_at::text
    FROM cerebro_juridico
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processoId: r.processo_id,
    tipoAcao: r.tipo_acao,
    resultadoFinal: r.resultado_final,
    licao: r.licao,
    argumentosVencedores: Array.isArray(r.argumentos_vencedores)
      ? r.argumentos_vencedores
      : [],
    errosCometidos: Array.isArray(r.erros_cometidos) ? r.erros_cometidos : [],
    motivoIndeferimento: r.motivo_indeferimento,
    criadoEm: r.created_at,
  }));
}

export async function definirTeseAtiva(
  teseId: string,
  ativa: boolean
): Promise<void> {
  await sql`UPDATE cerebro_teses SET ativa = ${ativa} WHERE id = ${teseId}::uuid`;
}
