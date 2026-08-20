import sql from "./db";

export interface ComissaoConfig {
  comissao_administrativo_pct: number | null;
  comissao_judicial_pct: number | null;
  comissao_ambos_pct: number | null;
}

/**
 * Estado do processo relevante para saber quem fez qual fase e quanto cada
 * um tem direito. responsavel_administrativo_id / responsavel_judicial_id
 * são preenchidos no momento em que o protocolo do INSS e a distribuição
 * judicial são registrados (registrarProtocoloAdminAction /
 * registrarDistribuicaoJudicialAction) — ficam "congelados" ali, então uma
 * reatribuição de responsável depois não muda quem fez cada fase.
 */
export interface ProcessoFaseOwnership {
  estagio_producao: string | null;
  resultado_administrativo: string | null;
  resultado_judicial: string | null;
  responsavel_id: string | null;
  responsavel_administrativo_id: string | null;
  responsavel_judicial_id: string | null;
}

/**
 * Resolve quanto % de comissão UM colaborador específico tem direito num
 * processo — considerando que administrativo e judicial podem ter sido
 * feitos por pessoas diferentes (processo reatribuído no meio do caminho).
 *
 * Regras:
 * - Concedido no administrativo → só quem fez o administrativo (ou o
 *   responsável atual, se a fase nunca foi explicitamente registrada) recebe,
 *   pelo % "só administrativo".
 * - Negado no administrativo:
 *   - Mesma pessoa nas duas fases (ou judicial ainda não tem dono definido) →
 *     ela recebe pelo % "administrativo + judicial" (bônus por fazer as duas).
 *   - Pessoas diferentes em cada fase → cada uma recebe SÓ pelo seu próprio %
 *     individual daquela fase (ninguém recebe o % combinado nesse caso).
 * - Foi direto pro judicial (sem passar por administrativo) → quem fez o
 *   judicial recebe pelo % "só judicial".
 * - Ainda em andamento, sem resultado → estimativa pela fase administrativa.
 */
