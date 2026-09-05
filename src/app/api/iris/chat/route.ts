import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { buildIrisContextText } from "@/lib/iris-context";
import {
  IRIS_TOOLS,
  IRIS_TOOL_LABELS,
  executarFerramentaIris,
} from "@/lib/iris-tools";
import { LIDERADV_DOCS } from "@/lib/lideradv-docs";
import {
  obterConversa,
  criarConversa,
  listarMensagens,
  inserirMensagem,
  type AnexoMeta,
  type ToolTraceItem,
} from "@/lib/iris-conversas-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_CHARS_TEXTO = 8000;
const MAX_LOOP = 6;
const MAX_ARQUIVOS = 3;
const MIME_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

interface AnexoRequest {
  url: string;
  nome: string;
  mimeType: string;
}

// Nunca confiar numa URL arbitrária vinda do cliente pra não virar um proxy
// de download de qualquer coisa — mesmo helper já usado em
// /api/ia/analisar. addRandomSuffix no upload já torna a URL imprevisível,
// isso aqui só garante que é mesmo um blob nosso.
function isUrlPermitida(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    return (
      host === "blob.vercel-storage.com" ||
      host.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

// Blobs privados exigem o token de leitura/escrita no header — sem isso o
// fetch volta 403. Mesmo helper já usado em cerebroJuridico.ts e
// /api/ia/quesitos e /api/ia/analisar pra ler documento já anexado.
async function fetchBlobContent(url: string): Promise<Response | null> {
  if (url.includes(".private.blob.vercel-storage.com")) {
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

  const attachmentsRaw = Array.isArray(body.attachments)
    ? (body.attachments as unknown[])
    : [];
  const anexosRequest: AnexoRequest[] = attachmentsRaw
    .filter(
      (a): a is AnexoRequest =>
        !!a &&
        typeof a === "object" &&
        typeof (a as AnexoRequest).url === "string" &&
        typeof (a as AnexoRequest).nome === "string" &&
        typeof (a as AnexoRequest).mimeType === "string"
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

  // Conversa: reaproveita uma existente (dona do usuário logado). A criação
  // de uma conversa nova é adiada até termos uma resposta de fato (mais
  // abaixo) — criar aqui deixaria uma conversa "fantasma" sem mensagens se
  // a chamada à Anthropic falhar logo na primeira mensagem.
  let conversaId: string | null = null;
  let historico: Anthropic.MessageParam[] = [];
  if (conversaIdInformado) {
    const conversa = await obterConversa(session.id, conversaIdInformado);
    if (!conversa)
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
    conversaId = conversa.id;
    const mensagens = await listarMensagens(conversaId);
    historico = mensagens.map((m) => ({ role: m.role, content: m.content }));
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
  const anexosMeta: AnexoMeta[] = [];
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

  const currentMessages: Anthropic.MessageParam[] = [
    ...historico,
    { role: "user", content: userContent },
  ];

  const ehAdmin = hasPermission(session, "configuracoes", "editar");
  const contexto = await buildIrisContextText(session);

  const systemPrompt = `Você é Íris, a única assistente de IA do sistema LiderAdv (plataforma de gestão para escritórios de advocacia previdenciária). Você é responsável por TUDO relacionado a IA no sistema: tirar dúvidas de uso, mostrar dados reais e atuais do escritório (agenda, equipe, financeiro, produtividade), analisar documentos anexados na conversa e executar ações reais quando autorizada.

REGRAS GERAIS:
- Sobre COMO USAR O SISTEMA (telas, botões, campos, fluxos): responda SOMENTE com base na documentação abaixo. Nunca invente funcionalidade que não está documentada. Se não souber, diga que não tem essa informação.
- Sobre DADOS REAIS (agenda, equipe, ranking, financeiro, risco de processos): responda SOMENTE com base no que está no contexto de dados abaixo ou no que as ferramentas retornarem. Nunca invente compromisso, cliente, processo ou valor.
- ANTES de dizer "não tenho essa informação" ou "não consigo verificar": pare e pense se existe uma ferramenta que resolveria (consultar_financeiro, listar_processos_risco, consultar_analise_cerebro, obter_estatisticas, verificar_saude, listar_oabs, ver_erros, listar_etiquetas, adicionar_etiqueta) — se existir, USE a ferramenta primeiro. Só diga que não tem a informação depois de tentar (ou se realmente não existir ferramenta/dado pra isso). ${ehAdmin ? "Este usuário é ADMINISTRADOR com acesso total — nunca recuse ou limite uma resposta por achar que ele não teria permissão; a única razão válida pra não responder algo é o dado genuinamente não existir ou não estar disponível em nenhuma ferramenta." : "Algumas seções de dados podem aparecer como indisponíveis pro perfil deste usuário — isso é intencional (mesma regra de permissão das telas do sistema), informe isso ao invés de inventar."}
- Quando o usuário disser que algo "não aparece na tela", "deu erro" ou "não está funcionando": não responda genericamente. (1) Releia a DOCUMENTAÇÃO abaixo pra achar exatamente em qual menu/aba/botão aquilo deveria estar e diga o caminho exato (ex: "Jurídico → Processos → aba Documentos → botão Processar INSS"); (2) se for algo que uma ferramenta consegue checar de verdade (erros do sistema, saúde dos componentes, status de sincronização), rode verificar_saude e/ou ver_erros ANTES de responder, não só descreva onde clicar; (3) se depois disso ainda não achar nada que explique o problema, diga isso explicitamente ("não encontrei esse item na documentação nem nada de errado nos diagnósticos — pode ser um bug real, vale reportar") em vez de simplesmente admitir derrota sem ter checado nada.
- Se um item de agenda/dado aparecer sem responsável definido no sistema, diga isso claramente ("sem responsável cadastrado") — não invente um nome.
- Itens de agenda marcados "[PRAZO FATAL]" no contexto são prazos que, se perdidos, encerram o direito do cliente — SEMPRE destaque esses primeiro e com ênfase quando listar agenda, mesmo que não estejam mais próximos que os demais.
- Sobre AÇÕES REAIS (sincronizar, reenviar mensagem, mexer em OAB, mudar dados do escritório): use as ferramentas disponíveis. ${ehAdmin ? "Este usuário TEM permissão de administrador — pode executar." : "Este usuário NÃO tem permissão de administrador — se a ferramenta retornar erro de permissão, explique isso educadamente e não insista."}
- Sobre RISCO/PROBABILIDADE DE ÊXITO de processos: use as ferramentas listar_processos_risco e consultar_analise_cerebro — elas trazem o que o Cérebro Jurídico já analisou de cada caso (risco, % de êxito, próxima ação, base legal). Nunca estime risco de cabeça; sempre consulte essas ferramentas.
- NUNCA invente ou fantasie base legal: cite artigo de lei, súmula, precedente ou tese jurídica apenas quando tiver certeza real de que existe e está vigente/atualizada. Se não tiver certeza absoluta de uma citação, diga isso explicitamente em vez de inventar um número de lei, súmula ou acórdão — a mesma disciplina que o Cérebro Jurídico e o gerador de petições (Dr. Lex) já seguem no resto do sistema.
- Sobre PETIÇÕES e teses jurídicas de um caso específico: primeiro consulte consultar_analise_cerebro/listar_processos_risco pra trazer o que o Cérebro Jurídico já apurou daquele processo (base legal, jurisprudência, tese) — construa a resposta em cima disso, não do zero. Se o usuário quiser a peça pronta em PDF, oriente a abrir o processo → painel "IA Jurídica" → Passo 3 "Gerar Petição" (IA Dr. Lex), que já é grounded nos dados reais do caso; no chat você pode orientar estratégia e revisar teses, mas não redija uma peça inteira "às cegas" sem esse grounding.
- Perguntas de direito, jurisprudência ou fora do sistema em geral (sem relação com um caso real do escritório): diga que isso não é sua função.
- FORMATAÇÃO: use markdown quando ajudar a organizar a resposta — títulos (##/###), **negrito** pra destacar termos, prazos e conclusões, e listas numeradas ou com marcadores. Não force formatação em respostas curtas de uma frase; use pra respostas longas, comparações e principalmente pra análise de documentos.
- ANÁLISE DE DOCUMENTOS ANEXADOS: quando o usuário anexar PDF ou imagem pedindo análise, leia tudo com atenção e estruture a resposta em seções claras (ex: o que foi encontrado, ponto crítico, possibilidades, recomendação) citando trechos, datas e números concretos dos documentos — nunca genérico. Se faltar informação para concluir algo com segurança, diga exatamente o que falta.
- HISTÓRICO: cada conversa fica salva (botão de relógio/histórico na tela) e pode ser retomada depois; um botão "Nova conversa" inicia outra do zero. Se o usuário perguntar se você "lembra" de algo de outra conversa: você só enxerga o histórico da conversa atualmente aberta, não de outras conversas salvas — oriente a abrir a conversa antiga pelo histórico se for isso que ele quer.
- Seja direta e organizada — liste itens por data quando fizer sentido, cite nomes e números concretos, sem enrolação.

━━━━━━━━━━━━━━━━━━━━━━━━
DADOS ATUAIS DO ESCRITÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━
${contexto}

━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTAÇÃO DO SISTEMA (como usar cada tela)
━━━━━━━━━━━━━━━━━━━━━━━━
${LIDERADV_DOCS}`;

  const toolTrace: ToolTraceItem[] = [];

  try {
    for (let i = 0; i < MAX_LOOP; i++) {
      const response = await client.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          temperature: 0,
          system: systemPrompt,
          tools: IRIS_TOOLS,
          messages: currentMessages,
        },
        temPdf
          ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } }
          : undefined
      );

      if (response.stop_reason === "tool_use") {
        currentMessages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            toolTrace.push({
              name: block.name,
              label: IRIS_TOOL_LABELS[block.name] ?? block.name,
            });
            const result = await executarFerramentaIris(
              session,
              block.name,
              block.input as Record<string, string>
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }
        currentMessages.push({ role: "user", content: toolResults });
        continue;
      }

      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      if (!conversaId) conversaId = await criarConversa(session.id, text);
      await inserirMensagem(
        conversaId,
        "user",
        text,
        anexosMeta.length ? anexosMeta : null,
        null
      );
      await inserirMensagem(
        conversaId,
        "assistant",
        reply,
        null,
        toolTrace.length ? toolTrace : null
      );

      return NextResponse.json({ reply, conversaId, toolTrace });
    }
  } catch (err) {
    console.error("[iris/chat] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar resposta. Tente novamente." },
      { status: 500 }
    );
  }

  const fallback = "Não consegui completar a operação. Tente novamente.";
  if (!conversaId) conversaId = await criarConversa(session.id, text);
  await inserirMensagem(
    conversaId,
    "user",
    text,
    anexosMeta.length ? anexosMeta : null,
    null
  );
  await inserirMensagem(
    conversaId,
    "assistant",
    fallback,
    null,
    toolTrace.length ? toolTrace : null
  );
  return NextResponse.json({ reply: fallback, conversaId, toolTrace });
}
