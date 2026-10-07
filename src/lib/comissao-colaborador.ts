import sql from "./db";

// CURRENT_DATE (Postgres) roda em UTC, que já é o dia seguinte no Brasil
// (UTC-3) após as 21h — perto da virada do mês isso gravava a comissão na
// competência errada.
function todayBR(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

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
 * processo — só há comissão em fase com ÊXITO. Uma fase perdida (negado /
 * improcedente) não paga nada a quem a fez; só quem entrega o resultado
 * favorável final é que recebe.
 *
 * Regras:
 * - Concedido no administrativo → só quem fez o administrativo recebe, pelo
 *   % "só administrativo". Caso encerra aqui, ninguém mais participa.
 * - Negado no administrativo → quem fez essa fase NÃO recebe nada por ela
 *   (foi derrota). Só há comissão se o judicial depois der êxito
 *   (procedente/parcial):
 *   - Mesma pessoa nas duas fases → recebe pelo % "administrativo + judicial"
 *     (ela carregou o caso do início ao fim vencedor).
 *   - Pessoas diferentes → só quem fez e venceu o judicial recebe, pelo seu
 *     próprio % "só judicial" (quem perdeu o administrativo fica sem nada).
 *   - Judicial improcedente, ou ainda sem resultado → sem comissão real
 *     ainda (no modo "estimativa", mostra uma expectativa otimista).
 * - Foi direto pro judicial (sem passar por administrativo) e deu êxito →
 *   quem fez o judicial recebe pelo % "só judicial". Improcedente → nada.
 * - Ainda em andamento, sem nenhum resultado → sem comissão real ainda
 *   (modo "estimativa" mostra uma expectativa pela fase administrativa).
 *
 * @param modo "pagamento" (padrão) só resolve % quando há êxito confirmado —
 *   usado pra gerar dinheiro de verdade. "estimativa" mostra uma expectativa
 *   otimista mesmo antes do resultado sair, pro colaborador ter uma noção do
 *   que pode vir a receber (usado só no preview de Meu Financeiro).
 */
export function resolveComissaoPctParaColaborador(
  colaboradorId: string,
  config: ComissaoConfig | null,
  p: ProcessoFaseOwnership,
  modo: "estimativa" | "pagamento" = "pagamento"
): number | null {
  // null aqui = "comissão não configurada" (nenhum % cadastrado pra esse
  // colaborador) — chamador trata como estimativa indefinida. A partir daqui,
  // config existe, então "não tem direito a essa fase" retorna 0, nunca
  // null — pra não ser confundido com "não configurado" e acabar mostrando o
  // valor cheio do processo como se fosse a comissão dele.
  if (!config) return null;

  const adminId = p.responsavel_administrativo_id ?? p.responsavel_id;
  const judId = p.responsavel_judicial_id ?? p.responsavel_id;

  if (p.resultado_administrativo === "concedido") {
    return colaboradorId === adminId
      ? (config.comissao_administrativo_pct ?? 0)
      : 0;
  }

  if (p.resultado_administrativo === "negado") {
    if (
      p.resultado_judicial === "procedente" ||
      p.resultado_judicial === "parcial"
    ) {
      const mesmaPessoa = adminId != null && adminId === judId;
      if (mesmaPessoa) {
        return colaboradorId === judId ? (config.comissao_ambos_pct ?? 0) : 0;
      }
      // Fases divididas: só quem venceu no judicial recebe — quem perdeu o
      // administrativo não leva nada dessa fase.
      return colaboradorId === judId ? (config.comissao_judicial_pct ?? 0) : 0;
    }
    if (p.resultado_judicial === "improcedente") return 0; // sem êxito em lugar nenhum

    // Judicial ainda não resolvido.
    if (modo === "estimativa") {
      return colaboradorId === judId ? (config.comissao_judicial_pct ?? 0) : 0;
    }
    return 0; // pagamento real: nada a pagar até o judicial dar êxito
  }

  if (
    p.resultado_judicial === "procedente" ||
    p.resultado_judicial === "parcial"
  ) {
    return colaboradorId === judId ? (config.comissao_judicial_pct ?? 0) : 0;
  }
  if (p.resultado_judicial === "improcedente") return 0;

  // Ainda sem nenhum resultado (caso em andamento).
  if (modo === "estimativa") {
    return colaboradorId === adminId
      ? (config.comissao_administrativo_pct ?? 0)
      : 0;
  }
  return 0; // pagamento real: nada a pagar enquanto não há resultado
}

export function aplicarComissao(valor: number, pct: number | null): number {
  if (pct == null) return valor;
  return Math.round(valor * (pct / 100) * 100) / 100;
}

/** Monta um ComissaoConfig a partir de uma linha de `colaboradores` — mesma conversão usada em congelarComissaoSnapshot e no fallback de gerarComissaoAutomaticaPorPagamento. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function comissaoConfigFromRow(row: any): ComissaoConfig {
  return {
    comissao_administrativo_pct:
      row.comissao_administrativo_pct != null
        ? Number(row.comissao_administrativo_pct)
        : null,
    comissao_judicial_pct:
      row.comissao_judicial_pct != null
        ? Number(row.comissao_judicial_pct)
        : null,
    comissao_ambos_pct:
      row.comissao_ambos_pct != null ? Number(row.comissao_ambos_pct) : null,
  };
}

/**
 * Congela o % de comissão vigente AGORA pra um colaborador num processo —
 * chamado no momento em que ele "assume" uma fase (protocolo administrativo
 * registrado ou distribuição judicial registrada), os mesmos dois pontos
 * que já congelam responsavel_administrativo_id/responsavel_judicial_id.
 * Sem isso, mudar o % de um colaborador parceiro no cadastro alterava
 * silenciosamente a comissão de processos que já estavam em andamento com
 * ele — o pagamento só é calculado de verdade na hora em que o cliente
 * paga, não quando o processo é aberto, e até lá sempre lia o % "ao vivo".
 * processos.comissao_pct_snapshot é um mapa { [colaboradorId]: ComissaoConfig }
 * — cada colaborador guarda o próprio snapshot, independente de outros que
 * também tenham atuado no mesmo processo.
 *
 * Dois cuidados que a primeira versão não tinha (achados de revisão):
 * 1. Só grava o campo da FASE que está sendo congelada agora
 *    (comissao_administrativo_pct ou comissao_judicial_pct) — nunca o
 *    objeto inteiro. Gravar tudo de novo a cada chamada fazia a 2ª fase
 *    (ex: judicial, depois que o administrativo já tinha sido negado)
 *    sobrescrever o valor da 1ª com o % atual do cadastro, perdendo
 *    justamente o congelamento que essa função existe pra garantir.
 * 2. "comissao_ambos_pct" só é gravado se ainda não tinha sido — regra
 *    "primeira vez vale" pra refletir o % vigente quando o colaborador
 *    assumiu o processo pela primeira vez (não quando a 2ª fase dele
 *    for registrada depois).
 * 3. Tudo num único UPDATE (jsonb_set lendo a própria coluna na mesma
 *    instrução) em vez de SELECT + UPDATE em dois passos — evita
 *    "lost update" se dois congelamentos do mesmo processo acontecerem
 *    quase ao mesmo tempo (ex: admin e judicial registrados em sequência
 *    rápida por pessoas diferentes).
 */
export async function congelarComissaoSnapshot(
  processoId: string,
  colaboradorId: string | null,
  fase: "administrativo" | "judicial"
): Promise<void> {
  if (!colaboradorId) return;
  try {
    const [colab] = await sql`
      SELECT comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct
      FROM colaboradores WHERE id = ${colaboradorId}::uuid
    `;
    if (!colab) return;

    const config = comissaoConfigFromRow(colab);
    const campoFase =
      fase === "administrativo"
        ? "comissao_administrativo_pct"
        : "comissao_judicial_pct";
    const pctFase =
      fase === "administrativo"
        ? config.comissao_administrativo_pct
        : config.comissao_judicial_pct;

    await sql`
      UPDATE processos
      SET comissao_pct_snapshot = jsonb_set(
        COALESCE(comissao_pct_snapshot, '{}'::jsonb),
        ARRAY[${colaboradorId}]::text[],
        COALESCE(comissao_pct_snapshot -> ${colaboradorId}, '{}'::jsonb)
          || jsonb_build_object(${campoFase}, ${pctFase}::numeric)
          || CASE
               WHEN (comissao_pct_snapshot -> ${colaboradorId} -> 'comissao_ambos_pct') IS NULL
               THEN jsonb_build_object('comissao_ambos_pct', ${config.comissao_ambos_pct}::numeric)
               ELSE '{}'::jsonb
             END,
        true
      )
      WHERE id = ${processoId}::uuid
    `;
  } catch (e) {
    console.error(
      `[comissao-colaborador] falha ao congelar snapshot do processo ${processoId}:`,
      e
    );
  }
}

/**
 * Quando um lançamento de honorário do cliente (entrada, vinculado a um
 * processo) é marcado como pago, gera automaticamente a comissão de quem
 * entregou o resultado favorável — sem precisar que o admin digite o valor
 * na mão. Só gera comissão pra quem teve êxito na fase que fez; quem perdeu
 * uma fase (ex: administrativo negado) não recebe nada por ela. Se
 * administrativo e judicial foram pessoas diferentes e o judicial venceu,
 * só a pessoa do judicial é paga. Fica "pendente" até alguém confirmar o
 * pagamento em Remunerações. Se o cliente pagar parcelado, cada parcela
 * paga gera sua própria comissão (mesma cadência).
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
        p.responsavel_administrativo_id::text, p.responsavel_judicial_id::text,
        p.comissao_pct_snapshot
      FROM processos p
      WHERE p.id = ${processoId}::uuid
    `;
    const p = rows[0];
    if (!p) return;

    const snapshot = (p.comissao_pct_snapshot ?? {}) as Record<
      string,
      ComissaoConfig
    >;

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
    if (candidatoIds.length === 0) {
      // Pagamento real de honorário vinculado a um processo sem NENHUM
      // responsável (geral/administrativo/judicial) preenchido — comissão
      // nunca é gerada e não havia nenhum sinal disso em lugar nenhum
      // (nem log, nem aviso na tela). Confirmado em produção: processo já
      // arquivado como "concedido", com honorários pagos, responsável_id
      // nulo — comissão nunca criada, escritório só descobriria se o
      // colaborador reclamasse. Loga pra pelo menos deixar rastro.
      console.error(
        `[comissao-colaborador] pagamento de R$ ${valorPago.toFixed(2)} no processo ${processoId} (lançamento ${lancamentoId}) sem nenhum responsável definido — comissão não gerada.`
      );
      return;
    }

    const colabRows = await sql`
      SELECT id::text, nome,
             comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct
      FROM colaboradores
      WHERE id = ANY(${candidatoIds}::uuid[])
    `;

    for (const colab of colabRows) {
      const colaboradorId = String(colab.id);
      // Snapshot congelado no momento em que esse colaborador assumiu a
      // fase (ver congelarComissaoSnapshot) tem prioridade sobre o % atual
      // do cadastro — processo aberto antes dessa funcionalidade existir
      // não tem snapshot, cai no % ao vivo (comportamento de sempre).
      const config: ComissaoConfig =
        snapshot[colaboradorId] ?? comissaoConfigFromRow(colab);
      const pct = resolveComissaoPctParaColaborador(
        colaboradorId,
        config,
        ownership,
        "pagamento"
      );
      if (pct == null) continue;

      const valorComissao = aplicarComissao(valorPago, pct);
      if (valorComissao <= 0) continue;

      const faseLabel =
        pct === config.comissao_ambos_pct
          ? "administrativo + judicial"
          : pct === config.comissao_judicial_pct
            ? "judicial"
            : "administrativo";
      const descricao = `Comissão automática — ${p.tipo_acao ?? "processo"}${p.numero ? ` (${p.numero})` : ""} — ${faseLabel} (${pct}%)`;

      try {
        // Índice único (origem_lancamento_id, colaborador_id) é a garantia
        // real contra pagamento duplicado — a checagem "jaExiste" acima é
        // só uma saída rápida no caso comum; sob concorrência (double-click,
        // retry) duas chamadas podem passar por ela antes de qualquer uma
        // inserir, então o banco precisa recusar a segunda tentativa aqui.
        const hoje = todayBR();
        const remRows = await sql`
          INSERT INTO remuneracoes (
            colaborador_id, tipo, valor, competencia, status, descricao,
            processo_id, client_id, origem_lancamento_id
          ) VALUES (
            ${colaboradorId}::uuid, 'comissao', ${valorComissao}::numeric,
            ${hoje}::date, 'pendente', ${descricao},
            ${processoId}::uuid, ${p.client_id}::uuid, ${lancamentoId}::uuid
          )
          RETURNING id::text
        `;
        const remuneracaoId = remRows[0].id as string;

        await sql`
          INSERT INTO lancamentos (tipo, categoria, descricao, valor, status, data_vencimento, remuneracao_id)
          VALUES (
            'saida', 'Pessoal', ${`${descricao} — ${colab.nome}`},
            ${valorComissao}::numeric, 'pendente', ${hoje}::date, ${remuneracaoId}::uuid
          )
        `;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("unique") || msg.includes("duplicate")) {
          continue; // já processado por uma chamada concorrente — ok, ignora
        }
        throw err;
      }
    }
  } catch (err) {
    console.error(
      `[comissao-colaborador] falha ao gerar comissão automática para lançamento ${lancamentoId}:`,
      err
    );
  }
}
