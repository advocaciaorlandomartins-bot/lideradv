/**
 * Sincronização automática de publicações do TramitaSign via sessão web.
 * Usa TRAMITASIGN_LOGIN_EMAIL e TRAMITASIGN_LOGIN_PASSWORD para autenticar.
 * Funciona independentemente da chave API REST.
 */

import sql from "./db";

const TRAMITA_BASE = "https://planilha.tramitacaointeligente.com.br";

interface AdvogadoTramita {
  advogado: { nome: string; uf_oab: string; numero_oab: string };
}

interface PublicacaoTramita {
  iid: number;
  data_disponibilizacao: string;
  publication_date: string;
  data: {
    siglaTribunal: string;
    tipoDocumento: string;
    link?: string;
    nomeOrgao: string;
    numeroprocessocommascara: string;
    destinatarios: { nome: string }[];
    destinatarioadvogados: AdvogadoTramita[];
  };
  sanitized_text?: string | null;
  summary?: {
    resumo?: string | null;
    prazo?: number | null;
    necessidade_acao?: string | null;
    data_audiencia?: string | null;
  } | null;
}

export function tramitaSyncAtivo(): boolean {
  return !!(
    process.env.TRAMITASIGN_LOGIN_EMAIL &&
    process.env.TRAMITASIGN_LOGIN_PASSWORD
  );
}

async function loginTramitaSign(
  email: string,
  password: string
): Promise<string | null> {
  try {
    const loginPage = await fetch(`${TRAMITA_BASE}/usuarios/login`, {
      signal: AbortSignal.timeout(15000),
    });
    const html = await loginPage.text();
    const csrf = html.match(/csrf-token" content="([^"]+)"/)?.[1] ?? "";
    const cookies = loginPage.headers.getSetCookie?.() ?? [];
    const cookieHeader = cookies.map((c: string) => c.split(";")[0]).join("; ");

    const loginRes = await fetch(`${TRAMITA_BASE}/usuarios/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      redirect: "manual",
      body: new URLSearchParams({
        "user[email]": email,
        "user[password]": password,
        authenticity_token: csrf,
      }).toString(),
      signal: AbortSignal.timeout(15000),
    });

    const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
    if (loginCookies.length === 0) return null;
    return loginCookies.map((c: string) => c.split(";")[0]).join("; ");
  } catch (err) {
    console.error("[TramitaSync] login error:", err);
    return null;
  }
}

function extrairJsonInertia(html: string): unknown | null {
  // Inertia renderiza dados em <div data-page="app" type="application/json">{...}</div>
  // O JSON pode conter </div> dentro de strings — usamos contagem de chaves
  const marker = 'type="application/json">';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  const jsonStart = markerIdx + marker.length;
  if (html[jsonStart] !== "{") return null;

  const BACKSLASH = "\\";
  let depth = 0;
  let inString = false;
  let escape = false;
  let i = jsonStart;

  while (i < html.length) {
    const c = html[i];
    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (c === BACKSLASH && inString) {
      escape = true;
      i++;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      i++;
      continue;
    }
    if (!inString) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    i++;
  }

  try {
    return JSON.parse(html.substring(jsonStart, i + 1));
  } catch {
    return null;
  }
}

async function fetchPublicacoesTramitaSign(
  cookie: string
): Promise<PublicacaoTramita[]> {
  try {
    const res = await fetch(`${TRAMITA_BASE}/publicacoes`, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 LiderAdv/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();

    const data = extrairJsonInertia(html) as {
      component?: string;
      props?: { publications?: PublicacaoTramita[] };
    } | null;

    if (!data || data?.component === "Landing/SignIn") return [];

    return data?.props?.publications ?? [];
  } catch (err) {
    console.error("[TramitaSync] fetch publications error:", err);
    return [];
  }
}

export async function sincronizarTramitaSign(): Promise<{
  inseridos: number;
  pulados: number;
  erro?: string;
}> {
  const email = process.env.TRAMITASIGN_LOGIN_EMAIL;
  const password = process.env.TRAMITASIGN_LOGIN_PASSWORD;

  if (!email || !password) {
    return { inseridos: 0, pulados: 0, erro: "Credenciais não configuradas" };
  }

  const cookie = await loginTramitaSign(email, password);
  if (!cookie) {
    return { inseridos: 0, pulados: 0, erro: "Falha no login do TramitaSign" };
  }

  const pubs = await fetchPublicacoesTramitaSign(cookie);
  let inseridos = 0;
  let pulados = 0;

  for (const pub of pubs) {
    const processo = pub.data?.numeroprocessocommascara ?? "";
    const tipo = pub.data?.tipoDocumento ?? "Publicação";
    const disponibilizacao = pub.data_disponibilizacao ?? pub.publication_date;

    if (!processo || !disponibilizacao) {
      pulados++;
      continue;
    }

    const tribunal = pub.data?.siglaTribunal ?? "";
    const orgao = pub.data?.nomeOrgao ?? "—";
    const link = pub.data?.link ?? null;
    const conteudoCompleto = pub.sanitized_text ?? null;
    const destinatario = pub.data?.destinatarios?.[0]?.nome ?? null;
    const advogados = (pub.data?.destinatarioadvogados ?? [])
      .map((a) => a.advogado?.nome)
      .filter(Boolean) as string[];

    const existe = await sql`
      SELECT 1 FROM publicacoes
      WHERE processo = ${processo}
        AND tipo = ${tipo}
        AND disponibilizacao = ${disponibilizacao}::date
      LIMIT 1
    `;

    if (existe.length > 0) {
      pulados++;
      continue;
    }

    const rows = await sql`
      INSERT INTO publicacoes
        (processo, tipo, destinatario, advogados, orgao, tribunal,
         disponibilizacao, status, origem, conteudo, conteudo_completo)
      VALUES (
        ${processo},
        ${tipo},
        ${destinatario},
        ${advogados},
        ${orgao},
        ${tribunal},
        ${disponibilizacao}::date,
        'nao_lida',
        'tramitasign',
        ${link},
        ${conteudoCompleto}
      )
      RETURNING id
    `;

    const newId = rows[0]?.id;
    if (newId && pub.summary?.resumo) {
      const resumoIa = JSON.stringify({
        texto: pub.summary.resumo ?? null,
        prazo_dias: pub.summary.prazo ?? null,
        acao_necessaria: pub.summary.necessidade_acao ?? null,
        audiencia: pub.summary.data_audiencia ?? null,
      });
      await sql`
        UPDATE publicacoes SET resumo_ia = ${resumoIa}::jsonb WHERE id = ${newId}
      `;
    }

    inseridos++;
  }

  return { inseridos, pulados };
}
