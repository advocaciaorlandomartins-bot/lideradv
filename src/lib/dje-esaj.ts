/**
 * Busca publicações no DJe eSAJ por número de OAB.
 *
 * Quando SCRAPER_BR_URL está definida, delega a busca HTTP ao microserviço
 * lideradv-scraper-br (Fly.io GRU, IP brasileiro) — resolve bloqueios por IP.
 * Fallback: scraping local direto de Vercel (funciona para AL, CE, MS, SP).
 *
 * Não incluídos (usam sistemas diferentes):
 *   SC (Liferay), MG (SISCOM), PR (PROJUDI), RS (EPROC), DF
 */

import sql from "./db";
import Anthropic from "@anthropic-ai/sdk";

const ESAJ_BASE: Record<string, string> = {
  // Confirmados funcionando via Vercel (US)
  AL: "https://www2.tjal.jus.br/cdje",
  CE: "https://esaj.tjce.jus.br/cdje",
  MS: "https://esaj.tjms.jus.br/cdje",
  SP: "https://esaj.tjsp.jus.br/cdje",
  // eSAJ padrão — funcionam de IPs brasileiros
  BA: "https://esaj.tjba.jus.br/cdje",
  MA: "https://esaj.tjma.jus.br/cdje",
  PA: "https://esaj.tjpa.jus.br/cdje",
  PB: "https://esaj.tjpb.jus.br/cdje",
  PE: "https://esaj.tjpe.jus.br/cdje",
  PI: "https://esaj.tjpi.jus.br/cdje",
  RN: "https://esaj.tjrn.jus.br/cdje",
  RO: "https://esaj.tjro.jus.br/cdje",
  RR: "https://esaj.tjrr.jus.br/cdje",
  SE: "https://esaj.tjse.jus.br/cdje",
  TO: "https://esaj.tjto.jus.br/cdje",
  AP: "https://esaj.tjap.jus.br/cdje",
  GO: "https://esaj.tjgo.jus.br/cdje",
  MT: "https://esaj.tjmt.jus.br/cdje",
  AM: "https://esaj.tjam.jus.br/cdje",
};

const MONTH_MAP: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function parseDjeDate(linkText: string): string | null {
  // Formato 1: "07/05/2025 - Caderno ..." (dd/MM/yyyy — versão atual TJAL)
  const m1 = linkText.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // Formato 2: "Wed May 07 00:00:00 BRT 2025 - ..." (Java Date.toString — versão antiga)
  const m2 = linkText.match(
    /\w+ (\w{3}) (\d{1,2}) \d{2}:\d{2}:\d{2} \w+ (\d{4})/
  );
  if (!m2) return null;
  const mm = MONTH_MAP[m2[1]];
  if (!mm) return null;
  return `${m2[3]}-${mm}-${m2[2].padStart(2, "0")}`;
}

function extrairProcesso(texto: string): string | null {
  // Remove quebras de linha — número do processo pode partir entre linhas:
  // "0750673-\n19.2023.8.02.0001" → "0750673-19.2023.8.02.0001"
  const joined = texto.replace(/[\r\n]/g, "");
  const m = joined.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  return m ? m[0] : null;
}

