import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { put } from "@vercel/blob";
import sql from "@/lib/db";
import {
  adicionarCidsCliente,
  adicionarPrevbotTriagem,
} from "@/lib/clients-db";

export const dynamic = "force-dynamic";

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = process.env.PREVBOT_API_KEY;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// Vercel tem teto de 4,5MB por corpo de request — 3MB decodificado já
// inflou ~33% em base64 dentro do JSON, folga suficiente pra não estourar.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Separa um ou mais códigos CID-10 de uma string livre — atestado real
 * costuma trazer vários juntos (ex: "I61 + I11.9 + E10.4 + I42.2" ou
 * "I61, I11.9"). Formato de CID-10: uma letra + 2 dígitos, com ponto e
 * mais dígitos opcionais (ex: M51.1).
 */
function extrairCids(raw: string): string[] {
  const matches = raw.match(/[A-Z]\d{2}(?:\.\d+)?/gi) ?? [];
  return [...new Set(matches.map((c) => c.toUpperCase()))];
}

interface Body {
  prevbot_lead_id?: string;
  cpf?: string;
  telefone?: string;
  nome?: string;
  documento_base64?: string;
  mime_type?: string;
  nome_arquivo?: string;
  tipo_documento?: string;
  cid?: string;
  cids?: string[];
  doenca_resumo?: string;
  resumo_conversa?: string;
}

// Resolve o cliente pelos mesmos critérios (e nessa ordem de confiança) do
// /prevbot/contrato: CPF é o identificador mais forte; prevbot_lead_id só
// resolve se aquele lead já virou cliente antes (via crm_leads.client_id);
// telefone é o fallback pra quando a conversa ainda não coletou CPF. Cria
// cliente mínimo só quando nada bate e temos nome+telefone pra isso —
// documento sem cliente nenhum pra anexar não tem o que fazer.
async function resolverCliente(
  body: Body
): Promise<{ clienteId: string } | { error: string }> {
  const cpfDigits = body.cpf ? body.cpf.replace(/\D/g, "") : "";
  if (cpfDigits) {
    const rows = await sql`
      SELECT id::text FROM clients
      WHERE regexp_replace(doc, '\D', '', 'g') = ${cpfDigits} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (rows.length > 0) return { clienteId: String(rows[0].id) };
  }

  if (body.prevbot_lead_id) {
    const rows = await sql`
      SELECT c.id::text FROM crm_leads l
      JOIN clients c ON c.id = l.client_id AND c.deleted_at IS NULL
      WHERE l.prevbot_lead_id = ${body.prevbot_lead_id}
      LIMIT 1
    `;
    if (rows.length > 0) return { clienteId: String(rows[0].id) };
  }

  const telefone = body.telefone ? normalizarTelefone(body.telefone) : "";
  if (telefone) {
    const rows = await sql`
      SELECT id::text FROM clients
      WHERE regexp_replace(phone, '\D', '', 'g') = ${telefone} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (rows.length > 0) return { clienteId: String(rows[0].id) };
  }

  // cep/street/addr_number/neighborhood/city/state são NOT NULL em clients
  // sem default — cliente criado aqui ainda não tem endereço nenhum
  // coletado (é um lead em conversa inicial do PrevBot, diferente do fluxo
  // de contrato em /prevbot/contrato, que só roda depois de endereço
  // completo já ter sido coletado) — '' preenche o obrigatório sem inventar
  // dado, mesmo padrão já usado pra email/doc/phone vazios aqui.
  if (cpfDigits && body.nome) {
    const rows = await sql`
      INSERT INTO clients (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
      VALUES ('PF', ${body.nome}, ${cpfDigits}, '', ${telefone || ""}, '', '', '', '', '', '', 'ativo')
      RETURNING id::text
    `;
    return { clienteId: String(rows[0].id) };
  }
  if (telefone && body.nome) {
    const rows = await sql`
      INSERT INTO clients (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
      VALUES ('PF', ${body.nome}, '', '', ${telefone}, '', '', '', '', '', '', 'ativo')
      RETURNING id::text
    `;
    return { clienteId: String(rows[0].id) };
  }

  return {
    error:
      "Cliente não encontrado. Informe cpf, prevbot_lead_id (de um lead já convertido) ou telefone+nome.",
  };
}

