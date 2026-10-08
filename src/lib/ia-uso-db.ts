import "server-only";
import sql from "./db";

export async function registrarUsoIA(
  rota: string,
  modelo: string,
  inputTokens: number,
  outputTokens: number,
  usuarioId: string | null
): Promise<void> {
  await sql`
    INSERT INTO ia_uso (rota, modelo, input_tokens, output_tokens, usuario_id)
    VALUES (${rota}, ${modelo}, ${inputTokens}, ${outputTokens}, ${usuarioId}::uuid)
  `.catch((e) =>
    console.error("[ia-uso-db] falha ao registrar uso:", String(e))
  );
}

export interface ResumoUsoIA {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalChamadas: number;
  custoEstimadoUsd: number | null;
}

/**
 * Preço por milhão de tokens é configurado via env (ANTHROPIC_PRECO_INPUT_MTOK
 * / ANTHROPIC_PRECO_OUTPUT_MTOK) em vez de fixo no código — a tabela de preços
 * muda por modelo/plano e eu não tenho como confirmar o valor exato vigente
 * pro plano do Orlando; sem essas envs configuradas, mostra só os tokens
 * (sempre exatos, vêm da própria resposta da Anthropic) sem estimar em R$/US$.
 */
export async function getResumoUsoIA(horas: number): Promise<ResumoUsoIA> {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(input_tokens), 0)::bigint AS input_total,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_total,
      COUNT(*)::int AS chamadas
    FROM ia_uso
    WHERE criado_em >= NOW() - (${horas} || ' hours')::interval
  `;

  const totalInputTokens = Number(row?.input_total ?? 0);
  const totalOutputTokens = Number(row?.output_total ?? 0);
  const totalChamadas = Number(row?.chamadas ?? 0);

  const precoInput = Number(process.env.ANTHROPIC_PRECO_INPUT_MTOK ?? "");
  const precoOutput = Number(process.env.ANTHROPIC_PRECO_OUTPUT_MTOK ?? "");
  const custoEstimadoUsd =
    Number.isFinite(precoInput) &&
    Number.isFinite(precoOutput) &&
    precoInput > 0 &&
    precoOutput > 0
      ? (totalInputTokens / 1_000_000) * precoInput +
        (totalOutputTokens / 1_000_000) * precoOutput
      : null;

  return {
    totalInputTokens,
    totalOutputTokens,
    totalChamadas,
    custoEstimadoUsd,
  };
}