function limparSnippet(html: string): string {
  return html
    .replace(/<em>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DjeItem {
  data: string;
  tipo: string;
  orgao: string;
  url: string;
  snippet: string;
  processo: string | null;
}

function parseHtmlResultados(html: string, baseUrl: string): DjeItem[] {
  const itens: DjeItem[] = [];

  // Cada resultado fica em <tr class="fundocinza1">
  const blocos = html.split('<tr class="fundocinza1">');

  for (const bloco of blocos.slice(1)) {
    // URL da página do DJe (primeiro popup no bloco)
    const urlMatch = bloco.match(
      /popup\('(\/cdje\/consultaSimples\.do[^']+)'\)/
    );
    if (!urlMatch) continue;
    const pageUrl = `${baseUrl}${urlMatch[1]}`;

    // Texto do link: "07/05/2025 - Caderno 2 - ..." ou "Thu Aug 21 00:00:00 BRT 2025 - ..."
    const afterUrl = bloco.slice(
      bloco.indexOf(urlMatch[0]) + urlMatch[0].length
    );
    const dateMatch = afterUrl.match(
      />\s*((?:\d{2}\/\d{2}\/\d{4}|\w+ \w{3} \d{1,2} \d{2}:\d{2}:\d{2} \w+ \d{4})[^<]*)</
    );
    if (!dateMatch) continue;

    const linkText = dateMatch[1].trim();
    const data = parseDjeDate(linkText);
    if (!data) continue;

    // Caderno/seção: tudo entre a data e "Página N"
    const semData = linkText
      .replace(/^\d{2}\/\d{2}\/\d{4}\s*-\s*/, "") // dd/MM/yyyy
      .replace(/^\w+ \w{3} \d{1,2} \d{2}:\d{2}:\d{2} \w+ \d{4}\s*-\s*/, ""); // Java Date
    const orgao = semData.replace(/\s*-\s*P.{1,15}gina\s+\d+\s*$/, "").trim();
    const tipo = /Intima/i.test(orgao) ? "Intimação" : "Publicação";

    // Snippet do resultado (dentro de ementaClass2)
    const snippetMatch = bloco.match(
      /class="ementaClass2"[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/
    );
    if (!snippetMatch) continue;

    const snippet = limparSnippet(snippetMatch[1]);
    const processo = extrairProcesso(snippetMatch[1]);

    itens.push({ data, tipo, orgao, url: pageUrl, snippet, processo });
  }

  return itens;
}

async function fetchTextoCompleto(
  url: string,
  cookie: string
): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 LiderAdv/1.0",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // O texto da publicação fica dentro de <textarea> ou dentro de divs com classe específica
    const textareaMatch = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);
    if (textareaMatch) return textareaMatch[1].trim();
    // Fallback: busca em div com id="tabelaConteudo" ou similar
    const divMatch = html.match(
      /id="tabelaConteudo"[^>]*>([\s\S]*?)<\/table>/i
    );
    if (divMatch) return limparSnippet(divMatch[1]);
    // Último fallback: bloco de texto em <pre> ou parágrafo central
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch)
      return preMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .trim();
    return "";
  } catch {
    return "";
  }
}

async function obterSessaoEsaj(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/consultaAvancada.do`, {
      headers: { "User-Agent": "Mozilla/5.0 LiderAdv/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const cookies = res.headers.getSetCookie?.() ?? [];
    return cookies.map((c) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

async function gerarResumoAutomatico(
  id: number,
  tipo: string,
  orgao: string,
  tribunal: string,
  texto: string
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const prompt = `Você é um assistente jurídico brasileiro. Analise esta publicação do Diário de Justiça e retorne SOMENTE um JSON válido no formato abaixo. Campos desconhecidos devem ser null.

{
  "texto": "Resumo em português claro em 2-3 frases explicando o que a publicação determina",
  "prazo_dias": <número inteiro de dias úteis do prazo processual, ou null se não houver>,
  "acao_necessaria": "<ação necessária: Recurso | Manifestação | Contestação | Pagamento | Audiência | Cumprimento de sentença | Petição | Nenhuma ação imediata | ou outra ação concisa>",
  "audiencia": "<data da audiência no formato DD/MM/YYYY, ou null se não houver>"
}

Publicação:
Tipo: ${tipo}
Órgão: ${orgao} · ${tribunal}

${texto.slice(0, 4000)}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const block = res.content[0];
    const raw = block?.type === "text" ? block.text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const resumo = JSON.parse(match[0]);
    await sql`
      UPDATE publicacoes SET resumo_ia = ${JSON.stringify(resumo)}::jsonb, updated_at = now()
      WHERE id = ${id}
    `;
  } catch (err) {
    console.error(`[DjeEsaj] Erro ao gerar resumo IA para pub ${id}:`, err);
  }
}

