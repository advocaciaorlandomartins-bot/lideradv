// Wraps the TramitaSign (tramitacaointeligente.com.br) API for use within LiderAdv.
// Set TRAMITASIGN_API_KEY and TRAMITASIGN_BASE_URL in .env.local and Vercel.

function baseUrl(): string {
  return (process.env.TRAMITASIGN_BASE_URL ?? "").replace(/\/$/, "");
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.TRAMITASIGN_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

export function tramitaSignAtivo(): boolean {
  return !!(
    process.env.TRAMITASIGN_BASE_URL && process.env.TRAMITASIGN_API_KEY
  );
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
