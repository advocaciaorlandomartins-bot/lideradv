import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import {
  agendarLembretesCompromissoPrevBot,
  agendarLembretesContaPendente,
} from "@/lib/lembretes";

export const dynamic = "force-dynamic";

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

function hojeISO(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

function formatarMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataPT(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

// Resolve usuário a partir do telefone (via colaboradores) ou cai no admin
async function resolverUsuario(telefone?: string): Promise<{
  usuarioId: string;
  usuarioLogin: string;
  colaboradorNome: string;
}> {
  if (telefone) {
    const tel = normalizarTelefone(telefone);
    const rows = await sql`
      SELECT
        u.id::text                        AS usuario_id,
        u.login                           AS usuario_login,
        COALESCE(col.nome, u.login)       AS colaborador_nome
      FROM colaboradores col
      INNER JOIN usuarios u ON u.colaborador_id = col.id AND u.ativo = true
      WHERE col.status = 'ativo'
        AND regexp_replace(col.telefone, '\D', '', 'g') LIKE ${"%" + tel.slice(-9)}
      LIMIT 1
    `;
    if (rows.length > 0) {
      return {
        usuarioId: String(rows[0].usuario_id),
        usuarioLogin: String(rows[0].usuario_login),
        colaboradorNome: String(rows[0].colaborador_nome),
      };
    }
  }

  // Fallback: primeiro admin ativo
  const rows = await sql`
    SELECT id::text AS usuario_id, login AS usuario_login, login AS colaborador_nome
    FROM usuarios
    WHERE categoria = 'admin' AND ativo = true
    ORDER BY id LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Nenhum usuário encontrado");
  return {
    usuarioId: String(rows[0].usuario_id),
    usuarioLogin: String(rows[0].usuario_login),
    colaboradorNome: String(rows[0].colaborador_nome),
  };
}

// ── Prompt Claude ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Você é um assistente que extrai informações de mensagens de WhatsApp de um advogado para registrar no sistema LiderAdv.

Hoje é ${hoje}. Ano atual: ${new Date().getFullYear()}.

Retorne SOMENTE JSON válido, sem texto extra, sem blocos de código.

INTENÇÕES POSSÍVEIS:

1. Gasto/despesa/pagamento já feito → "despesa"
2. Receita/recebimento já recebido → "receita"
3. Conta/despesa futura ainda não paga → "despesa_pendente"
4. Agendar compromisso/reunião/consulta → "agenda"
5. Não identificado → "desconhecido"

FORMATOS DE RESPOSTA:

Para despesa (já paga):
{"intent":"despesa","valor":150.00,"categoria":"Cartório","descricao":"Taxa de registro","data":"YYYY-MM-DD","status":"pago"}

Para receita (já recebida):
{"intent":"receita","valor":2000.00,"categoria":"Honorário advocatício","descricao":"Honorário caso Silva","data":"YYYY-MM-DD","status":"recebido"}

Para despesa pendente:
{"intent":"despesa","valor":500.00,"categoria":"Aluguel","descricao":"Aluguel sala advocacia","data":"YYYY-MM-DD","status":"pendente"}

Para agenda:
{"intent":"agenda","titulo":"Reunião com cliente","tipo":"reuniao","data":"YYYY-MM-DD","hora":"14:00","local":"Escritório","descricao":"Assunto da reunião"}

Para não identificado:
{"intent":"desconhecido"}

REGRAS:
- Se valor em texto ("cem reais", "duzentos e cinquenta"), converta para número
- Se data não mencionada, use hoje (${hojeISO()})
- "tipo" da agenda: reuniao | consulta | videochamada | fechamento | outro
- status financeiro: "pago" ou "recebido" = já aconteceu; "pendente" ou "a_receber" = ainda vai acontecer
- Categorias comuns de despesa: Cartório, Transporte, Processo judicial, Escritório, Aluguel, Telefone, Internet, Material escritório, Alimentação, Combustível, Estacionamento
- Categorias comuns de receita: Honorário advocatício, Consultoria, Acordo judicial, RPV, Precatório`;
}

type AIResult =
  | {
      intent: "despesa" | "receita";
      valor: number;
      categoria: string;
      descricao: string;
      data: string;
      status: string;
    }
  | {
      intent: "agenda";
      titulo: string;
      tipo: string;
      data: string;
      hora?: string;
      local?: string;
      descricao?: string;
    }
  | { intent: "desconhecido" };

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
  const imagemBase64 = body.imagemBase64 ?? null;
  const imagemMimeType = (body.imagemMimeType ??
    "image/jpeg") as Anthropic.Base64ImageSource["media_type"];

  if (!texto && !imagemBase64) {
    return NextResponse.json(
      { error: "Envie 'texto', 'transcricao' ou 'imagemBase64'." },
      { status: 400 }
    );
  }

  if (
    imagemBase64 &&
    Buffer.byteLength(imagemBase64, "base64") > 5 * 1024 * 1024
  ) {
    return NextResponse.json(
      { error: "Imagem muito grande. Limite: 5 MB." },
      { status: 413 }
    );
  }

  try {
    // Resolve o usuário pelo telefone (ou cai no admin como fallback)
    const { usuarioId, usuarioLogin, colaboradorNome } = await resolverUsuario(
      body.telefone
    );

    // Monta conteúdo para o Claude
    const userContent: Anthropic.MessageParam["content"] = [];

    if (imagemBase64) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imagemMimeType,
          data: imagemBase64,
        },
      });
      userContent.push({
        type: "text",
        text:
          texto ||
          "Analise esta imagem e extraia informações financeiras ou de agenda.",
      });
    } else {
      userContent.push({ type: "text", text: texto });
    }

    // Chama Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiResp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: userContent }],
    });

    const rawText =
      aiResp.content[0].type === "text" ? aiResp.content[0].text.trim() : "{}";

    let result: AIResult;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      result = JSON.parse(match?.[0] ?? "{}") as AIResult;
    } catch {
      result = { intent: "desconhecido" };
    }

    // ── FINANCEIRO ───────────────────────────────────────────────────────────

    if (result.intent === "despesa" || result.intent === "receita") {
      const valor = Number(result.valor ?? 0);
      if (valor <= 0) {
        return NextResponse.json({
          ok: false,
          acao: "erro_valor",
          resposta:
            "⚠️ Não consegui identificar o valor.\n\nTente:\n• _gastei R$150 com cartório_\n• _recebi R$2000 de honorário_",
        });
      }

      const tipo = result.intent === "receita" ? "receita" : "despesa";
      const categoria = String(result.categoria ?? "Outros");
      const descricao = String(result.descricao ?? texto.slice(0, 120));
      const data = String(result.data ?? hojeISO());
      const statusRaw = String(result.status ?? "pago");
      const status =
        tipo === "receita"
          ? statusRaw === "a_receber"
            ? "a_receber"
            : "recebido"
          : statusRaw === "pendente"
            ? "pendente"
            : "pago";

      const [row] = await sql`
        INSERT INTO meu_financeiro_lancamentos
          (usuario_id, tipo, categoria, descricao, valor, data, status)
        VALUES
          (${usuarioId}::uuid, ${tipo}, ${categoria}, ${descricao},
           ${valor}, ${data}::date, ${status})
        RETURNING id::text
      `;

      // Agenda lembrete de vencimento para despesas pendentes
      if (status === "pendente" && body.telefone) {
        await agendarLembretesContaPendente({
          lancamentoId: String((row as { id: string }).id),
          descricao,
          valor,
          dataVencimento: new Date(data + "T12:00:00"),
          colaboradorTelefone: normalizarTelefone(body.telefone),
          colaboradorNome,
        }).catch((e) => console.error("[prevbot/lembrete-conta]", e));
      }

      const icone = tipo === "receita" ? "💰" : "💸";
      const tipoLabel = tipo === "receita" ? "Receita" : "Despesa";
      const valorFmt = formatarMoeda(valor);
      const dataFmt = formatarDataPT(data);
      const statusLabel =
        status === "recebido" || status === "pago"
          ? "registrado como recebido ✅"
          : "registrado como pendente ⏳";

      return NextResponse.json({
        ok: true,
        acao: tipo === "receita" ? "receita_criada" : "despesa_criada",
        id: String((row as { id: string }).id),
        resposta:
          `${icone} *${tipoLabel} registrada!*\n\n` +
          `📝 ${descricao}\n` +
          `💵 ${valorFmt}\n` +
          `📅 ${dataFmt}\n` +
          `🏷️ ${categoria}\n\n` +
          `_${statusLabel}_\n\n` +
          `Acesse *Meu Financeiro* no LiderAdv para ver todos os lançamentos.`,
      });
    }

    // ── AGENDA ───────────────────────────────────────────────────────────────

    if (result.intent === "agenda") {
      const titulo = String(result.titulo ?? texto.slice(0, 80));
      const tipo = String(result.tipo ?? "outro");
      const data = String(result.data ?? hojeISO());
      const hora = result.hora ? String(result.hora) : null;
      const local = result.local ? String(result.local) : null;
      const descricao = result.descricao ? String(result.descricao) : null;

      const [comp] = await sql`
        INSERT INTO compromissos
          (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, cor, criado_por)
        VALUES
          (${titulo}, ${tipo}, ${data}::date, ${hora}, ${local},
           ${descricao}, '#0ea5e9', ${usuarioLogin})
        RETURNING id::text
      `;

      const dataFmt = formatarDataPT(data);
      const compId = String((comp as { id: string }).id);

      // Agenda lembretes D-1 e no dia para o colaborador
      if (body.telefone) {
        await agendarLembretesCompromissoPrevBot({
          compromissoId: compId,
          titulo,
          dataEvento: new Date(data + "T12:00:00"),
          hora,
          local,
          colaboradorTelefone: normalizarTelefone(body.telefone),
          colaboradorNome,
        }).catch((e) => console.error("[prevbot/lembrete-comp]", e));
      }

      return NextResponse.json({
        ok: true,
        acao: "compromisso_criado",
        id: compId,
        resposta:
          `📅 *Compromisso agendado!* ✅\n\n` +
          `📌 ${titulo}\n` +
          `🗓️ ${dataFmt}${hora ? ` às ${hora}` : ""}\n` +
          (local ? `📍 ${local}\n` : "") +
          (descricao ? `📝 ${descricao}\n` : "") +
          `\n_Visível na Agenda do LiderAdv._`,
      });
    }

    // ── NÃO IDENTIFICADO ─────────────────────────────────────────────────────

    return NextResponse.json({
      ok: false,
      acao: "desconhecido",
      resposta:
        "Não entendi a mensagem. 🤔\n\nExemplos que funcionam:\n\n" +
        "💸 *Despesa:* _gastei R$150 com cartório hoje_\n" +
        "💰 *Receita:* _recebi R$2000 de honorário do processo Silva_\n" +
        "📅 *Agenda:* _agende consulta com João sexta às 14h no escritório_\n\n" +
        "Pode enviar texto, áudio ou foto de comprovante/nota fiscal.",
    });
  } catch (err) {
    console.error(
      "[prevbot/usuario]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro interno ao processar mensagem." },
      { status: 500 }
    );
  }
}