// ── POST /api/integracoes/prevbot/documento-cliente ──────────────────────────
//
// Recebe um documento médico (atestado/exame/receita/laudo) já analisado
// pelo PrevBot durante a conversa no WhatsApp — CID(s), resumo da doença e
// resumo da conversa até aquele ponto — e guarda tudo na área do cliente
// aqui no LiderAdv: o arquivo em Documentos, cada CID em cliente_cids
// (ligado a este documento) e o resumo em clients.prevbot_triagens, pra o
// advogado abrir o caso já sabendo o que foi conversado.
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.cpf && !body.prevbot_lead_id && !body.telefone) {
    return NextResponse.json(
      {
        ok: false,
        error: "Informe ao menos um de: cpf, prevbot_lead_id, telefone.",
      },
      { status: 422 }
    );
  }
  const ext = body.mime_type ? MIME_EXT[body.mime_type] : undefined;
  if (!body.documento_base64 || !ext) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "documento_base64 obrigatório; mime_type deve ser application/pdf, image/jpeg, image/png ou image/webp.",
      },
      { status: 422 }
    );
  }
  if (!body.tipo_documento) {
    return NextResponse.json(
      { ok: false, error: "tipo_documento obrigatório." },
      { status: 422 }
    );
  }

  const bytes = Buffer.from(body.documento_base64, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Documento vazio ou maior que 3MB." },
      { status: 422 }
    );
  }

  try {
    const resolvido = await resolverCliente(body);
    if ("error" in resolvido) {
      return NextResponse.json(
        { ok: false, error: resolvido.error },
        { status: 422 }
      );
    }
    const { clienteId } = resolvido;

    const nomeArquivo = (
      body.nome_arquivo?.trim() || `${body.tipo_documento}.${ext}`
    ).replace(/[/\\]/g, "-");
    const blob = await put(
      `documentos/clientes/${clienteId}/${nomeArquivo}`,
      bytes,
      {
        access: "private",
        contentType: body.mime_type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: true,
      }
    );

    const [documento] = await sql`
      INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
      VALUES ('cliente', ${clienteId}::uuid, ${nomeArquivo}, ${body.mime_type}, ${bytes.byteLength}, ${blob.pathname}, ${blob.url})
      RETURNING id::text
    `;
    const documentoId = String(documento.id);

    const cidsBrutos =
      body.cids && body.cids.length > 0
        ? body.cids
        : body.cid
          ? extrairCids(body.cid)
          : [];
    if (cidsBrutos.length > 0) {
      await adicionarCidsCliente(
        clienteId,
        cidsBrutos.map((cid) => ({
          cid,
          descricao: body.doenca_resumo ?? null,
          medicoNome: null,
          medicoCrm: null,
          dataDocumento: new Date().toISOString().slice(0, 10),
          documentoId,
          origem: "prevbot" as const,
        }))
      );
    }

    await adicionarPrevbotTriagem(clienteId, {
      tipoDocumento: body.tipo_documento ?? null,
      cid: body.cid ?? (cidsBrutos.length > 0 ? cidsBrutos.join(", ") : null),
      doencaResumo: body.doenca_resumo ?? null,
      resumoConversa: body.resumo_conversa ?? null,
      documentoId,
    });

    return NextResponse.json({
      ok: true,
      client_id: clienteId,
      documento_id: documentoId,
    });
  } catch (err) {
    console.error(
      "[prevbot/documento-cliente]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { ok: false, error: "Erro interno ao salvar o documento." },
      { status: 500 }
    );
  }
}
