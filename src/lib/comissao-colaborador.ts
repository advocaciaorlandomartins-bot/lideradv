import sql from "./db";

export interface ComissaoConfig {
  comissao_administrativo_pct: number | null;
  comissao_judicial_pct: number | null;
  comissao_ambos_pct: number | null;
}

/**
 * Resolve o % de comissão do colaborador para um processo, de acordo com o
 * caminho que o caso percorreu:
 * - Administrativo DEFERIDO (concedido) → só a parte administrativa.
 * - Administrativo INDEFERIDO (negado) → o caso necessariamente segue para o
 *   judicial, então já conta como "ambos" a partir daí, mesmo antes do
 *   resultado judicial sair (o colaborador já vai atuar nas duas fases).
 * - Sem resultado administrativo registrado, mas já no judicial (ação que foi
 *   direto à via judicial, sem passar pelo administrativo) → só judicial.
 * - Ainda sem nenhum resultado e ainda na fase administrativa (em andamento)
 *   → estimativa pela fase administrativa, atualizada automaticamente assim
 *   que sair o resultado.
 */
export function resolveComissaoPct(
  config: ComissaoConfig | null,
  estagioProducao: string | null,
  resultadoAdministrativo: unknown,
  resultadoJudicial: unknown
): number | null {
  if (!config) return null;

  if (resultadoAdministrativo === "negado") return config.comissao_ambos_pct;
  if (resultadoAdministrativo === "concedido")
    return config.comissao_administrativo_pct;

  if (resultadoJudicial != null || estagioProducao === "judicial")
    return config.comissao_judicial_pct;

  // Ainda em andamento, sem resultado definido — estimativa pela fase administrativa.
  return config.comissao_administrativo_pct;
}

export function aplicarComissao(valor: number, pct: number | null): number {
  if (pct == null) return valor;
  return Math.round(valor * (pct / 100) * 100) / 100;
}

const TIPO_LABEL_REMUNERACAO: Record<string, string> = {
  concedido: "administrativo",
  negado: "administrativo + judicial",
};

/**
 * Quando um lançamento de honorário do cliente (entrada, vinculado a um
 * processo) é marcado como pago, gera automaticamente a comissão do
 * colaborador responsável — sem precisar que o admin digite o valor na mão.
 * Fica "pendente" até alguém confirmar o pagamento ao colaborador em
 * Remunerações. Se o cliente pagar parcelado, cada parcela paga gera sua
 * própria comissão (mesma cadência).
 *
 * Idempotente: não gera duas vezes para o mesmo lançamento (origem_lancamento_id).
 */
export async function gerarComissaoAutomaticaPorPagamento(
  lancamentoId: string,
  processoId: string | null,
  valorPago: number
): Promise<void> {
  if (!processoId || valorPago <= 0) return;

  try {
    const jaExiste = await sql`
      SELECT 1 FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid
    `;
    if (jaExiste.length > 0) return;

    const rows = await sql`
      SELECT
        p.numero, p.tipo_acao, p.client_id::text,
        p.estagio_producao, p.resultado_administrativo, p.resultado_judicial,
        col.id::text AS colaborador_id, col.nome AS colaborador_nome,
        col.comissao_administrativo_pct, col.comissao_judicial_pct, col.comissao_ambos_pct
      FROM processos p
      JOIN colaboradores col ON col.id = p.responsavel_id
      WHERE p.id = ${processoId}::uuid
    `;
    const r = rows[0];
    if (!r) return;

    const config: ComissaoConfig = {
      comissao_administrativo_pct:
        r.comissao_administrativo_pct != null
          ? Number(r.comissao_administrativo_pct)
          : null,
      comissao_judicial_pct:
        r.comissao_judicial_pct != null
          ? Number(r.comissao_judicial_pct)
          : null,
      comissao_ambos_pct:
        r.comissao_ambos_pct != null ? Number(r.comissao_ambos_pct) : null,
    };
    const pct = resolveComissaoPct(
      config,
      r.estagio_producao,
      r.resultado_administrativo,
      r.resultado_judicial
    );
    if (pct == null) return; // comissão não configurada pra esse colaborador

    const valorComissao = aplicarComissao(valorPago, pct);
    if (valorComissao <= 0) return;

    const faseLabel =
      TIPO_LABEL_REMUNERACAO[String(r.resultado_administrativo)] ??
      (r.estagio_producao === "judicial" ? "judicial" : "administrativo");
    const descricao = `Comissão automática — ${r.tipo_acao ?? "processo"}${r.numero ? ` (${r.numero})` : ""} — ${faseLabel} (${pct}%)`;

    const remRows = await sql`
      INSERT INTO remuneracoes (
        colaborador_id, tipo, valor, competencia, status, descricao,
        processo_id, client_id, origem_lancamento_id
      ) VALUES (
        ${r.colaborador_id}::uuid, 'comissao', ${valorComissao}::numeric,
        CURRENT_DATE, 'pendente', ${descricao},
        ${processoId}::uuid, ${r.client_id}::uuid, ${lancamentoId}::uuid
      )
      RETURNING id::text
    `;
    const remuneracaoId = remRows[0].id as string;

    await sql`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, status, data_vencimento, remuneracao_id)
      VALUES (
        'saida', 'Pessoal', ${`${descricao} — ${r.colaborador_nome}`},
        ${valorComissao}::numeric, 'pendente', CURRENT_DATE, ${remuneracaoId}::uuid
      )
    `;
  } catch (err) {
    console.error(
      `[comissao-colaborador] falha ao gerar comissão automática para lançamento ${lancamentoId}:`,
      err
    );
  }
}
