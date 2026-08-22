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
  modeloId: string;
  nome: string;
  htmlContent: string;
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

export interface EnvelopeDetalhe {
  id: string;
  nome: string;
  prazo: string | null;
  status: string;
  criado_por: string;
  criado_em: string;
  cliente_nome: string | null;
  documentos: {
    id: string;
    nome: string;
    htmlContent: string;
    ordem: number;
  }[];
  assinantes: {
    id: string;
    tipo: string;
    nome: string;
    email: string;
    papel: string;
    status: string;
    ordem: number;
    tramitasignLink: string | null;
  }[];
}

export async function getEnvelopeById(
  id: string
): Promise<EnvelopeDetalhe | null> {
  const [env] = await sql`
    SELECT e.id::text, e.nome, e.prazo, e.status, e.criado_por, e.criado_em,
           c.name AS cliente_nome
    FROM envelopes e
    LEFT JOIN clients c ON c.id = e.client_id
    WHERE e.id = ${id}::uuid
  `;
  if (!env) return null;

  const [documentos, assinantes] = await Promise.all([
    sql`
      SELECT id::text, nome, html_content, ordem
      FROM envelope_documentos
      WHERE envelope_id = ${id}::uuid
      ORDER BY ordem
    `,
    sql`
      SELECT id::text, tipo, nome, email, papel, status, ordem, tramitasign_link
      FROM envelope_assinantes
      WHERE envelope_id = ${id}::uuid
      ORDER BY ordem
    `,
  ]);

  return {
    id: env.id,
    nome: env.nome,
    prazo: env.prazo ? String(env.prazo) : null,
    status: env.status,
    criado_por: env.criado_por,
    criado_em: String(env.criado_em),
    cliente_nome: env.cliente_nome ?? null,
    documentos: documentos.map((d) => ({
      id: d.id,
      nome: d.nome,
      htmlContent: d.html_content ?? "",
      ordem: d.ordem,
    })),
    assinantes: assinantes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.nome,
      email: a.email,
      papel: a.papel,
      status: a.status,
      ordem: a.ordem,
      tramitasignLink: a.tramitasign_link ?? null,
    })),
  };
}

export interface AssinanteCriado {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  papel: string;
}

export async function criarEnvelope(data: {
  nome: string;
  prazo: string | null;
  status: "rascunho" | "aguardando";
  notifAssinantes: boolean;
  notifCriador: boolean;
  notifEscritorio: boolean;
  criadoPor: string;
  clienteId: string;
  assinantes: AssinanteInput[];
  documentos: DocumentoInput[];
}): Promise<{ id: string; assinantes: AssinanteCriado[] }> {
  const [env] = await sql`
    INSERT INTO envelopes
      (nome, prazo, status, notif_assinantes, notif_criador, notif_escritorio, criado_por, client_id)
    VALUES
      (${data.nome}, ${data.prazo ?? null}, ${data.status},
       ${data.notifAssinantes}, ${data.notifCriador}, ${data.notifEscritorio},
       ${data.criadoPor}, ${data.clienteId}::uuid)
    RETURNING id::text
  `;
  const envId = env.id as string;

  if (data.documentos.length > 0) {
    for (const doc of data.documentos) {
      await sql`
        INSERT INTO envelope_documentos (envelope_id, nome, modelo_id, html_content, ordem)
        VALUES (${envId}::uuid, ${doc.nome}, ${doc.modeloId}::uuid, ${doc.htmlContent}, ${doc.ordem})
      `;
    }
  }

  const assinantesCriados: AssinanteCriado[] = [];
  if (data.assinantes.length > 0) {
    for (const a of data.assinantes) {
      const [row] = await sql`
        INSERT INTO envelope_assinantes
          (envelope_id, tipo, nome, email, papel, val_email, val_selfie, val_documento, ordem)
        VALUES
          (${envId}::uuid, ${a.tipo}, ${a.nome}, ${a.email}, ${a.papel},
           ${a.valEmail}, ${a.valSelfie}, ${a.valDocumento}, ${a.ordem})
        RETURNING id::text
      `;
      assinantesCriados.push({
        id: row.id as string,
        tipo: a.tipo,
        nome: a.nome,
        email: a.email,
        papel: a.papel,
      });
    }
  }

  return { id: envId, assinantes: assinantesCriados };
}

export async function atualizarAssinanteTramitaSign(
  assinanteId: string,
  data: { documentoId: string | null; link: string | null }
): Promise<void> {
  await sql`
    UPDATE envelope_assinantes
    SET tramitasign_documento_id = ${data.documentoId}, tramitasign_link = ${data.link}
    WHERE id = ${assinanteId}::uuid
  `;
}
