// Wraps the TramitaSign (tramitacaointeligente.com.br) API for use within LiderAdv.
// Set TRAMITASIGN_API_KEY and TRAMITASIGN_BASE_URL in .env.local and Vercel.
//
// Endpoints de assinatura de envelope confirmados contra a documentação
// oficial (Swagger real, servido pelo próprio TramitaSign em
// https://planilha.tramitacaointeligente.com.br/api/docs.json e
// /api/docs/endpoints/<grupo>.json — não é doc de terceiro). A
// implementação anterior (função tramitaEnviarDocumento, removida) mandava
// um POST /documentos com content_html + require_signature — esse endpoint
// não existe na API real. O fluxo correto de assinatura eletrônica é:
//   1. POST /arquivos/envios-diretos  → signed_id + upload_url (S3)
//   2. PUT no upload_url              → sobe os bytes do PDF
//   3. POST /arquivos                 → registra o upload, devolve id
//   4. POST /assinaturas              → cria o envelope (rascunho) com os upload_ids
//   5. PATCH /assinaturas/{id}        → define os assinantes (signers)
//   6. POST /assinaturas/{id}/envio   → envia de verdade; a resposta traz
//      signature_link por assinante.
import crypto from "crypto";

const TRAMITA_PLANILHA_BASE = "https://planilha.tramitacaointeligente.com.br";