export function resolveComissaoPctParaColaborador(
  colaboradorId: string,
  config: ComissaoConfig | null,
  p: ProcessoFaseOwnership
): number | null {
  // null aqui = "comissão não configurada" (nenhum % cadastrado pra esse
  // colaborador) — chamador trata como estimativa indefinida. A partir daqui,
  // config existe, então "não é a fase desse colaborador" retorna 0, nunca
  // null — pra não ser confundido com "não configurado" e mostrar o valor
  // cheio do processo como se fosse a comissão dele.
  if (!config) return null;

  const adminId = p.responsavel_administrativo_id ?? p.responsavel_id;
  const judId = p.responsavel_judicial_id ?? p.responsavel_id;

  if (p.resultado_administrativo === "negado") {
    const fasesDivididas =
      p.responsavel_administrativo_id != null &&
      p.responsavel_judicial_id != null &&
      p.responsavel_administrativo_id !== p.responsavel_judicial_id;

    if (fasesDivididas) {
      if (colaboradorId === p.responsavel_administrativo_id)
        return config.comissao_administrativo_pct ?? 0;
      if (colaboradorId === p.responsavel_judicial_id)
        return config.comissao_judicial_pct ?? 0;
      return 0;
    }

    const dono =
      p.responsavel_administrativo_id ??
      p.responsavel_judicial_id ??
      p.responsavel_id;
    return colaboradorId === dono ? (config.comissao_ambos_pct ?? 0) : 0;
  }

  if (p.resultado_administrativo === "concedido") {
    return colaboradorId === adminId
      ? (config.comissao_administrativo_pct ?? 0)
      : 0;
  }

  if (p.resultado_judicial != null || p.estagio_producao === "judicial") {
    return colaboradorId === judId ? (config.comissao_judicial_pct ?? 0) : 0;
  }

  // Ainda em andamento, sem resultado — estimativa pela fase administrativa.
  return colaboradorId === adminId
    ? (config.comissao_administrativo_pct ?? 0)
    : 0;
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
 * processo) é marcado como pago, gera automaticamente a comissão de quem
 * trabalhou o caso — sem precisar que o admin digite o valor na mão. Se
 * administrativo e judicial foram feitos por colaboradores diferentes, gera
 * uma remuneração pra cada um, cada qual pelo seu próprio % de fase. Fica
 * "pendente" até alguém confirmar o pagamento em Remunerações. Se o cliente
 * pagar parcelado, cada parcela paga gera sua própria comissão (mesma
 * cadência).
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
        p.responsavel_id::text,
        p.responsavel_administrativo_id::text, p.responsavel_judicial_id::text
      FROM processos p
      WHERE p.id = ${processoId}::uuid
    `;
    const p = rows[0];
    if (!p) return;

    const ownership: ProcessoFaseOwnership = {
      estagio_producao: p.estagio_producao,
      resultado_administrativo: p.resultado_administrativo,
      resultado_judicial: p.resultado_judicial,
      responsavel_id: p.responsavel_id,
      responsavel_administrativo_id: p.responsavel_administrativo_id,
      responsavel_judicial_id: p.responsavel_judicial_id,
    };

    // Candidatos: responsável atual + donos de cada fase (podem ser até 3 pessoas
    // diferentes, mas normalmente 1 ou 2). Busca a config de comissão de cada um.
    const candidatoIds = Array.from(
      new Set(
        [
          p.responsavel_id,
          p.responsavel_administrativo_id,
          p.responsavel_judicial_id,
        ].filter((v): v is string => v != null)
      )
    );
    if (candidatoIds.length === 0) return;

    const colabRows = await sql`
      SELECT id::text, nome,
             comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct
      FROM colaboradores
      WHERE id = ANY(${candidatoIds}::uuid[])
    `;

    for (const colab of colabRows) {
      const colaboradorId = String(colab.id);
      const config: ComissaoConfig = {
        comissao_administrativo_pct:
          colab.comissao_administrativo_pct != null
            ? Number(colab.comissao_administrativo_pct)
            : null,
        comissao_judicial_pct:
          colab.comissao_judicial_pct != null
            ? Number(colab.comissao_judicial_pct)
            : null,
        comissao_ambos_pct:
          colab.comissao_ambos_pct != null
            ? Number(colab.comissao_ambos_pct)
            : null,
      };
      const pct = resolveComissaoPctParaColaborador(
        colaboradorId,
        config,
        ownership
      );
      if (pct == null) continue;

      const valorComissao = aplicarComissao(valorPago, pct);
      if (valorComissao <= 0) continue;

      const faseLabel =
        TIPO_LABEL_REMUNERACAO[String(p.resultado_administrativo)] ??
        (p.estagio_producao === "judicial" ? "judicial" : "administrativo");
      const descricao = `Comissão automática — ${p.tipo_acao ?? "processo"}${p.numero ? ` (${p.numero})` : ""} — ${faseLabel} (${pct}%)`;

      const remRows = await sql`
        INSERT INTO remuneracoes (
          colaborador_id, tipo, valor, competencia, status, descricao,
          processo_id, client_id, origem_lancamento_id
        ) VALUES (
          ${colaboradorId}::uuid, 'comissao', ${valorComissao}::numeric,
          CURRENT_DATE, 'pendente', ${descricao},
          ${processoId}::uuid, ${p.client_id}::uuid, ${lancamentoId}::uuid
        )
        RETURNING id::text
      `;
      const remuneracaoId = remRows[0].id as string;

      await sql`
        INSERT INTO lancamentos (tipo, categoria, descricao, valor, status, data_vencimento, remuneracao_id)
        VALUES (
          'saida', 'Pessoal', ${`${descricao} — ${colab.nome}`},
          ${valorComissao}::numeric, 'pendente', CURRENT_DATE, ${remuneracaoId}::uuid
        )
      `;
    }
  } catch (err) {
    console.error(
      `[comissao-colaborador] falha ao gerar comissão automática para lançamento ${lancamentoId}:`,
      err
    );
  }
}
