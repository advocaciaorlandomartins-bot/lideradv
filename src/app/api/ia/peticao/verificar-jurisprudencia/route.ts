/**
 * POST /api/ia/peticao/verificar-jurisprudencia
 * Jurisprudência Viva — confere Tema/Súmula/RE/RCL/ADI/ADPF citados num
 * texto (petição gerada ou editada) contra os precedentes verificados.
 * Cobertura deliberadamente parcial (só BPC idoso/deficiência e
 * salário-maternidade, ver seed-jurisprudencia-viva.ts) — "não encontrado"
 * aqui significa "não confirmado ainda", nunca "está errado". Não bloqueia
 * nada: devolve o relatório pro front-end decidir como mostrar.
 * Body: { texto: string }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { verificarJurisprudencia } from "@/lib/jurisprudencia-gate";

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

  const relatorio = await verificarJurisprudencia(texto);
  return NextResponse.json(relatorio);
}
