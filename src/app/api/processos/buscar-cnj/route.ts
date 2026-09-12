/**
 * POST /api/processos/buscar-cnj
 * Busca dados de cadastro de um processo pelo número CNJ, via API pública
 * do DataJud (CNJ) — usado pelo botão "Cadastro automático CNJ".
 * Body: { numero: string }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { buscarProcessoPorCNJ } from "@/lib/datajud";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "criar")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DATAJUD_API_KEY não configurada." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const numero = String(body?.numero ?? "").trim();
  const digits = numero.replace(/\D/g, "");
  if (digits.length !== 20) {
    return NextResponse.json(
      { error: "Número CNJ inválido — precisa ter 20 dígitos." },
      { status: 400 }
    );
  }

  const dados = await buscarProcessoPorCNJ(numero, apiKey);
  if (!dados) {
    return NextResponse.json(
      {
        error:
          "Processo não encontrado nessa consulta pública, ou o tribunal ainda não disponibilizou os dados.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ dados });
}
