import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarEntidade, podeAcessarColaborador } from "@/lib/acesso";
import sql from "@/lib/db";
import { getDocumentosByEntityId } from "@/lib/documents-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ENTITY_TYPES = [
  "processo",
  "cliente",
  "pericia",
  "colaborador",
] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];
// "colaborador" fica fora deste mapa — baixar os PRÓPRIOS arquivos em
// "Meus Dados" não exige colaboradores:ver, só podeAcessarColaborador
// (admin ou o próprio), checado à parte abaixo.
const MODULO_POR_ENTITY_TYPE: Record<
  Exclude<EntityType, "colaborador">,
  string
> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

async function entidadeAtiva(
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  if (entityType === "processo") {
    const rows =
      await sql`SELECT 1 FROM processos WHERE id = ${entityId}::uuid AND deleted_at IS NULL`;
    return rows.length > 0;
  }
  if (entityType === "cliente") {
    const rows =
      await sql`SELECT 1 FROM clients WHERE id = ${entityId}::uuid AND deleted_at IS NULL`;
    return rows.length > 0;
  }
  if (entityType === "colaborador") {
    const rows =
      await sql`SELECT 1 FROM colaboradores WHERE id = ${entityId}::uuid`;
    return rows.length > 0;
  }
  const rows = await sql`SELECT 1 FROM pericias WHERE id = ${entityId}::uuid`;
  return rows.length > 0;
}

// Nomes únicos dentro do zip mesmo se dois documentos tiverem o mesmo nome.
function nomeUnico(base: string, usados: Set<string>): string {
  if (!usados.has(base)) {
    usados.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let i = 2;
  let candidato = `${stem} (${i})${ext}`;
  while (usados.has(candidato)) {
    i++;
    candidato = `${stem} (${i})${ext}`;
  }
  usados.add(candidato);
  return candidato;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    entityType?: string;
    entityId?: string;
    ids?: string[];
  } | null;

  const entityType = body?.entityType;
  const entityId = body?.entityId;
  const idsRaw = Array.isArray(body?.ids) ? body.ids : null;
  const ids =
    idsRaw?.filter(
      (x): x is string => typeof x === "string" && UUID_RE.test(x)
    ) ?? null;

  let selecionados: { id: string; nome: string; url: string }[];

  if (ids && ids.length > 0) {
    // "Baixar selecionados" pode misturar documentos de entidades
    // diferentes — a tela de processo, por exemplo, mostra numa lista só
    // os documentos do processo E os do cliente vinculado. Em vez de
    // assumir que todo id selecionado pertence à entidade da página
    // (entityType/entityId), busca cada documento pelo id e valida o
    // acesso pela entidade REAL dele — mesmo padrão já usado em
    // /api/documentos/download (documento único). Sem isso, selecionar um
    // documento cuja entidade real é diferente da página sempre batia em
    // "Nenhum documento para baixar" (nenhum id selecionado nunca aparecia
    // no resultado filtrado por entityType/entityId da página).
    const rows = await sql`
      SELECT id::text, nome, url, entity_type, entity_id::text
      FROM documentos
      WHERE id = ANY(${ids}::uuid[])
    `;
    selecionados = [];
    for (const r of rows as {
      id: string;
      nome: string;
      url: string;
      entity_type: string;
      entity_id: string;
    }[]) {
      const et = r.entity_type as EntityType;
      if (!VALID_ENTITY_TYPES.includes(et)) continue;
      const permitido =
        et === "colaborador"
          ? await podeAcessarColaborador(session, r.entity_id)
          : hasPermission(
              session,
              MODULO_POR_ENTITY_TYPE[et as Exclude<EntityType, "colaborador">],
              "ver"
            ) && (await podeAcessarEntidade(session, et, r.entity_id));
      if (permitido) selecionados.push({ id: r.id, nome: r.nome, url: r.url });
    }
  } else {
    // "Baixar todos" (sem seleção) — mantém o comportamento por entidade
    // única já existente.
    if (
      !entityType ||
      !VALID_ENTITY_TYPES.includes(entityType as EntityType) ||
      !entityId ||
      !UUID_RE.test(entityId)
    ) {
      return NextResponse.json(
        { error: "Parâmetros inválidos." },
        { status: 400 }
      );
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
          "ver"
        )
      ) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      // hasPermission acima só checa o módulo em geral — sem isto, um
      // usuário sem "processos_ver_todos" baixava em lote os documentos de
      // QUALQUER processo do escritório, não só dos que ele é responsável.
      if (
        !(await podeAcessarEntidade(
          session,
          entityType as EntityType,
          entityId
        ))
      )
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    if (!(await entidadeAtiva(entityType as EntityType, entityId))) {
      return NextResponse.json(
        { error: "Registro não encontrado." },
        { status: 404 }
      );
    }

    selecionados = await getDocumentosByEntityId(
      entityType as EntityType,
      entityId
    );
  }

  if (selecionados.length === 0) {
    return NextResponse.json(
      { error: "Nenhum documento para baixar." },
      { status: 400 }
    );
  }

  const zip = new JSZip();
  const usados = new Set<string>();
  const falhas: string[] = [];

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  for (const doc of selecionados) {
    try {
      // Blob privado exige o header Authorization — head().downloadUrl não
      // é uma URL assinada de verdade (mesmo engano corrigido em
      // /api/documentos/download), então buscar sem o token sempre falhava
      // com 403 aqui, caindo silenciosamente em "falhas" pra todo documento
      // privado do ZIP.
      const headers: Record<string, string> =
        doc.url.includes(".private.blob.vercel-storage.com") && blobToken
          ? { Authorization: `Bearer ${blobToken}` }
          : {};
      const res = await fetch(doc.url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      zip.file(nomeUnico(doc.nome, usados), bytes);
    } catch (err) {
      console.error(`[documentos/download-zip] falha em ${doc.id}:`, err);
      falhas.push(doc.nome);
    }
  }

  if (usados.size === 0) {
    return NextResponse.json(
      { error: "Não foi possível baixar nenhum dos documentos selecionados." },
      { status: 502 }
    );
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const headers: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="documentos.zip"',
  };
  if (falhas.length > 0) {
    headers["X-Falhas"] = encodeURIComponent(falhas.join(", "));
  }
  return new NextResponse(zipBuf as unknown as BodyInit, { headers });
}
