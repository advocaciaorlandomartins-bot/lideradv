/**
 * GET /api/cron/atualizacoes-legais
 * Executa diariamente às 08:30 BRT (seg-sáb).
 *
 * FONTES (em cascata — usa o que estiver disponível):
 *  1. DOU via InLabs  — requer env DOU_INLABS_KEY (inlabs.in.gov.br)
 *  2. INSS Notícias   — RSS público gov.br, sem chave (sempre ativo)
 *  3. Previdência     — RSS público gov.br, sem chave (sempre ativo)
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── DOU via InLabs (requer chave) ───────────────────────────────────────────

const TERMOS_DOU = [
  "INSS benefício",
  "instrução normativa INSS",
  "portaria previdência social",
  "salário mínimo decreto",
  "auxílio-doença aposentadoria",
  "BPC LOAS deficiência",
];

interface DouArticle {
  id_materia?: string;
  titulo?: string;
  subtitulo?: string;
  txt?: string;
  identifica?: string;
  fullUrl?: string;
  urlTitle?: string;
  pubDate?: string;
  pubName?: string;
  nome_orgao?: string;
}

async function buscarDOU(termo: string, data: string): Promise<DouArticle[]> {
  const key = process.env.DOU_INLABS_KEY;
  if (!key) return [];

  const url = new URL("https://inlabs.in.gov.br/openapi.php");
  url.searchParams.set("chave", key);
  url.searchParams.set("edicao", data);
  url.searchParams.set("campo", "texto");
  url.searchParams.set("q", termo);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

// ─── RSS gov.br (sem chave) ───────────────────────────────────────────────────

interface RssItem {
  titulo: string;
  link: string;
  descricao: string;
  pubDate: string;
  fonte: string;
}

function parseRssItems(xml: string, fonte: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const bloco = match[1];
    const titulo =
      bloco.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ??
      bloco.match(/<title>(.*?)<\/title>/i)?.[1] ??
      "";
    const link =
      bloco.match(/<link>(.*?)<\/link>/i)?.[1] ??
      bloco.match(/<guid>(.*?)<\/guid>/i)?.[1] ??
      "";
    const descricao =
      bloco.match(
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i
      )?.[1] ??
      bloco.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
      "";
    const pubDate = bloco.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] ?? "";
    if (titulo) items.push({ titulo, link, descricao, pubDate, fonte });
  }
  return items;
}

async function buscarRSS(url: string, fonte: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LiderAdv/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, fonte);
  } catch {
    return [];
  }
}

// ─── Análise IA ───────────────────────────────────────────────────────────────

function classificarTipo(identifica: string = ""): string {
  const txt = identifica.toUpperCase();
  if (txt.includes("INSTRUÇÃO NORMATIVA")) return "instrucao_normativa";
  if (txt.includes("PORTARIA")) return "portaria";
  if (txt.includes("RESOLUÇÃO")) return "resolucao";
  if (txt.includes("DECRETO")) return "decreto";
  if (txt.includes("CIRCULAR")) return "circular";
  if (txt.includes("NOTA TÉCNICA")) return "nota_tecnica";
  return "diario_oficial";
}

async function analisarComIA(
  titulo: string,
  descricao: string,
  orgao: string
): Promise<{
  impacto: "alto" | "medio" | "baixo";
  analise: string;
  o_que_muda: string;
  acao_recomendada: string;
  tipos_afetados: string[];
} | null> {
  const texto = [titulo, orgao, descricao.slice(0, 1500)]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `Analise esta publicação previdenciária e responda APENAS em JSON (sem markdown):

${texto}

{
  "impacto": "alto" | "medio" | "baixo",
  "analise": "resumo técnico em 2 frases",
  "o_que_muda": "o que muda na prática para advogado previdenciário (1-2 frases diretas)",
  "acao_recomendada": "ação concreta (1 frase imperativa)",
  "tipos_afetados": ["lista dos tipos afetados"]
}

tipos_afetados válidos: aposentadoria_invalidez | auxilio_doenca | bpc_loas | rural | revisao_beneficio | salario_minimo | pensao_morte | acidente_trabalho | aposentadoria_tempo | aposentadoria_especial | calculo_beneficio | prazo_processo | outros

impacto alto = altera cálculo, carência, datas ou procedimentos de processos em andamento
impacto medio = nova instrução administrativa, mudança de formulário, novo prazo burocrático
impacto baixo = informativo sem efeito prático imediato`,
        },
      ],
    });

    const raw =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const jsonStr = raw.includes("{")
      ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)
      : raw;
    const parsed = JSON.parse(jsonStr);
    return {
      impacto: parsed.impacto ?? "baixo",
      analise: parsed.analise ?? "",
      o_que_muda: parsed.o_que_muda ?? "",
      acao_recomendada: parsed.acao_recomendada ?? "",
      tipos_afetados: Array.isArray(parsed.tipos_afetados)
        ? parsed.tipos_afetados
        : [],
    };
  } catch {
    return null;
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const hoje = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const dataStr = hoje.toISOString().split("T")[0];
  const resultados = {
    buscados: 0,
    novos: 0,
    erros: 0,
    fontes: [] as string[],
  };
  const vistos = new Set<string>();

  async function processarItem(
    uid: string,
    titulo: string,
    descricao: string,
    url: string | null,
    orgao: string,
    secao: string | null,
    tipo: string,
    fonte: string
  ) {
    if (!uid || vistos.has(uid)) return;
    vistos.add(uid);
    resultados.buscados++;

    const [existe] = await sql`
      SELECT id FROM atualizacoes_legais
      WHERE (url = ${url ?? ""} AND url IS NOT NULL AND url <> '')
         OR (titulo = ${titulo.slice(0, 500)} AND data_publicacao = ${dataStr})
      LIMIT 1
    `;
    if (existe) return;

    const analise = await analisarComIA(titulo, descricao, orgao);
    if (!analise) {
      resultados.erros++;
      return;
    }

    try {
      await sql`
        INSERT INTO atualizacoes_legais (
          titulo, resumo, url, data_publicacao, secao_dou, orgao,
          tipo, impacto, analise_ia, o_que_muda, acao_recomendada,
          tipos_afetados, fonte
        ) VALUES (
          ${titulo.slice(0, 500)},
          ${descricao.slice(0, 1000) || null},
          ${url},
          ${dataStr},
          ${secao},
          ${orgao.slice(0, 200)},
          ${tipo},
          ${analise.impacto},
          ${analise.analise},
          ${analise.o_que_muda},
          ${analise.acao_recomendada},
          ${analise.tipos_afetados},
          ${fonte}
        )
      `;
      resultados.novos++;
    } catch {
      resultados.erros++;
    }
  }

  // 1. DOU via InLabs (se chave configurada)
  if (process.env.DOU_INLABS_KEY) {
    resultados.fontes.push("DOU/InLabs");
    for (const termo of TERMOS_DOU) {
      const artigos = await buscarDOU(termo, dataStr);
      for (const art of artigos) {
        const uid = art.id_materia ?? art.urlTitle ?? art.titulo ?? "";
        await processarItem(
          uid,
          art.titulo ?? art.identifica ?? "Sem título",
          [art.subtitulo, art.txt?.slice(0, 800)].filter(Boolean).join(" — "),
          art.fullUrl ?? null,
          art.nome_orgao ?? "DOU",
          art.pubName ?? null,
          classificarTipo(art.identifica),
          "dou"
        );
      }
    }
  }

  // 2. INSS Notícias RSS (sempre ativo, sem chave)
  resultados.fontes.push("INSS/gov.br");
  const inssItems = await buscarRSS(
    "https://www.gov.br/inss/pt-br/noticias/RSS",
    "inss_noticias"
  );
  for (const item of inssItems.slice(0, 20)) {
    await processarItem(
      item.link || item.titulo,
      item.titulo,
      item.descricao.replace(/<[^>]+>/g, "").slice(0, 800),
      item.link || null,
      "INSS",
      null,
      "diario_oficial",
      "inss_noticias"
    );
  }

  // 3. Previdência Social RSS (sempre ativo, sem chave)
  resultados.fontes.push("Previdência/gov.br");
  const prevItems = await buscarRSS(
    "https://www.gov.br/previdencia/pt-br/noticias-e-conteudos/previdencia-social/noticias/RSS",
    "previdencia_noticias"
  );
  for (const item of prevItems.slice(0, 15)) {
    await processarItem(
      item.link || item.titulo,
      item.titulo,
      item.descricao.replace(/<[^>]+>/g, "").slice(0, 800),
      item.link || null,
      "Previdência Social",
      null,
      "diario_oficial",
      "previdencia_noticias"
    );
  }

  return NextResponse.json({ ok: true, data: dataStr, ...resultados });
}
