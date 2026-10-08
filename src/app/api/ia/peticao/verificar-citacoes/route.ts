/**
 * POST /api/ia/peticao/verificar-citacoes
 * Citation Gate — confere as citações de lei de um texto (petição gerada ou
 * editada) contra a Base Legal Viva. Não bloqueia nada sozinho: devolve o
 * relatório pro front-end decidir como mostrar. Só verifica citação de LEI
 * (dispositivos); jurisprudência/súmulas ainda não têm base própria — isso é
 * Fase 2 do pacote especialista.
 * Body: { texto: string }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { verificarCitacoesLegais } from "@/lib/citation-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const texto = (body.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json(
      { error: "texto é obrigatório." },
      { status: 400 }
    );
  }
  if (texto.length > 100_000) {
    return NextResponse.json({ error: "Texto longo demais." }, { status: 400 });
  }

  const relatorio = await verificarCitacoesLegais(texto);
  return NextResponse.json(relatorio);
}
