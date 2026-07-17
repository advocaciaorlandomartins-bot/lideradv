/**
 * Sincronização automática de publicações do TramitaSign.
 * Método 1 (preferido): API REST via TRAMITASIGN_API_KEY — confiável e direta.
 * Método 2 (fallback): sessão web via TRAMITASIGN_LOGIN_EMAIL + TRAMITASIGN_LOGIN_PASSWORD.
 */

import sql from "./db";
import { tramitaBuscarPublicacoesAPI, tramitaSignAtivo } from "./tramitasign";

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

export async function adicionarOabTramitaSign(
  numero: string,
  estado: string,
  nomeAdvogado: string
): Promise<{ ok: boolean; erro?: string }> {
  const email = process.env.TRAMITASIGN_LOGIN_EMAIL;
  const password = process.env.TRAMITASIGN_LOGIN_PASSWORD;
  if (!email || !password)
    return { ok: false, erro: "Credenciais não configuradas" };

  const cookie = await loginTramitaSign(email, password);
  if (!cookie) return { ok: false, erro: "Falha no login do TramitaSign" };

  // Busca a página principal para obter CSRF token (Inertia/Vite app)
  let csrf = "";
  let pageCookie = cookie;
  try {
    const res = await fetch(`${TRAMITA_BASE}/publicacoes/configuracoes`, {
      headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0 LiderAdv/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const html = await res.text();
      csrf = html.match(/csrf-token" content="([^"]+)"/)?.[1] ?? "";
      if (!csrf) {
        const inertia = extrairJsonInertia(html) as {
          props?: { csrf_token?: string };
        } | null;
        csrf = inertia?.props?.csrf_token ?? "";
      }
      const newCookies = res.headers.getSetCookie?.() ?? [];
      if (newCookies.length > 0)
        pageCookie = newCookies.map((c: string) => c.split(";")[0]).join("; ");
    }
  } catch (e) {
    console.error("[TramitaSync] adicionarOab: erro ao buscar CSRF:", e);
  }

  // Endpoint real confirmado via Network tab: POST /oabs (XHR/JSON)
  const numeroLimpo = numero.replace(/\D/g, "");
  try {
    const body: Record<string, string> = {
      uf: estado.toUpperCase(),
      numero: numeroLimpo,
    };
    if (nomeAdvogado) body.nome = nomeAdvogado;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Cookie: pageCookie,
      "User-Agent": "Mozilla/5.0 LiderAdv/1.0",
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${TRAMITA_BASE}/publicacoes/configuracoes`,
    };
    if (csrf) headers["X-CSRF-Token"] = csrf;

    const res = await fetch(`${TRAMITA_BASE}/oabs`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok || res.status === 201 || res.status === 302) {
      console.log(
        `[TramitaSync] OAB ${numero}/${estado} cadastrada no TramitaSign`
      );
      return { ok: true };
    }
    const txt = await res.text().catch(() => "");
    console.error(
      `[TramitaSync] adicionarOab: HTTP ${res.status} — ${txt.slice(0, 200)}`
    );
    return { ok: false, erro: `HTTP ${res.status}` };
  } catch (e) {
    console.error("[TramitaSync] adicionarOab: erro no POST /oabs:", e);
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ── Helper: inserir lista normalizada no banco ─────────────────────────────
async function inserirPublicacoes(
  pubs: {
    processo: string;
    tipo: string;
    tribunal: string;
    orgao: string;
    link: string | null;
    disponibilizacao: string;
    destinatario: string | null;
    advogados: string[];
    conteudoCompleto: string | null;
  }[]
): Promise<{ inseridos: number; pulados: number }> {
  let inseridos = 0;
  let pulados = 0;

  for (const pub of pubs) {
    const {
      processo,
      tipo,
      tribunal,
      orgao,
      link,
      disponibilizacao,
      destinatario,
      advogados,
      conteudoCompleto,
    } = pub;

    if (!processo || !disponibilizacao) {
      pulados++;
      continue;
    }

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

    await sql`
      INSERT INTO publicacoes
        (processo, tipo, destinatario, advogados, orgao, tribunal,
         disponibilizacao, status, origem, conteudo, conteudo_completo)
      VALUES (
        ${processo}, ${tipo}, ${destinatario}, ${advogados},
        ${orgao}, ${tribunal}, ${disponibilizacao}::date,
        'nao_lida', 'tramitasign', ${link}, ${conteudoCompleto}
      )
    `;
    inseridos++;
  }

  return { inseridos, pulados };
}

export async function sincronizarTramitaSign(dias = 30): Promise<{
  inseridos: number;
  pulados: number;
  metodo: string;
  erro?: string;
}> {
  // ── Método 1: API REST via Bearer token (preferido) ──────────────────────
  if (tramitaSignAtivo()) {
    try {
      const pubs = await tramitaBuscarPublicacoesAPI(dias);
      if (pubs.length > 0) {
        const { inseridos, pulados } = await inserirPublicacoes(pubs);
        console.log(
          `[TramitaSync] API REST: ${inseridos} inseridas, ${pulados} puladas`
        );
        return { inseridos, pulados, metodo: "api_rest" };
      }
      // API retornou 0 — pode ser que não tenha novas; tenta scraping como verificação
      console.log(
        "[TramitaSync] API REST retornou 0 publicações — tentando scraping"
      );
    } catch (err) {
      console.error("[TramitaSync] API REST falhou:", err);
    }
  }

  // ── Método 2: Scraping via sessão web (fallback) ─────────────────────────
  const email = process.env.TRAMITASIGN_LOGIN_EMAIL;
  const password = process.env.TRAMITASIGN_LOGIN_PASSWORD;

  if (!email || !password) {
    return {
      inseridos: 0,
      pulados: 0,
      metodo: "nenhum",
      erro: "Sem credenciais (API key ou login/senha)",
    };
  }

  const cookie = await loginTramitaSign(email, password);
  if (!cookie) {
    return {
      inseridos: 0,
      pulados: 0,
      metodo: "scraping",
      erro: "Falha no login do TramitaSign",
    };
  }

  const rawPubs = await fetchPublicacoesTramitaSign(cookie);

  const pubs = rawPubs
    .map((pub) => ({
      processo: pub.data?.numeroprocessocommascara ?? "",
      tipo: pub.data?.tipoDocumento ?? "Publicação",
      tribunal: pub.data?.siglaTribunal ?? "",
      orgao: pub.data?.nomeOrgao ?? "—",
      link: pub.data?.link ?? null,
      disponibilizacao: (
        pub.data_disponibilizacao ??
        pub.publication_date ??
        ""
      ).slice(0, 10),
      destinatario: pub.data?.destinatarios?.[0]?.nome ?? null,
      advogados: (pub.data?.destinatarioadvogados ?? [])
        .map((a) => a.advogado?.nome)
        .filter(Boolean) as string[],
      conteudoCompleto: pub.sanitized_text ?? null,
    }))
    .filter((p) => p.processo && p.disponibilizacao);

  const { inseridos, pulados } = await inserirPublicacoes(pubs);
  console.log(
    `[TramitaSync] Scraping: ${inseridos} inseridas, ${pulados} puladas`
  );
  return { inseridos, pulados, metodo: "scraping" };
}
