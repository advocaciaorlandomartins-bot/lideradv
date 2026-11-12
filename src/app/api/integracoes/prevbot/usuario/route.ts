import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { resolvePermissoes } from "@/lib/permissoes";
import type { SessionUser } from "@/lib/session";
import { executarIris } from "@/lib/iris-engine";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { agentesEstaoAtivos } from "@/lib/config-agentes-db";
import { obterConversaRecente } from "@/lib/iris-conversas-db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 2026-11-12: esta rota antes rodava um classificador próprio, bem mais
// simples e limitado que a Íris (só reconhecia agenda/financeiro/pergunta
// genéricos, sem nenhuma das ferramentas reais — não sabia o que era uma
// perícia, um controle, notificar responsável etc.). Isso violava a regra
// permanente do projeto de nunca ter um segundo agente de IA — colaboradores
// com login no LiderAdv falando com o WhatsApp caíam nesse classificador
// "pobre" em vez da Íris de verdade. Agora só resolve a sessão do colaborador
// pelo telefone e chama o mesmo motor usado no chat web (iris-engine.ts) —
// mesmas ferramentas, mesmo prompt, mesmos dados.

// ── Auth ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

// Janela de continuidade: mensagens do mesmo colaborador em menos de 20min
// seguem a mesma conversa (pra perguntas de desambiguação da Íris fazerem
// sentido) — depois disso, considera assunto novo.
const JANELA_CONTINUIDADE_MIN = 20;

// Resolve a sessão (mesmo formato usado pelo cookie de login) a partir do
// telefone de quem mandou a mensagem no WhatsApp — só colaboradores ATIVOS
// com usuário de login vinculado (mesma regra de resolverUsuario anterior).
async function resolverSessionPorTelefone(
  telefone?: string
): Promise<SessionUser | null> {
  if (!telefone) return null;
  const tel = normalizarTelefone(telefone);
  if (!tel) return null;

  const rows = await sql`
    SELECT
      u.id::text          AS id,
      u.login              AS login,
      u.categoria          AS categoria,
      u.permissoes         AS permissoes,
      COALESCE(col.nome, u.login) AS nome
    FROM colaboradores col
    INNER JOIN usuarios u ON u.colaborador_id = col.id AND u.ativo = true
    WHERE col.status = 'ativo'
      AND regexp_replace(col.telefone, '\D', '', 'g') LIKE ${"%" + tel.slice(-9)}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: String(row.id),
    login: String(row.login),
    nome: String(row.nome),
    categoria: String(row.categoria),
    permissoes: resolvePermissoes(
      String(row.categoria),
      (row.permissoes as SessionUser["permissoes"] | null) ?? null
    ),
  };
}

// ── POST /api/integracoes/prevbot/usuario ─────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    texto?: string;
    transcricao?: string;
    imagemBase64?: string;
    imagemMimeType?: string;
    telefone?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const texto = (body.texto ?? body.transcricao ?? "").trim();
  const arquivoBase64 = body.imagemBase64 ?? null;
  // O payload do PrevBot sempre manda em imagemMimeType, mesmo quando o
  // anexo é um PDF (documento) — o nome do campo ficou de quando só existia
  // suporte a imagem, mas o conteúdo pode ser qualquer um dos dois agora.
  const arquivoMimeType = body.imagemMimeType ?? "image/jpeg";
  const ehPdf = arquivoMimeType === "application/pdf";

  if (!texto && !arquivoBase64) {
    return NextResponse.json(
      { error: "Envie 'texto', 'transcricao' ou 'imagemBase64'." },
      { status: 400 }
    );
  }

  if (
    arquivoBase64 &&
    Buffer.byteLength(arquivoBase64, "base64") > 5 * 1024 * 1024
  ) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Limite: 5 MB." },
      { status: 413 }
    );
  }

  const session = await resolverSessionPorTelefone(body.telefone);
  if (!session) {
    return NextResponse.json({
      ok: false,
      acao: "colaborador_nao_encontrado",
      resposta:
        "⚠️ Não encontrei um cadastro de colaborador com esse telefone no LiderAdv. Peça pra um administrador conferir o cadastro.",
    });
  }

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json({
      ok: false,
      acao: "limite_excedido",
      resposta:
        "⚠️ Muitas mensagens em pouco tempo — aguarde um pouco antes de mandar outra.",
    });
  }

  if (!(await agentesEstaoAtivos())) {
    return NextResponse.json({
      ok: false,
      acao: "agentes_pausados",
      resposta:
        "⚠️ Os agentes de IA estão pausados temporariamente. Fale com um administrador.",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userContent: string | any[] = texto;
  const anexosMeta: { nome: string; mimeType: string }[] = [];
  const textoEfetivo =
    texto || (arquivoBase64 ? "(arquivo anexado, sem texto)" : "");
  if (arquivoBase64) {
    userContent = [
      ehPdf
        ? {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: arquivoBase64,
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: arquivoMimeType,
              data: arquivoBase64,
            },
          },
      {
        type: "text",
        text:
          texto || "Analise este arquivo e me diga o que precisa ser feito.",
      },
    ];
    anexosMeta.push({
      nome: ehPdf ? "documento-whatsapp.pdf" : "imagem-whatsapp",
      mimeType: arquivoMimeType,
    });
  }

  const conversaIdInformado = await obterConversaRecente(
    session.id,
    JANELA_CONTINUIDADE_MIN
  ).catch(() => null);

  try {
    const resultado = await executarIris({
      session,
      text: textoEfetivo,
      userContent,
      anexosMeta,
      anexosRequest: [], // sem URL de Blob — não salva automaticamente no arquivo do cliente
      conversaIdInformado,
      paginaCliente: null,
      temPdf: ehPdf,
      rotaUso: "whatsapp",
    });
    return NextResponse.json({
      ok: true,
      acao: "iris",
      resposta: resultado.reply,
    });
  } catch (err) {
    console.error(
      "[prevbot/usuario] erro ao executar Íris:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({
      ok: false,
      acao: "erro",
      resposta:
        "⚠️ Tive um problema pra processar sua mensagem agora. Tente de novo em instantes.",
    });
  }
}
