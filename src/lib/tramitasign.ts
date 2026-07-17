// Wraps the TramitaSign (tramitacaointeligente.com.br) API for use within LiderAdv.
// Set TRAMITASIGN_API_KEY and TRAMITASIGN_BASE_URL in .env.local and Vercel.

const TRAMITA_PLANILHA_BASE = "https://planilha.tramitacaointeligente.com.br";

function baseUrl(): string {
  return (process.env.TRAMITASIGN_BASE_URL ?? "").replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.TRAMITASIGN_API_KEY ?? "";
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
}

export function tramitaSignAtivo(): boolean {
  return !!(
    process.env.TRAMITASIGN_BASE_URL && process.env.TRAMITASIGN_API_KEY
  );
}

// ── Formato retornado pela API REST /api/publicacoes ────────────────────────
export interface PublicacaoTramitaAPI {
  id?: number;
  numero_processo?: string;
  destinatarios?: string[] | { nome: string }[];
  advogados?: string[] | { nome: string }[];
  orgao?: string;
  tribunal?: string;
  data_disponibilizacao?: string;
  status?: string;
  tipo_movimento?: string;
  url_publica?: string;
  oab_responsavel?: string;
  // campos alternativos que o Tramita pode usar
  nomeOrgao?: string;
  siglaTribunal?: string;
  tipoDocumento?: string;
  link?: string;
  sanitized_text?: string;
  conteudo?: string;
  texto?: string;
  created_at?: string;
  publication_date?: string;
}

function normalizarArrayNomes(arr?: string[] | { nome: string }[]): string[] {
  if (!arr) return [];
  return (arr as (string | { nome: string })[])
    .map((x) => (typeof x === "string" ? x : (x?.nome ?? "")))
    .filter(Boolean);
}

/**
 * Busca publicações diretamente pela API REST do Tramita.
 * Tenta dois endpoints: /api/publicacoes e /publicacoes (alguns tenants).
 * Usa o mesmo TRAMITASIGN_API_KEY e TRAMITASIGN_BASE_URL.
 */
export async function tramitaBuscarPublicacoesAPI(dias = 30): Promise<
  {
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
> {
  const key = apiKey();
  if (!key) return [];

  // Calcula a data de corte
  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  const corteStr = corte.toISOString().slice(0, 10);

  // Tenta o endpoint da API Tramita (pode variar por tenant)
  const candidatos = [
    `${TRAMITA_PLANILHA_BASE}/api/publicacoes`,
    `${baseUrl()}/publicacoes`,
    `${TRAMITA_PLANILHA_BASE}/publicacoes.json`,
  ].filter((u, i, a) => a.indexOf(u) === i); // deduplicar

  for (const url of candidatos) {
    try {
      const res = await fetch(`${url}?data_inicio=${corteStr}&per_page=200`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) continue;

      const json = (await res.json()) as
        | {
            publicacoes?: PublicacaoTramitaAPI[];
            data?: PublicacaoTramitaAPI[];
          }
        | PublicacaoTramitaAPI[];

      const lista: PublicacaoTramitaAPI[] = Array.isArray(json)
        ? json
        : ((
            json as {
              publicacoes?: PublicacaoTramitaAPI[];
              data?: PublicacaoTramitaAPI[];
            }
          ).publicacoes ??
          (
            json as {
              publicacoes?: PublicacaoTramitaAPI[];
              data?: PublicacaoTramitaAPI[];
            }
          ).data ??
          []);

      if (lista.length === 0) continue;

      return lista.map((pub) => ({
        processo:
          pub.numero_processo ?? pub.orgao ?? `tramita-${pub.id ?? Date.now()}`,
        tipo: pub.tipo_movimento ?? pub.tipoDocumento ?? "Publicação",
        tribunal: pub.tribunal ?? pub.siglaTribunal ?? "",
        orgao: pub.orgao ?? pub.nomeOrgao ?? "—",
        link: pub.url_publica ?? pub.link ?? null,
        disponibilizacao: (
          pub.data_disponibilizacao ??
          pub.publication_date ??
          pub.created_at ??
          new Date().toISOString()
        ).slice(0, 10),
        destinatario:
          normalizarArrayNomes(
            pub.destinatarios as string[] | { nome: string }[]
          )[0] ?? null,
        advogados: normalizarArrayNomes(
          pub.advogados as string[] | { nome: string }[]
        ),
        conteudoCompleto:
          pub.sanitized_text ?? pub.conteudo ?? pub.texto ?? null,
      }));
    } catch {
      // tenta próximo candidato
      continue;
    }
  }

  return [];
}

export async function tramitaCriarCliente(dados: {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
}): Promise<{ id: number | string } | null> {
  try {
    const payload: Record<string, unknown> = {
      customer: {
        name: dados.nome,
        customer_type: "contato",
        phone_mobile: dados.telefone?.replace(/\D/g, "") ?? null,
        email: dados.email ?? null,
        ...(dados.cpf ? { cpf_cnpj: dados.cpf.replace(/\D/g, "") } : {}),
      },
    };
    const res = await fetch(`${baseUrl()}/clientes`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.customer ?? data ?? null;
  } catch (e) {
    console.error("[TramitaSign] criarCliente error:", e);
    return null;
  }
}

export async function tramitaCriarNota(
  clienteId: number | string,
  userId: string,
  conteudo: string
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/notas`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        note: { content: conteudo, user_id: userId, customer_id: clienteId },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[TramitaSign] criarNota error:", e);
    return false;
  }
}

export async function tramitaObterUserId(): Promise<string> {
  try {
    const res = await fetch(`${baseUrl()}/usuarios?items=1`, {
      headers: headers(),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.users?.[0]?.id ?? data?.[0]?.id ?? "");
  } catch {
    return "";
  }
}

export async function tramitaEnviarDocumento(params: {
  clienteId: string | number;
  userId: string;
  titulo: string;
  htmlContent: string;
  email?: string | null;
  telefone?: string | null;
}): Promise<{ id: string; link?: string } | null> {
  try {
    const res = await fetch(`${baseUrl()}/documentos`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        document: {
          title: params.titulo,
          content_html: params.htmlContent,
          customer_id: params.clienteId,
          user_id: params.userId,
          send_via_whatsapp: !!params.telefone,
          send_via_email: !!params.email,
          phone_mobile: params.telefone?.replace(/\D/g, "") ?? null,
          email: params.email ?? null,
          require_signature: true,
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      id: String(data?.document?.id ?? data?.id ?? ""),
      link: data?.document?.sign_link ?? data?.sign_link ?? undefined,
    };
  } catch (e) {
    console.error("[TramitaSign] enviarDocumento error:", e);
    return null;
  }
}
