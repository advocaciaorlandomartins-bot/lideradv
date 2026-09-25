import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getModeloById } from "@/lib/modelos-db";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getAdvogadosParaDocumento } from "@/lib/colaboradores-db";
import { buildModeloVars } from "@/lib/modelo-vars";
import { renderModeloParaPdf } from "@/lib/modelo-pdf-render";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const modeloId = searchParams.get("modeloId");
  const clienteId = searchParams.get("clienteId");

  if (!modeloId || !clienteId) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(modeloId) || !UUID_RE.test(clienteId)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  const [modelo, client, escritorioConfig] = await Promise.all([
    getModeloById(modeloId),
    getClientFull(clienteId),
    getEscritorioConfig(),
  ]);

  if (!modelo)
    return NextResponse.json(
      { error: "Modelo não encontrado." },
      { status: 404 }
    );
  if (!client)
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );

  // Sem timeZone explícito, o servidor (UTC) data o documento um dia à
  // frente para gerações após as 21h no horário de Brasília.
  const date = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Build variable map
  const advogados = await getAdvogadosParaDocumento().catch(() => []);
  const vars = buildModeloVars(client, escritorioConfig, date, advogados);

  let buffer: Buffer;
  try {
    buffer = await renderModeloParaPdf({
      modelo,
      client,
      escritorioConfig,
      vars,
      date,
    });
  } catch (err) {
    console.error("gerar-modelo render error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar o PDF. Verifique a formatação do modelo." },
      { status: 500 }
    );
  }

  const safeName = client.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const safeTitle = modelo.titulo
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}_${safeName}.pdf"`,
    },
  });
}
