import sql from "./db";
import {
  resolveComissaoPctParaColaborador,
  aplicarComissao,
  type ComissaoConfig,
  type ProcessoFaseOwnership,
} from "./comissao-colaborador";

export interface ResponsavelProjecao {
  colaboradorId: string;
  nome: string;
  comissaoPct: number | null;
  comissaoEstimada: number;
}

export interface ProcessoProjecao {
  id: string;
  clientId: string;
  clientName: string;
  tipoAcao: string;
  estagioProducao: string | null;
  valorHonorario: number | null;
  percentualHonorario: number | null;
  valorCausa: number | null;
  /** Honorário total do processo (cliente → escritório), antes de qualquer comissão. */
  honorarioEstimado: number;
  /** true quando o processo não tem valor nem percentual cadastrado nem honorário já lançado — fica de fora do total projetado. */
  semHonorarioDefinido: boolean;
  /** Um item por colaborador que atuou/atua numa fase do processo (geral, administrativo, judicial — podem ser pessoas diferentes). */
  responsaveis: ResponsavelProjecao[];
}

export interface ComissaoPorColaborador {
  colaboradorId: string;
  nome: string;
  totalComissaoEstimada: number;
  processosCount: number;
}

export interface ProjecaoEscritorio {
  totalHonorarioEstimado: number;
  totalComissaoEstimada: number;
  saldoLiquidoProjetado: number;
  processosComHonorario: number;
  processosSemHonorario: number;
  porColaborador: ComissaoPorColaborador[];
  processos: ProcessoProjecao[];
}

function comissaoConfigFromRow(row: {
  comissao_administrativo_pct: number | string | null;
  comissao_judicial_pct: number | string | null;
  comissao_ambos_pct: number | string | null;
}): ComissaoConfig {
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
 * Projeção financeira do escritório inteiro (todos os processos ativos, de
 * todos os colaboradores) — o quanto se receberia de honorários e o quanto
 * se pagaria de comissão SE cada caso em andamento desse resultado
 * favorável. Admin-only por design: pedido explícito do Orlando — "essas
 * informações só pra o adm, nunca pra os funcionários" (cada colaborador já
 * vê a própria projeção em "Meu Financeiro"; só quem administra o
 * escritório deve ver a projeção de todo mundo somada).
 *
 * Mesmo motor de cálculo já usado e validado em getMeuFinanceiroInitial
 * (meu-financeiro-db.ts) — honorário estimado = valor fixo, senão
 * percentual × valor da causa, senão o que já foi lançado em
 * `lancamentos` pra esse processo; comissão resolvida por
 * resolveComissaoPctParaColaborador em modo "estimativa" (expectativa
 * otimista antes do resultado sair, não um valor garantido).
 */
