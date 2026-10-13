import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarEntidade, podeAcessarColaborador } from "@/lib/acesso";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ENTITY_TYPES = [
  "processo",
  "cliente",
  "pericia",
  "colaborador",
] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];
// "colaborador" fica fora deste mapa — autoatendimento de "Meus Dados" não
// exige colaboradores:criar, só podeAcessarColaborador (admin ou o
// próprio), checado à parte abaixo.
const MODULO_POR_ENTITY_TYPE: Record<
  Exclude<EntityType, "colaborador">,
  string
> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

interface Body {
  entityType?: string;
  entityId?: string;
  nome?: string;
  tipo?: string;
  tamanho?: number;
  url?: string;
}

// Chamada pelo navegador logo depois que o upload direto pro Vercel Blob
// (POST /api/documentos/upload, que só gera o token) termina — só grava o
// registro em `documentos` (análise por IA agora é sempre manual, via
// "Reanalisar" — ver comentário mais abaixo). Nunca confia no
// entityType/entityId/permissão que vieram do cliente sem checar de novo
// aqui (mesma regra de todo o resto do sistema: o token de upload já era
// escopado pra essa entidade, mas re-valida por segurança em
// profundidade).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { entityType, entityId, nome, tipo, tamanho, url } = body;

  if (
    !entityType ||
    !VALID_ENTITY_TYPES.includes(entityType as EntityType) ||
    !entityId ||
    !UUID_RE.test(entityId) ||
    !nome ||
    !url
  ) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes." },
      { status: 400 }
    );
  }
  if (!url.includes(".blob.vercel-storage.com")) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  if (entityType === "colaborador") {
    if (!(await podeAcessarColaborador(session, entityId)))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  } else {
    if (
      !hasPermission(
        session,
        MODULO_POR_ENTITY_TYPE[
          entityType as Exclude<EntityType, "colaborador">
        ],
        "criar"
      )
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    if (
      !(await podeAcessarEntidade(session, entityType as EntityType, entityId))
    )
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const rows = await sql`
      INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
      VALUES (
        ${entityType},
        ${entityId}::uuid,
        ${nome},
        ${tipo ?? null},
        ${tamanho ?? null},
        ${new URL(url).pathname.replace(/^\//, "")},
        ${url}
      )
      RETURNING id::text
    `;
    const documentoId = rows[0].id as string;

    // Análise automática por upload foi desligada a pedido do Orlando
    // (2026-10-12): gastava crédito de IA sozinha em todo PDF/imagem
    // enviado, sem confirmação — um upload em lote (ex: 15 documentos de
    // um cliente) virava 15 chamadas de IA sem ninguém escolher isso.
    // Pra analisar um documento, agora é sempre pelo botão "Reanalisar"
    // (Documentos, processo ou cliente) — controle explícito de quando
    // gasta, mesma IA por trás (analisarDocumento/analisarDocumentoCliente
    // em cerebroJuridico.ts/cliente-documento-auto.ts, chamadas via
    // /api/cerebro/documento e /api/cerebro/documento-cliente).

    return NextResponse.json({ id: documentoId, url });
  } catch (err) {
    console.error("[documentos/confirmar] DB error:", err);
    return NextResponse.json(
      { error: "Erro ao registrar documento no banco." },
      { status: 500 }
    );
  }
}
