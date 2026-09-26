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
  valAssinaturaDesenhada: boolean;
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
  tramitasignUltimoStatus: string | null;
  tramitasignUltimaSync: string | null;
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
    tramitasignErro: string | null;
  }[];
}

export async function getEnvelopeById(
  id: string
): Promise<EnvelopeDetalhe | null> {
  const [env] = await sql`
    SELECT e.id::text, e.nome, e.prazo, e.status, e.criado_por, e.criado_em,
           c.name AS cliente_nome,
           e.tramitasign_ultimo_status, e.tramitasign_ultima_sync
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
      SELECT id::text, tipo, nome, email, papel, status, ordem,
             tramitasign_link, tramitasign_erro
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
    tramitasignUltimoStatus: env.tramitasign_ultimo_status ?? null,
    tramitasignUltimaSync: env.tramitasign_ultima_sync
      ? String(env.tramitasign_ultima_sync)
      : null,
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
      tramitasignErro: a.tramitasign_erro ?? null,
    })),
  };
}

export interface AssinanteCriado {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  papel: string;
  valSelfie: boolean;
  valDocumento: boolean;
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
          (envelope_id, tipo, nome, email, papel, val_email, val_selfie, val_documento, val_assinatura_desenhada, ordem)
        VALUES
          (${envId}::uuid, ${a.tipo}, ${a.nome}, ${a.email}, ${a.papel},
           ${a.valEmail}, ${a.valSelfie}, ${a.valDocumento}, ${a.valAssinaturaDesenhada}, ${a.ordem})
        RETURNING id::text
      `;
      assinantesCriados.push({
        id: row.id as string,
        tipo: a.tipo,
        nome: a.nome,
        email: a.email,
        papel: a.papel,
        valSelfie: a.valSelfie,
        valDocumento: a.valDocumento,
      });
    }
  }

  return { id: envId, assinantes: assinantesCriados };
}

/**
 * A API real de assinatura do TramitaSign modela isso como UM envelope
 * remoto por envelope nosso, com os "signers" dele apontando pro id do
 * assinante lá (não um "documento" por assinante — a implementação
 * anterior assumia errado). `signerId` é o `signers[].id` devolvido por
 * `POST /assinaturas/{id}/envio`.
 */
export async function atualizarAssinanteTramitaSign(
  assinanteId: string,
  data: {
    signerId: string | null;
    link: string | null;
    erro?: string | null;
  }
): Promise<void> {
  await sql`
    UPDATE envelope_assinantes
    SET tramitasign_signer_id = ${data.signerId},
        tramitasign_link = ${data.link},
        tramitasign_erro = ${data.erro ?? null}
    WHERE id = ${assinanteId}::uuid
  `;
}

export async function atualizarEnvelopeTramitaSign(
  envelopeId: string,
  tramitasignEnvelopeId: number | null
): Promise<void> {
  await sql`
    UPDATE envelopes SET tramitasign_envelope_id = ${tramitasignEnvelopeId}
    WHERE id = ${envelopeId}::uuid
  `;
}

export interface DocumentoParaEnvio {
  modeloId: string | null;
  nome: string;
  ordem: number;
}

export interface AssinanteParaEnvio {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  papel: string;
  valSelfie: boolean;
  valDocumento: boolean;
  valAssinaturaDesenhada: boolean;
  status: string;
}

export interface EnvelopeParaEnvio {
  id: string;
  nome: string;
  clienteId: string;
  notifAssinantes: boolean;
  documentos: DocumentoParaEnvio[];
  assinantes: AssinanteParaEnvio[];
}

/** Reúne o que o envio (ou reenvio) ao TramitaSign precisa: o envelope inteiro. */
export async function getEnvelopeParaEnvio(
  envelopeId: string
): Promise<EnvelopeParaEnvio | null> {
  const [env] = await sql`
    SELECT id::text, nome, client_id::text, notif_assinantes
    FROM envelopes
    WHERE id = ${envelopeId}::uuid
  `;
  if (!env) return null;

  const [documentos, assinantes] = await Promise.all([
    sql`
      SELECT modelo_id::text, nome, ordem
      FROM envelope_documentos
      WHERE envelope_id = ${envelopeId}::uuid
      ORDER BY ordem
    `,
    sql`
      SELECT id::text, tipo, nome, email, papel, val_selfie, val_documento,
             val_assinatura_desenhada, status
      FROM envelope_assinantes
      WHERE envelope_id = ${envelopeId}::uuid
      ORDER BY ordem
    `,
  ]);

  return {
    id: env.id,
    nome: env.nome,
    clienteId: env.client_id,
    notifAssinantes: env.notif_assinantes,
    documentos: documentos.map((d) => ({
      modeloId: d.modelo_id ?? null,
      nome: d.nome,
      ordem: d.ordem,
    })),
    assinantes: assinantes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.nome,
      email: a.email,
      papel: a.papel,
      valSelfie: a.val_selfie,
      valDocumento: a.val_documento,
      valAssinaturaDesenhada: a.val_assinatura_desenhada,
      status: a.status,
    })),
  };
}

export async function getEnvelopeCriadoPor(id: string): Promise<string | null> {
  const [row] =
    await sql`SELECT criado_por FROM envelopes WHERE id = ${id}::uuid`;
  return row?.criado_por ?? null;
}

export async function cancelarEnvelope(id: string): Promise<void> {
  await sql`
    UPDATE envelopes SET status = 'cancelado', atualizado_em = NOW()
    WHERE id = ${id}::uuid
  `;
}

// FK envelope_documentos/envelope_assinantes → envelopes é ON DELETE CASCADE,
// então excluir o envelope já remove documentos e assinantes junto.
export async function excluirEnvelope(id: string): Promise<void> {
  await sql`DELETE FROM envelopes WHERE id = ${id}::uuid`;
}

/**
 * Corrige e-mail de um assinante ainda pendente — cobre o caso comum de
 * digitar/colar o e-mail errado (ex: o do próprio criador, por engano) ao
 * montar o envelope. Só permite alterar enquanto ele ainda não assinou,
 * pra não reescrever histórico de quem realmente assinou o quê.
 */
export async function atualizarEmailAssinante(
  assinanteId: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const [row] = await sql`
    SELECT status, envelope_id::text FROM envelope_assinantes WHERE id = ${assinanteId}::uuid
  `;
  if (!row) return { ok: false, error: "Assinante não encontrado." };
  if (row.status === "assinado")
    return { ok: false, error: "Não é possível editar quem já assinou." };

  await sql`
    UPDATE envelope_assinantes
    SET email = ${email}, tramitasign_documento_id = NULL, tramitasign_link = NULL
    WHERE id = ${assinanteId}::uuid
  `;
  return { ok: true };
}
