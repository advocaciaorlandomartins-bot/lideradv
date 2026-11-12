import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { podeAcessarEntidade } from "@/lib/acesso";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { agentesEstaoAtivos } from "@/lib/config-agentes-db";
import sql from "@/lib/db";
import { isUrlPermitida, isBlobPrivado } from "@/lib/blob-url";
import { obterConversa } from "@/lib/iris-conversas-db";
import { executarIris, type AnexoComUrl } from "@/lib/iris-engine";

export const dynamic = "force-dynamic";
// Era 60 com um comentário dizendo que o teto da Vercel "não dá pra
// aumentar" — premissa falsa, confirmada em auditoria de 2026-11-07:
// /api/cron/orquestrador usa maxDuration=300 no mesmo plano. Subido junto
// com a troca pra streaming (evita o timeout de proxy numa chamada não-
// streaming longa, que era o risco real, não o teto em si).
export const maxDuration = 120;

const MAX_CHARS_TEXTO = 8000;
const MAX_ARQUIVOS = 3;
const MIME_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Blobs privados exigem o token de leitura/escrita no header — sem isso o
// fetch volta 403. isUrlPermitida/isBlobPrivado agora centralizados em
// @/lib/blob-url (validação por hostname real, nunca substring da URL).
async function fetchBlobContent(url: string): Promise<Response | null> {
  if (!isUrlPermitida(url)) return null;
  if (isBlobPrivado(url)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
  }
  return fetch(url).catch(() => null);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (await iaRateLimitExcedido(session.login))
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );

  if (!(await agentesEstaoAtivos()))
    return NextResponse.json(
      {
        error:
          "Os agentes de IA estão pausados temporariamente (kill switch ativo). Fale com um administrador.",
      },
      { status: 503 }
    );

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const text = String(body.text ?? "")
    .trim()
    .slice(0, MAX_CHARS_TEXTO);
  if (!text)
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const conversaIdInformado =
    typeof body.conversaId === "string" && body.conversaId.trim()
      ? body.conversaId.trim()
      : null;

  // Cliente da página onde o usuário abriu a Íris (widget flutuante em
  // /dashboard/clientes/[id]) — usado pra dar contexto de "esse cliente" e
  // pra anexar automaticamente documento no arquivo dele. Revalida acesso
  // aqui: o front manda o id lido da própria URL, nunca confia sem checar.
  const UUID_RE_BODY =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const paginaClienteIdRaw =
    typeof body.paginaClienteId === "string" ? body.paginaClienteId.trim() : "";
  let paginaCliente: { id: string; nome: string } | null = null;
  if (paginaClienteIdRaw && UUID_RE_BODY.test(paginaClienteIdRaw)) {
    const podeVer = await podeAcessarEntidade(
      session,
      "cliente",
      paginaClienteIdRaw
    ).catch(() => false);
    if (podeVer) {
      const [row] = await sql`
        SELECT id::text, name FROM clients
        WHERE id = ${paginaClienteIdRaw}::uuid AND deleted_at IS NULL
      `.catch(() => []);
      if (row) paginaCliente = { id: String(row.id), nome: String(row.name) };
    }
  }

  const attachmentsRaw = Array.isArray(body.attachments)
    ? (body.attachments as unknown[])
    : [];
  const anexosRequest: AnexoComUrl[] = attachmentsRaw
    .filter(
      (a): a is AnexoComUrl =>
        !!a &&
        typeof a === "object" &&
        typeof (a as AnexoComUrl).url === "string" &&
        typeof (a as AnexoComUrl).nome === "string" &&
        typeof (a as AnexoComUrl).mimeType === "string"
    )
    .slice(0, MAX_ARQUIVOS);
  for (const a of anexosRequest) {
    if (!MIME_SUPORTADOS.has(a.mimeType))
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado: ${a.nome}` },
        { status: 400 }
      );
    if (!isUrlPermitida(a.url))
      return NextResponse.json(
        { error: `Anexo inválido: ${a.nome}` },
        { status: 400 }
      );
  }

  // Confere que a conversa existe e é do usuário logado ANTES de chamar o
  // motor — o motor (executarIris) aceita um conversaId não encontrado como
  // "começa uma conversa nova" (bom pra chamadores sem como escolher outro
  // id, como o WhatsApp), mas a tela aqui já mostra o histórico errado se
  // isso acontecer silenciosamente, então o erro 404 continua explícito.
  if (conversaIdInformado) {
    const conversa = await obterConversa(session.id, conversaIdInformado);
    if (!conversa)
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
  }

  // Anexos só valem pro turno em que foram enviados: não são reenviados
  // nos turnos seguintes (o texto já persistido carrega o que a Íris
  // concluiu sobre eles) — evita reprocessar o mesmo PDF a cada mensagem.
  // O arquivo já foi enviado direto do navegador pro Blob (upload() do
  // @vercel/blob/client) — aqui só baixamos o conteúdo pra montar os
  // blocos que vão pra Anthropic.
  const temPdf = anexosRequest.some((a) => a.mimeType === "application/pdf");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: string | any[] = text;
  const anexosMeta: { nome: string; mimeType: string }[] = [];
  if (anexosRequest.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [];
    for (const a of anexosRequest) {
      const res = await fetchBlobContent(a.url);
      if (!res || !res.ok)
        return NextResponse.json(
          { error: `Não consegui baixar o anexo: ${a.nome}` },
          { status: 502 }
        );
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      if (a.mimeType === "application/pdf") {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        });
      } else {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: a.mimeType, data: base64 },
        });
      }
      anexosMeta.push({ nome: a.nome, mimeType: a.mimeType });
    }
    blocks.push({ type: "text", text });
    userContent = blocks;
  }

  try {
    const resultado = await executarIris({
      session,
      text,
      userContent,
      anexosMeta,
      anexosRequest,
      conversaIdInformado,
      paginaCliente,
      temPdf,
      rotaUso: "/api/iris/chat",
    });
    return NextResponse.json(resultado);
  } catch (err) {
    // Loga tipo/status/mensagem separado (não só o objeto err) — Vercel só
    // guarda log por 12h, então na próxima vez que isso acontecer precisa
    // dar pra entender a causa rápido sem precisar reproduzir.
    const info =
      err instanceof Error
        ? { name: err.name, message: err.message }
        : { raw: String(err) };
    console.error("[iris/chat] erro inesperado:", info, err);
    return NextResponse.json(
      { error: "Erro ao gerar resposta. Tente novamente." },
      { status: 500 }
    );
  }
}
