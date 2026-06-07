import sql from "./db";

export interface EnvelopeLista {
  id: string;
  nome: string;
  prazo: string | null;
  status: string;
  total_assinantes: number;
  assinados: number;
  criado_em: string;
}

export interface AssinanteInput {
  tipo: "eu_mesmo" | "colaborador" | "cliente" | "outro";
  nome: string;
  email: string;
  papel: "assinante" | "testemunha" | "avalista";
  valEmail: boolean;
  valSelfie: boolean;
  valDocumento: boolean;
  ordem: number;
}

export interface DocumentoInput {
  nome: string;
  tamanhoBytes: number;
  ordem: number;
}

export async function listarEnvelopes(
  criadoPor: string
): Promise<EnvelopeLista[]> {
  const rows = await sql`
    SELECT
      e.id::text,
      e.nome,
      e.prazo,
      e.status,
      e.criado_em,
      COUNT(a.id)::int                                    AS total_assinantes,
      COUNT(a.id) FILTER (WHERE a.status = 'assinado')::int AS assinados
    FROM envelopes e
    LEFT JOIN envelope_assinantes a ON a.envelope_id = e.id
    WHERE e.criado_por = ${criadoPor}
    GROUP BY e.id
    ORDER BY e.criado_em DESC
    LIMIT 100
  `;
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    prazo: r.prazo ? String(r.prazo) : null,
    status: r.status,
    total_assinantes: r.total_assinantes,
    assinados: r.assinados,
    criado_em: String(r.criado_em),
  }));
}

export async function criarEnvelope(data: {
  nome: string;
  prazo: string | null;
  status: "rascunho" | "aguardando";
  notifAssinantes: boolean;
  notifCriador: boolean;
  notifEscritorio: boolean;
  criadoPor: string;
  assinantes: AssinanteInput[];
  documentos: DocumentoInput[];
}): Promise<string> {
  const [env] = await sql`
    INSERT INTO envelopes
      (nome, prazo, status, notif_assinantes, notif_criador, notif_escritorio, criado_por)
    VALUES
      (${data.nome}, ${data.prazo ?? null}, ${data.status},
       ${data.notifAssinantes}, ${data.notifCriador}, ${data.notifEscritorio},
       ${data.criadoPor})
    RETURNING id::text
  `;
  const envId = env.id as string;

  if (data.documentos.length > 0) {
    for (const doc of data.documentos) {
      await sql`
        INSERT INTO envelope_documentos (envelope_id, nome, tamanho_bytes, ordem)
        VALUES (${envId}::uuid, ${doc.nome}, ${doc.tamanhoBytes}, ${doc.ordem})
      `;
    }
  }

  if (data.assinantes.length > 0) {
    for (const a of data.assinantes) {
      await sql`
        INSERT INTO envelope_assinantes
          (envelope_id, tipo, nome, email, papel, val_email, val_selfie, val_documento, ordem)
        VALUES
          (${envId}::uuid, ${a.tipo}, ${a.nome}, ${a.email}, ${a.papel},
           ${a.valEmail}, ${a.valSelfie}, ${a.valDocumento}, ${a.ordem})
      `;
    }
  }

  return envId;
}
