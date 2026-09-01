import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getRanking } from "@/lib/pontuacao";

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

  const ranking = await getRanking(dias);
  return NextResponse.json({ ranking });
}
