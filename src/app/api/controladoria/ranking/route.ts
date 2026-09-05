import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getRankingDetalhado,
  filtrarHistoricoPorPermissao,
} from "@/lib/pontuacao";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const diasParam = Number(req.nextUrl.searchParams.get("dias") ?? "30");
  const dias =
    Number.isFinite(diasParam) && diasParam > 0 && diasParam <= 365
      ? diasParam
      : 30;

  const podeVerDetalhesDeTodos = hasPermission(
    session,
    "processos_ver_todos",
    "ver"
  );
  const meuColaboradorId = await getColaboradorIdForUser(session.id);
  const ranking = await getRankingDetalhado(
    dias,
    podeVerDetalhesDeTodos ? null : meuColaboradorId
  );
  const rankingFiltrado = filtrarHistoricoPorPermissao(
    ranking,
    podeVerDetalhesDeTodos,
    meuColaboradorId
  );
  return NextResponse.json({ ranking: rankingFiltrado });
}
