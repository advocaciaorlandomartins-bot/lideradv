/**
 * Busca publicações no DJe eSAJ por número de OAB.
 *
 * Confirmados acessíveis via Vercel: AL, CE, MS, SP.
 * Demais estados usam eSAJ mas podem estar bloqueados por IP fora do Brasil —
 * a função falha silenciosamente (retorna 0) sem travar o CRON.
 *
 * Não incluídos (usam sistemas diferentes):
 *   SC (Liferay), MG (SISCOM), PR (PROJUDI), RS (EPROC), RJ, ES, DF, AC (Next.js E-SAJ)
 */

import sql from "./db";

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

  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - diasAtras);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const cookie = await obterSessaoEsaj(baseUrl);

  // Busca com aspas = frase exata → evita falsos positivos
  const body = new URLSearchParams({
    "dadosConsulta.pesquisaLivre": `"${oab.numero}/${oab.estado}"`,
    "dadosConsulta.dtInicio": fmt(inicio),
    "dadosConsulta.dtFim": fmt(hoje),
    "dadosConsulta.cdCaderno": "-11",
  }).toString();

  let html = "";
  try {
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
    if (!res.ok) return 0;
    html = await res.text();
  } catch (err) {
    console.error(`[DjeEsaj/${oab.estado}] Erro na busca:`, err);
    return 0;
  }

  const itens = parseHtmlResultados(html, baseUrl);
  let inseridos = 0;

  for (const item of itens) {
    // URL da página é único por publicação — usamos como chave de dedup
    const existe = await sql`
      SELECT 1 FROM publicacoes WHERE conteudo = ${item.url} LIMIT 1
    `;
    if (existe.length > 0) continue;

    await sql`
      INSERT INTO publicacoes (
        processo, tipo, destinatario, orgao, tribunal,
        disponibilizacao, status, origem, conteudo, conteudo_completo
      ) VALUES (
        ${item.processo},
        ${item.tipo},
        ${oab.nome_advogado},
        ${item.orgao},
        ${"TJ" + oab.estado},
        ${item.data}::date,
        'nao_lida',
        ${"dje_" + oab.estado.toLowerCase()},
        ${item.url},
        ${item.snippet}
      )
    `;
    inseridos++;
  }

  return inseridos;
}
