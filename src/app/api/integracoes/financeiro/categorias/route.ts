import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getIntegracoesAuth } from "@/lib/integracoes-jwt";

export const dynamic = "force-dynamic";

const CATEGORIAS_RECEITA = [
  { value: "freelance", label: "Freelance / Consultoria" },
  { value: "salario", label: "Salário / Pró-labore" },
  { value: "aluguel", label: "Aluguel / Imóvel" },
  { value: "investimento", label: "Investimento / Rendimento" },
  { value: "comissao", label: "Comissão" },
  { value: "bonus", label: "Bônus / Prêmio" },
  { value: "outros", label: "Outros" },
];

const CATEGORIAS_DESPESA = [
  { value: "moradia", label: "Moradia" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "saude", label: "Saúde" },
  { value: "transporte", label: "Transporte" },
  { value: "educacao", label: "Educação" },
  { value: "lazer", label: "Lazer / Entretenimento" },
  { value: "vestuario", label: "Vestuário" },
  { value: "servicos", label: "Serviços (luz, água, internet)" },
  { value: "impostos", label: "Impostos / Taxas" },
  { value: "outros", label: "Outros" },
];

// GET /api/integracoes/financeiro/categorias
export async function GET(req: NextRequest) {
  const auth = getIntegracoesAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  // Busca categorias customizadas salvas pelo colaborador
  const usuarioRows = await sql`
    SELECT id::text FROM usuarios
    WHERE colaborador_id = ${auth.sub}::uuid AND ativo = true
    LIMIT 1
  `;

  let customReceita: string[] = [];
  let customDespesa: string[] = [];

  if (usuarioRows.length > 0) {
    const usuarioId = String(usuarioRows[0].id);
    const predefinidas = new Set([
      ...CATEGORIAS_RECEITA.map((c) => c.value),
      ...CATEGORIAS_DESPESA.map((c) => c.value),
    ]);

    const catRows = await sql`
      SELECT DISTINCT tipo, categoria
      FROM meu_financeiro_lancamentos
      WHERE usuario_id = ${usuarioId}::uuid
        AND categoria NOT IN (${sql.array(Array.from(predefinidas))})
      ORDER BY tipo, categoria
    `;

    customReceita = catRows
      .filter((r) => r.tipo === "receita")
      .map((r) => String(r.categoria));
    customDespesa = catRows
      .filter((r) => r.tipo === "despesa")
      .map((r) => String(r.categoria));
  }

  return NextResponse.json({
    receita: {
      predefinidas: CATEGORIAS_RECEITA,
      customizadas: customReceita,
    },
    despesa: {
      predefinidas: CATEGORIAS_DESPESA,
      customizadas: customDespesa,
    },
  });
}