async function buscarItensViaBr(
  oabNumero: string,
  oabEstado: string,
  diasAtras: number,
  estado: string
): Promise<DjeItem[] | null> {
  const scraperUrl = process.env.SCRAPER_BR_URL;
  const scraperSecret = process.env.SCRAPER_SECRET;
  if (!scraperUrl) return null;

  try {
    const res = await fetch(
      `${scraperUrl}/scraper/publicacoes/estado/${estado}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(scraperSecret ? { "x-scraper-secret": scraperSecret } : {}),
        },
        body: JSON.stringify({
          oab_numero: oabNumero,
          oab_estado: oabEstado,
          dias: diasAtras,
        }),
        signal: AbortSignal.timeout(55000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok: boolean;
      publicacoes: Array<{
        data: string;
        tipo: string;
        orgao: string;
        url: string;
        snippet: string;
        processo: string | null;
      }>;
    };
    if (!data.ok) return null;
    return data.publicacoes.map((p) => ({
      data: p.data,
      tipo: p.tipo,
      orgao: p.orgao,
      url: p.url,
      snippet: p.snippet,
      processo: p.processo,
    }));
  } catch (err) {
    console.error(`[DjeEsaj/${estado}] Erro no scraper-br:`, err);
    return null;
  }
}

export async function buscarPublicacoesDjeEsaj(
  oab: {
    id: string;
    numero: string;
    estado: string;
    nome_advogado: string | null;
  },
  diasAtras: number
): Promise<number> {
  const baseUrl = ESAJ_BASE[oab.estado];
  if (!baseUrl) return 0;

  // Tenta via scraper-br (IP brasileiro); fallback: scraping local
  const itensBr = await buscarItensViaBr(
    oab.numero,
    oab.estado,
    diasAtras,
    oab.estado
  );

  let itens: DjeItem[];

  if (itensBr !== null) {
    itens = itensBr;
    console.log(`[DjeEsaj/${oab.estado}] ${itens.length} itens via scraper-br`);
  } else {
    // Fallback local (funciona para AL, CE, MS, SP via Vercel)
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - diasAtras);
    const fmtData = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const cookie = await obterSessaoEsaj(baseUrl);

    // Tenta múltiplos formatos: "14381/AL", "14.381/AL", só número
    const numeroSemZeros = oab.numero.replace(/^0+/, "");
    const formatosBusca = [
      `"${oab.numero}/${oab.estado}"`,
      `"${numeroSemZeros}/${oab.estado}"`,
      `"${oab.numero.replace(/(\d+)/, (n) =>
        n.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      )}/${oab.estado}"`,
      oab.numero,
    ];

    itens = [];
    for (const termo of formatosBusca) {
      try {
        const body = new URLSearchParams({
          "dadosConsulta.pesquisaLivre": termo,
          "dadosConsulta.dtInicio": fmtData(inicio),
          "dadosConsulta.dtFim": fmtData(hoje),
          "dadosConsulta.cdCaderno": "-11",
        }).toString();
        const res = await fetch(`${baseUrl}/consultaAvancada.do`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 LiderAdv/1.0",
            Referer: `${baseUrl}/consultaAvancada.do`,
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body,
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const encontrados = parseHtmlResultados(html, baseUrl);
        console.log(
          `[DjeEsaj/${oab.estado}] termo="${termo}" → ${encontrados.length} itens`
        );
        if (encontrados.length > 0) {
          itens = encontrados;
          break;
        }
      } catch (err) {
        console.error(
          `[DjeEsaj/${oab.estado}] Erro na busca local (termo=${termo}):`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    console.log(
      `[DjeEsaj/${oab.estado}] Total via fallback local: ${itens.length} itens`
    );
  }

  let inseridos = 0;
  const cookie = itensBr !== null ? "" : await obterSessaoEsaj(baseUrl);

  for (const item of itens) {
    const existe = await sql`
      SELECT 1 FROM publicacoes WHERE conteudo = ${item.url} LIMIT 1
    `;
    if (existe.length > 0) continue;

    // Quando veio do scraper-br, o snippet já é o texto completo
    const textoParaResumo =
      item.snippet ||
      (itensBr === null ? await fetchTextoCompleto(item.url, cookie) : "");

    const inserted = await sql`
      INSERT INTO publicacoes (
        processo, tipo, destinatario, orgao, tribunal,
        disponibilizacao, status, origem, conteudo, conteudo_completo
      ) VALUES (
        ${item.processo ?? ""},
        ${item.tipo},
        ${oab.nome_advogado ?? ""},
        ${item.orgao},
        ${"TJ" + oab.estado},
        ${item.data}::date,
        'nao_lida',
        'automatica',
        ${item.url},
        ${textoParaResumo || null}
      )
      RETURNING id
    `;

    const newId = inserted[0]?.id;
    if (newId && textoParaResumo) {
      await gerarResumoAutomatico(
        newId,
        item.tipo,
        item.orgao,
        "TJ" + oab.estado,
        textoParaResumo
      );
    }

    inseridos++;
  }

  return inseridos;
}