function baseUrl(): string {
  // TRAMITASIGN_BASE_URL pode estar salva com ou sem /api/v1, com barra(s)
  // no fim, ou com espaço/quebra de linha sobrando (bem comum ao colar
  // valor num campo de variável de ambiente) — qualquer uma dessas coisas
  // fazia a checagem antiga (endsWith direto) falhar silenciosamente e
  // duplicar o sufixo (".../api/v1/api/v1/...", 404 puro, confirmado
  // reproduzindo o erro batido pelo usuário). Normaliza de forma tolerante
  // a qualquer um desses formatos antes de montar a URL final.
  const raw = (process.env.TRAMITASIGN_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "");
  return `${raw}/api/v1`;
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

export interface TramitaUserIdResultado {
  userId: string;
  erro?: string;
}

export async function tramitaObterUserId(): Promise<TramitaUserIdResultado> {
  try {
    const res = await fetch(`${baseUrl()}/usuarios?per_page=1`, {
      headers: headers(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const erro = `obterUserId: HTTP ${res.status} — ${txt.slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { userId: "", erro };
    }
    const data = await res.json();
    const id = String(data?.users?.[0]?.id ?? data?.[0]?.id ?? "");
    if (!id) {
      const erro = `obterUserId: resposta OK mas sem id de usuário — ${JSON.stringify(data).slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { userId: "", erro };
    }
    return { userId: id };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[TramitaSign] obterUserId error:", e);
    return { userId: "", erro };
  }
}

/**
 * Passo 1+2+3 do fluxo de assinatura: sobe um PDF pro TramitaSign (upload
 * direto estilo Rails ActiveStorage — pede uma URL assinada, manda os bytes
 * pra ela, depois registra o upload) e devolve o id numérico usável em
 * upload_ids na criação/edição de um envelope.
 */
export interface TramitaUploadResultado {
  id: number | null;
  erro?: string;
}

export async function tramitaUploadArquivo(
  buffer: Buffer,
  filename: string,
  contentType = "application/pdf"
): Promise<TramitaUploadResultado> {
  try {
    const checksum = crypto.createHash("md5").update(buffer).digest("base64");

    const directRes = await fetch(`${baseUrl()}/arquivos/envios-diretos`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        direct_upload: {
          filename,
          byte_size: buffer.byteLength,
          checksum,
          content_type: contentType,
        },
      }),
    });
    if (!directRes.ok) {
      const txt = await directRes.text().catch(() => "");
      const erro = `envios-diretos: HTTP ${directRes.status} — ${txt.slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { id: null, erro };
    }
    const directData = await directRes.json();
    const du = directData?.direct_upload;
    if (!du?.upload_url || !du?.signed_id) {
      const erro = `envios-diretos: resposta sem upload_url/signed_id — ${JSON.stringify(directData).slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { id: null, erro };
    }

    // PUT direto no armazenamento assinado (S3 ou equivalente) — não é a
    // API do TramitaSign: não manda o Bearer token, só os headers
    // exatamente como vieram em upload_headers.
    const putRes = await fetch(du.upload_url, {
      method: "PUT",
      headers: du.upload_headers ?? {},
      body: new Uint8Array(buffer),
    });
    if (!putRes.ok) {
      const putTxt = await putRes.text().catch(() => "");
      const erro = `PUT upload_url: HTTP ${putRes.status} ao subir ${filename} — ${putTxt.slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { id: null, erro };
    }

    const registerRes = await fetch(`${baseUrl()}/arquivos`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ upload: { signed_id: du.signed_id } }),
    });
    if (!registerRes.ok) {
      const txt = await registerRes.text().catch(() => "");
      const erro = `registrar arquivo: HTTP ${registerRes.status} — ${txt.slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { id: null, erro };
    }
    const registerData = await registerRes.json();
    const id = registerData?.upload?.id;
    if (typeof id !== "number") {
      const erro = `registrar arquivo: resposta sem id numérico — ${JSON.stringify(registerData).slice(0, 200)}`;
      console.error(`[TramitaSign] ${erro}`);
      return { id: null, erro };
    }
    return { id };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[TramitaSign] uploadArquivo error:", e);
    return { id: null, erro };
  }
}

/** Passo 4: cria o envelope (nasce em rascunho) já com os documentos (upload_ids). */
export async function tramitaCriarEnvelopeAssinatura(params: {
  userId: string;
  nome: string;
  uploadIds: number[];
}): Promise<{ id: number } | null> {
  try {
    const res = await fetch(`${baseUrl()}/assinaturas`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        envelope: {
          user_id: params.userId,
          name: params.nome,
          upload_ids: params.uploadIds,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[TramitaSign] criarEnvelope: HTTP ${res.status} — ${txt.slice(0, 300)}`
      );
      return null;
    }
    const data = await res.json();
    const id = data?.envelope?.id;
    if (typeof id !== "number") {
      console.error(
        "[TramitaSign] criarEnvelope: resposta sem id numérico:",
        JSON.stringify(data).slice(0, 300)
      );
      return null;
    }
    return { id };
  } catch (e) {
    console.error("[TramitaSign] criarEnvelopeAssinatura error:", e);
    return null;
  }
}

export interface TramitaSignerInput {
  signerType: "user" | "customer" | "third_party";
  customerId?: number;
  userId?: string;
  fullName?: string;
  email?: string;
  signatureType?: "assinante" | "testemunha" | "avalista";
  selfieRequired?: boolean;
  documentPhotoRequired?: boolean;
}

/** Passo 5: define os assinantes do envelope (só aceito enquanto está em rascunho). */
export async function tramitaAtualizarSignatarios(
  envelopeId: number,
  signers: TramitaSignerInput[]
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/assinaturas/${envelopeId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        envelope: {
          signers: signers.map((s) => ({
            signer_type: s.signerType,
            ...(s.customerId != null ? { customer_id: s.customerId } : {}),
            ...(s.userId ? { user_id: s.userId } : {}),
            ...(s.fullName ? { full_name: s.fullName } : {}),
            ...(s.email ? { email: s.email } : {}),
            ...(s.signatureType ? { signature_type: s.signatureType } : {}),
            ...(s.selfieRequired ? { selfie_required: true } : {}),
            ...(s.documentPhotoRequired
              ? { document_photo_required: true }
              : {}),
          })),
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[TramitaSign] atualizarSignatarios: HTTP ${res.status} — ${txt.slice(0, 300)}`
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("[TramitaSign] atualizarSignatarios error:", e);
    return false;
  }
}

export interface TramitaSignerResultado {
  id: string;
  signerType: string;
  email: string | null;
  fullName: string | null;
  signatureLink: string | null;
}

/** Passo 6: envia de verdade — a resposta traz o signature_link de cada assinante. */
export async function tramitaEnviarEnvelopeAssinatura(
  envelopeId: number
): Promise<{ signers: TramitaSignerResultado[] } | null> {
  try {
    const res = await fetch(`${baseUrl()}/assinaturas/${envelopeId}/envio`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[TramitaSign] enviarEnvelope: HTTP ${res.status} — ${txt.slice(0, 300)}`
      );
      return null;
    }
    const data = await res.json();
    const signers = (data?.envelope?.signers ?? []) as Array<{
      id: string;
      signer_type: string;
      email: string | null;
      full_name: string | null;
      signature_link: string | null;
    }>;
    return {
      signers: signers.map((s) => ({
        id: s.id,
        signerType: s.signer_type,
        email: s.email ?? null,
        fullName: s.full_name ?? null,
        signatureLink: s.signature_link ?? null,
      })),
    };
  } catch (e) {
    console.error("[TramitaSign] enviarEnvelopeAssinatura error:", e);
    return null;
  }
}