export async function getProjecaoEscritorio(): Promise<ProjecaoEscritorio> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.tipo_acao,
      p.client_id::text,
      c.name AS client_name,
      p.estagio_producao,
      p.resultado_administrativo,
      p.resultado_judicial,
      p.valor_honorario,
      p.percentual_honorario,
      p.valor_causa,
      p.responsavel_id::text,
      p.responsavel_administrativo_id::text,
      p.responsavel_judicial_id::text,
      p.comissao_pct_snapshot,
      (
        SELECT COALESCE(SUM(l.valor), 0)
        FROM lancamentos l
        WHERE l.processo_id = p.id
          AND l.tipo = 'entrada'
          AND l.status IN ('pendente', 'aguardando_resultado')
      ) AS honorario_lancado
    FROM processos p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.status IN ('ativo', 'em_andamento')
      AND p.deleted_at IS NULL
    ORDER BY
      COALESCE(p.valor_honorario, p.valor_causa * p.percentual_honorario / 100) DESC NULLS LAST
  `;

  const colaboradorIds = new Set<string>();
  for (const r of rows) {
    if (r.responsavel_id) colaboradorIds.add(String(r.responsavel_id));
    if (r.responsavel_administrativo_id)
      colaboradorIds.add(String(r.responsavel_administrativo_id));
    if (r.responsavel_judicial_id)
      colaboradorIds.add(String(r.responsavel_judicial_id));
  }
  interface ColabRow {
    id: string;
    nome: string;
    comissao_administrativo_pct: number | string | null;
    comissao_judicial_pct: number | string | null;
    comissao_ambos_pct: number | string | null;
  }
  const colabRows = (colaboradorIds.size > 0
    ? await sql`
          SELECT id::text, nome,
                 comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct
          FROM colaboradores
          WHERE id = ANY(${Array.from(colaboradorIds)}::uuid[])
        `
    : []) as unknown as ColabRow[];
  const colabMap = new Map(colabRows.map((c) => [String(c.id), c]));

  const porColaboradorMap = new Map<string, ComissaoPorColaborador>();
  const processos: ProcessoProjecao[] = [];
  let totalHonorarioEstimado = 0;
  let totalComissaoEstimada = 0;
  let processosComHonorario = 0;
  let processosSemHonorario = 0;

  for (const r of rows) {
    const fixo = r.valor_honorario != null ? Number(r.valor_honorario) : null;
    const perc =
      r.percentual_honorario != null && r.valor_causa != null
        ? (Number(r.percentual_honorario) / 100) * Number(r.valor_causa)
        : null;
    const lancado =
      r.honorario_lancado != null && Number(r.honorario_lancado) > 0
        ? Number(r.honorario_lancado)
        : null;
    const honorarioEstimado = fixo ?? perc ?? lancado ?? 0;
    const semHonorarioDefinido =
      fixo == null && perc == null && lancado == null;

    if (semHonorarioDefinido) processosSemHonorario++;
    else {
      processosComHonorario++;
      totalHonorarioEstimado += honorarioEstimado;
    }

    const ownership: ProcessoFaseOwnership = {
      estagio_producao: r.estagio_producao ?? null,
      resultado_administrativo: r.resultado_administrativo ?? null,
      resultado_judicial: r.resultado_judicial ?? null,
      responsavel_id: r.responsavel_id ? String(r.responsavel_id) : null,
      responsavel_administrativo_id: r.responsavel_administrativo_id
        ? String(r.responsavel_administrativo_id)
        : null,
      responsavel_judicial_id: r.responsavel_judicial_id
        ? String(r.responsavel_judicial_id)
        : null,
    };
    const snapshot = (r.comissao_pct_snapshot ?? {}) as Record<
      string,
      ComissaoConfig
    >;

    const candidatoIds = Array.from(
      new Set(
        [
          ownership.responsavel_id,
          ownership.responsavel_administrativo_id,
          ownership.responsavel_judicial_id,
        ].filter((v): v is string => v != null)
      )
    );

    const responsaveis: ResponsavelProjecao[] = [];
    for (const colaboradorId of candidatoIds) {
      const colab = colabMap.get(colaboradorId);
      if (!colab) continue;
      const config: ComissaoConfig =
        snapshot[colaboradorId] ?? comissaoConfigFromRow(colab);
      const pct = resolveComissaoPctParaColaborador(
        colaboradorId,
        config,
        ownership,
        "estimativa"
      );
      const comissaoEstimada = aplicarComissao(honorarioEstimado, pct);
      responsaveis.push({
        colaboradorId,
        nome: String(colab.nome),
        comissaoPct: pct,
        comissaoEstimada,
      });
      if (comissaoEstimada > 0) {
        totalComissaoEstimada += comissaoEstimada;
        const existente = porColaboradorMap.get(colaboradorId) ?? {
          colaboradorId,
          nome: String(colab.nome),
          totalComissaoEstimada: 0,
          processosCount: 0,
        };
        existente.totalComissaoEstimada += comissaoEstimada;
        existente.processosCount += 1;
        porColaboradorMap.set(colaboradorId, existente);
      }
    }

    processos.push({
      id: String(r.id),
      clientId: String(r.client_id),
      clientName: r.client_name ?? "–",
      tipoAcao: r.tipo_acao ?? "–",
      estagioProducao: r.estagio_producao ?? null,
      valorHonorario: fixo,
      percentualHonorario:
        r.percentual_honorario != null ? Number(r.percentual_honorario) : null,
      valorCausa: r.valor_causa != null ? Number(r.valor_causa) : null,
      honorarioEstimado,
      semHonorarioDefinido,
      responsaveis,
    });
  }

  return {
    totalHonorarioEstimado,
    totalComissaoEstimada,
    saldoLiquidoProjetado: totalHonorarioEstimado - totalComissaoEstimada,
    processosComHonorario,
    processosSemHonorario,
    porColaborador: Array.from(porColaboradorMap.values()).sort(
      (a, b) => b.totalComissaoEstimada - a.totalComissaoEstimada
    ),
    processos,
  };
}
