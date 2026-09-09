import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";
import {
  agendarLembretesCompromissoPrevBot,
  agendarLembretesContaPendente,
} from "@/lib/lembretes";
import {
  listarCompromissosProximos,
  TIPO_LABELS_COMP,
} from "@/lib/compromissos-db";

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

interface LancamentoResumo {
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
}

// Monta o retrato atual da agenda e do financeiro do usuário para dar à IA
// dados reais pra responder perguntas ("de quem é a avaliação do dia 21?",
// "quanto eu gastei esse mês?") em vez de só reconhecer frases decoradas.
function formatarContextoAtual(
  compromissos: Awaited<ReturnType<typeof listarCompromissosProximos>>,
  lancamentos: LancamentoResumo[]
): string {
  const linhasAgenda = compromissos.length
    ? compromissos
        .map((c) => {
          const label = TIPO_LABELS_COMP[c.tipo] ?? c.tipo;
          const clienteStr = c.cliente_nome
            ? `, cliente: ${c.cliente_nome}`
            : "";
          const horaStr = c.hora_inicio ? ` ${c.hora_inicio}` : "";
          return `- [${c.data_inicio}${horaStr}] ${c.titulo} (tipo: ${label}${clienteStr})`;
        })
        .join("\n")
    : "(nenhum compromisso agendado nos próximos 30 dias)";

  const anoMesAtual = hojeISO().slice(0, 7);
  const totalDespesasMes = lancamentos
    .filter((l) => l.tipo === "despesa" && l.data.slice(0, 7) === anoMesAtual)
    .reduce((s, l) => s + l.valor, 0);
  const totalReceitasMes = lancamentos
    .filter((l) => l.tipo === "receita" && l.data.slice(0, 7) === anoMesAtual)
    .reduce((s, l) => s + l.valor, 0);

  const linhasFinanceiro = lancamentos.length
    ? lancamentos
        .map((l) => {
          const tipoLabel = l.tipo === "receita" ? "Receita" : "Despesa";
          return `- [${l.data}] ${tipoLabel}: ${l.descricao} — ${formatarMoeda(l.valor)} (${l.categoria}, status: ${l.status})`;
        })
        .join("\n")
    : "(nenhum lançamento nos últimos 60 dias)";

  return `DADOS ATUAIS DO USUÁRIO (use para responder com precisão — não invente o que não estiver aqui; se não encontrar, diga que não encontrou):

Compromissos agendados (próximos 30 dias):
${linhasAgenda}

Lançamentos financeiros (últimos 60 dias):
${linhasFinanceiro}

Total de despesas neste mês (${anoMesAtual}): ${formatarMoeda(totalDespesasMes)}
Total de receitas neste mês (${anoMesAtual}): ${formatarMoeda(totalReceitasMes)}`;
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

function buildSystemPrompt(contextoAtual: string): string {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const agoraHora = new Date().toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Você é a secretária pessoal (por WhatsApp) de um advogado que usa o sistema LiderAdv. Sua função não é só registrar dados — é entender o que foi pedido ou perguntado e responder como uma secretária de verdade responderia, usando os dados reais abaixo sempre que a pergunta for sobre algo que já existe (agenda ou financeiro).

Hoje é ${hoje}, agora são ${agoraHora}. Ano atual: ${new Date().getFullYear()}.

Retorne SOMENTE JSON válido, sem texto extra, sem blocos de código.

INTENÇÕES POSSÍVEIS:

1. Gasto/despesa/pagamento já feito → "despesa"
2. Receita/recebimento já recebido → "receita"
3. Conta/despesa futura ainda não paga → "despesa_pendente"
4. Agendar QUALQUER compromisso, tarefa ou lembrete com dia/hora — profissional
   (reunião, consulta, audiência) OU pessoal (tomar remédio, ir dormir, acordar,
   ligar pra alguém, levar o carro na oficina, etc.) → "agenda". Se tem uma ação
   e um horário/dia, é "agenda" — não precisa ser compromisso de escritório.
5. QUALQUER pergunta sobre algo que JÁ EXISTE — agenda ("de quem é a avaliação
   do dia 21", "que horas é minha reunião de amanhã", "tenho algo marcado
   sexta?", "me manda meus compromissos", "onde é a consulta de quinta") OU
   financeiro ("quanto eu gastei esse mês", "quanto já recebi de honorário",
   "quanto gastei com combustível") → "pergunta". Responda usando os DADOS
   ATUAIS DO USUÁRIO fornecidos abaixo. Isso é uma CONSULTA (não cria nada
   novo) — diferente de "agenda"/"despesa"/"receita", que CRIAM algo novo.
6. Cumprimento, agradecimento, confirmação ou conversa social — "oi", "bom
   dia", "obrigado", "valeu", "de nada", "ok", "beleza", "👍" → "social".
   Responda com uma frase curta e simpática de secretária de verdade (não
   use a lista de exemplos genérica aqui).
7. Só use "desconhecido" quando a mensagem realmente não tiver NENHUMA ação,
   valor, horário, pergunta ou intenção social identificável.

FORMATOS DE RESPOSTA:

Para despesa (já paga):
{"intent":"despesa","valor":150.00,"categoria":"Cartório","descricao":"Taxa de registro","data":"YYYY-MM-DD","status":"pago"}

Para receita (já recebida):
{"intent":"receita","valor":2000.00,"categoria":"Honorário advocatício","descricao":"Honorário caso Silva","data":"YYYY-MM-DD","status":"recebido"}

Para despesa pendente:
{"intent":"despesa","valor":500.00,"categoria":"Aluguel","descricao":"Aluguel sala advocacia","data":"YYYY-MM-DD","status":"pendente"}

Para agenda:
{"intent":"agenda","titulo":"Avaliação médica - Maria Silva","tipo":"consulta","data":"YYYY-MM-DD","hora":"14:00","local":"Escritório","descricao":"Assunto da reunião","pessoa":"Maria Silva"}

Para pergunta sobre agenda ou financeiro (usando os DADOS ATUAIS DO USUÁRIO):
{"intent":"pergunta","resposta":"📅 A avaliação do dia 21/09 às 14h é da cliente Maria Silva."}

Para cumprimento/agradecimento/conversa social:
{"intent":"social","resposta":"De nada! 😊 Qualquer coisa é só chamar."}

Para não identificado:
{"intent":"desconhecido"}

REGRAS:
- "titulo" da agenda deve SEMPRE incluir o nome da pessoa quando um nome for
  mencionado (ex.: "Avaliação - Maria Silva", nunca só "Avaliação" sozinho).
- "pessoa": nome da pessoa/cliente envolvida no compromisso, se houver (usado
  para localizar depois quem é o compromisso — repita o nome já usado no título).
- Para "pergunta": responda com um texto pronto pra WhatsApp (pode usar
  emojis), respondendo diretamente com base nos DADOS ATUAIS DO USUÁRIO
  fornecidos no fim deste prompt. Se a informação pedida não estiver nos
  dados fornecidos, diga claramente que não encontrou e peça mais detalhes
  (data exata, nome) — NUNCA invente valor, data, hora ou nome de cliente.
- Se valor em texto ("cem reais", "duzentos e cinquenta"), converta para número
- Se data não mencionada, use hoje (${hojeISO()})
- ATENÇÃO especial com fotos de contas (energia, água, telefone, internet): elas
  sempre trazem um "mês de referência/competência" (ex: "Referente a 07/2026",
  "Competência: Julho/2026") — isso é o PERÍODO CONSUMIDO, NUNCA a data do
  pagamento. NÃO use esse mês/ano como "data". Use "data" = hoje (${hojeISO()}),
  a menos que a mensagem ou a foto mostrem explicitamente uma data de
  pagamento/quitação diferente (ex.: "paguei dia 15/08", comprovante com data
  e horário da transação, código de autenticação bancária com data).
- "tipo" da agenda: reuniao | consulta | videochamada | fechamento | outro
  ("outro" cobre lembretes pessoais — remédio, dormir, ligações, tarefas etc.)
- Expressões de horário: "meia-noite" = 00:00, "meio-dia" = 12:00. Se só o
  horário for dado sem data (ex.: "às 21h", "meia-noite"), use hoje — a menos
  que o horário já tenha passado hoje, aí use amanhã.
- status financeiro: "pago" ou "recebido" = já aconteceu; "pendente" ou "a_receber" = ainda vai acontecer
- Categorias comuns de despesa: Cartório, Transporte, Processo judicial, Escritório, Aluguel, Energia elétrica, Água/Saneamento, Telefone, Internet, Material escritório, Alimentação, Combustível, Estacionamento
- Categorias comuns de receita: Honorário advocatício, Consultoria, Acordo judicial, RPV, Precatório

${contextoAtual}`;
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
      pessoa?: string;
    }
  | { intent: "pergunta"; resposta: string }
  | { intent: "social"; resposta: string }
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

    // Retrato atual da agenda e do financeiro — dá à IA dados reais pra
    // responder perguntas, em vez de só reconhecer frases específicas.
    const [proximosCompromissos, lancamentosRows] = await Promise.all([
      listarCompromissosProximos(usuarioLogin, 30),
      sql`
        SELECT tipo, categoria, descricao, valor, data::text AS data, status
        FROM meu_financeiro_lancamentos
        WHERE usuario_id = ${usuarioId}::uuid
          AND data >= CURRENT_DATE - INTERVAL '60 days'
        ORDER BY data DESC
        LIMIT 60
      `,
    ]);
    const lancamentosResumo: LancamentoResumo[] = lancamentosRows.map((r) => ({
      tipo: String(r.tipo),
      categoria: String(r.categoria),
      descricao: String(r.descricao),
      valor: Number(r.valor),
      data: String(r.data),
      status: String(r.status),
    }));
    const contextoAtual = formatarContextoAtual(
      proximosCompromissos,
      lancamentosResumo
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
      system: buildSystemPrompt(contextoAtual),
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
      const pessoa = result.pessoa ? String(result.pessoa).trim() : "";

      // Tenta vincular a um cliente já cadastrado pelo nome mencionado, pra
      // "de quem é esse compromisso" ter resposta certa depois (via "pergunta").
      let clienteId: string | null = null;
      if (pessoa) {
        const matches = await sql`
          SELECT id::text FROM clients
          WHERE name ILIKE ${"%" + pessoa + "%"} AND deleted_at IS NULL
          LIMIT 2
        `;
        if (matches.length === 1) clienteId = String(matches[0].id);
      }

      const [comp] = await sql`
        INSERT INTO compromissos
          (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, cor, criado_por, cliente_id)
        VALUES
          (${titulo}, ${tipo}, ${data}::date, ${hora}, ${local},
           ${descricao}, '#0ea5e9', ${usuarioLogin}, ${clienteId}::uuid)
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

    // ── PERGUNTA (agenda ou financeiro) ────────────────────────────────────────

    if (result.intent === "pergunta") {
      const resposta = String(result.resposta ?? "").trim();
      return NextResponse.json({
        ok: true,
        acao: "pergunta_respondida",
        resposta:
          resposta ||
          "🤔 Não encontrei essa informação nos seus dados. Pode me dar mais detalhes (data exata ou nome)?",
      });
    }

    // ── SOCIAL (cumprimento, agradecimento, conversa) ──────────────────────────

    if (result.intent === "social") {
      const resposta = String(result.resposta ?? "").trim();
      return NextResponse.json({
        ok: true,
        acao: "social",
        resposta: resposta || "😊",
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
        "📅 *Agenda:* _agende consulta com João sexta às 14h no escritório_\n" +
        "🗓️ *Ver agenda:* _me manda meus compromissos_\n\n" +
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
