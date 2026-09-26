import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarCliente } from "@/lib/acesso";
import { getModeloById } from "@/lib/modelos-db";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getAdvogadosParaDocumento } from "@/lib/colaboradores-db";
import { buildModeloVars } from "@/lib/modelo-vars";
import { renderModeloParaPdf } from "@/lib/modelo-pdf-render";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gerarPdf(
  session: SessionUser,
  modeloId: string,
  clienteId: string,
  respostasExtras: Record<string, string>
): Promise<NextResponse | Response> {
  if (!UUID_RE.test(modeloId) || !UUID_RE.test(clienteId)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  // Sem isto, qualquer usuário com clientes:ver (mas sem
  // clientes_ver_todos, ex: Advogado(a)/Estagiário(a) não responsável por
  // esse cliente) conseguia passar o clienteId de OUTRO colaborador e
  // receber de volta CPF, endereço, membros da família e dados do
  // responsável legal num PDF — mesma checagem que documentos/*, ia/* e
  // assinaturas-actions.ts já fazem.
  if (!(await podeAcessarCliente(session, clienteId)))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

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

  const advogados = await getAdvogadosParaDocumento().catch(() => []);
  const vars = buildModeloVars(client, escritorioConfig, date, advogados);

  // Só aceita resposta pra tag que o modelo realmente declarou em
  // perguntas_extras — impede que o body do POST injete uma variável
  // arbitrária no documento.
  const tagsPermitidas = new Set(
    (modelo.perguntas_extras ?? []).map((p) => p.tag)
  );
  const respostasValidas: Record<string, string> = {};
  for (const [tag, valor] of Object.entries(respostasExtras)) {
    if (tagsPermitidas.has(tag) && valor.trim()) {
      vars[`{{${tag}}}`] = valor.trim();
      respostasValidas[tag] = valor.trim();
    }
  }

  // Guarda a resposta no próprio cliente pra pré-preencher da próxima vez
  // — sem isso, cada geração pedia as mesmas perguntas do zero de novo.
  // Merge (||) em vez de substituir: editar uma pergunta não apaga as
  // outras já salvas, inclusive de outro modelo com perguntas_extras.
  if (Object.keys(respostasValidas).length > 0) {
    await sql`
      UPDATE clients
      SET respostas_extras = COALESCE(respostas_extras, '{}'::jsonb) || ${JSON.stringify(respostasValidas)}::jsonb
      WHERE id = ${clienteId}::uuid
    `.catch((e) =>
      console.error("[gerar-modelo] falha ao salvar respostas_extras:", e)
    );
  }

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

  return gerarPdf(session, modeloId, clienteId, {});
}

// Usado quando o modelo tem perguntas_extras (respostas digitadas na hora
// de gerar) — texto livre pode passar do limite prático de uma query
// string, então vai no corpo em vez de GET.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const modeloId = body?.modeloId;
  const clienteId = body?.clienteId;
  const respostas =
    body?.respostas && typeof body.respostas === "object"
      ? (body.respostas as Record<string, unknown>)
      : {};

  if (typeof modeloId !== "string" || typeof clienteId !== "string") {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  const respostasStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(respostas)) {
    if (typeof v === "string") respostasStr[k] = v;
  }

  return gerarPdf(session, modeloId, clienteId, respostasStr);
}
