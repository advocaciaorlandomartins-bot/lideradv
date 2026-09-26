import "server-only";
import { put } from "@vercel/blob";
import sql from "./db";
import { converterLeadAssinado } from "./crm-contrato";

export interface SignerAtualizado {
  id: string;
  signatureLink: string | null;
  allDocumentsSigned: boolean;
}

/**
 * Baixa o PDF assinado (URL autenticada, exige o Bearer da API do
 * TramitaSign) e sobe pro NOSSO storage, salvando como documento do
 * cliente — pra abrir/baixar dali funcionar igual a qualquer outro
 * documento do sistema, sem depender de credencial do TramitaSign depois.
 * Roda pra QUALQUER envelope finalizado (criado manualmente em
 * Assinaturas ou pelo fluxo automático do PrevBot), não só leads.
 */
async function salvarPdfAssinadoNoCliente(
  clientId: string,
  nomeEnvelope: string,
  signedUrl: string
): Promise<void> {
  try {
    const apiKey = process.env.TRAMITASIGN_API_KEY;
    const res = await fetch(signedUrl, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      console.error(
        `[assinaturas-sync] falha ao baixar PDF assinado: HTTP ${res.status}`
      );
      return;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const nomeArquivo = `${nomeEnvelope.replace(/[/\\]/g, "-")} (assinado).pdf`;

    const blob = await put(
      `documentos/clientes/${clientId}/${nomeArquivo}`,
      bytes,
      {
        access: "private",
        contentType: "application/pdf",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: true,
      }
    );

    await sql`
      INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
      VALUES ('cliente', ${clientId}::uuid, ${nomeArquivo}, 'application/pdf', ${bytes.byteLength}, ${blob.pathname}, ${blob.url})
    `;
  } catch (err) {
    console.error("[assinaturas-sync] salvarPdfAssinadoNoCliente error:", err);
  }
}

/**
 * Grava no nosso banco o que o TramitaSign informou sobre um envelope —
 * usado tanto pelo webhook (POST /api/webhooks/tramitasign/contratos)
 * quanto pela sincronização manual (botão "Verificar status" na tela do
 * envelope), pra não duplicar essa lógica em dois lugares. Atualiza o
 * link/status de cada assinante e, se o envelope terminou (`finalizado`),
 * marca nosso envelope como concluído e — se for um lead do PrevBot —
 * converte o lead e avisa o PrevBot de volta.
 */
export async function processarAtualizacaoEnvelope(params: {
  envelopeId: string; // nosso uuid
  remoteStatus: string;
  signers: SignerAtualizado[];
  signedUrl: string | null;
}): Promise<{ finalizado: boolean }> {
  const { envelopeId, remoteStatus, signers, signedUrl } = params;

  for (const s of signers) {
    if (!s.id) continue;
    if (s.signatureLink) {
      await sql`
        UPDATE envelope_assinantes
        SET tramitasign_link = ${s.signatureLink}, tramitasign_erro = NULL
        WHERE envelope_id = ${envelopeId}::uuid AND tramitasign_signer_id = ${s.id}
      `;
    }
    if (s.allDocumentsSigned) {
      await sql`
        UPDATE envelope_assinantes
        SET status = 'assinado', assinado_em = COALESCE(assinado_em, now())
        WHERE envelope_id = ${envelopeId}::uuid AND tramitasign_signer_id = ${s.id}
      `;
    }
  }

  const [nosso] = await sql`
    SELECT status, nome, client_id::text FROM envelopes WHERE id = ${envelopeId}::uuid
  `;
  const finalizado = remoteStatus === "finalizado";
  const eraConcluidoAntes = nosso?.status === "concluido";

  // Grava o status bruto em toda sincronização (webhook ou manual), mesmo
  // quando não muda nosso status local — sem isso não tem como diagnosticar
  // um envelope que fica preso "aguardando" enquanto o assinante já
  // aparece "assinado" (o remoto pode estar num estado intermediário, ex:
  // "finalizando", que não é nem sucesso nem erro).
  await sql`
    UPDATE envelopes
    SET tramitasign_ultimo_status = ${remoteStatus},
        tramitasign_ultima_sync = now()
    WHERE id = ${envelopeId}::uuid
  `.catch(() => null);

  if (finalizado && !eraConcluidoAntes) {
    await sql`
      UPDATE envelopes SET status = 'concluido', atualizado_em = now()
      WHERE id = ${envelopeId}::uuid
    `;
  } else if (
    (remoteStatus === "cancelado" || remoteStatus === "falhou") &&
    nosso?.status !== remoteStatus
  ) {
    // Sem isso, um envelope cancelado ou que falhou do lado do TramitaSign
    // (PDF não pôde ser preparado etc.) ficava marcado "aguardando" pra
    // sempre no nosso sistema, sem nada avisando que não vai mesmo sair
    // do lugar.
    await sql`
      UPDATE envelopes SET status = ${remoteStatus}, atualizado_em = now()
      WHERE id = ${envelopeId}::uuid
    `;
  }

  if (!finalizado) return { finalizado: false };

  // Só salva o PDF assinado na primeira vez que o envelope é reconhecido
  // como concluído — evita duplicar o documento se o webhook reenviar o
  // mesmo evento (providers de webhook costumam reenviar em timeout).
  if (!eraConcluidoAntes && signedUrl && nosso?.client_id) {
    await salvarPdfAssinadoNoCliente(nosso.client_id, nosso.nome, signedUrl);
  }

  // Envelope concluído — se for um lead do PrevBot (contrato_id = nosso
  // envelope_id), converte e avisa o PrevBot de volta.
  const updated = await sql`
    UPDATE crm_leads SET
      contrato_status      = 'assinado',
      contrato_url         = COALESCE(${signedUrl}, contrato_url),
      contrato_assinado_em = COALESCE(contrato_assinado_em, now()),
      updated_at           = now()
    WHERE contrato_id = ${envelopeId}
    RETURNING id::text, nome, telefone, contrato_url, prevbot_lead_id
  `;

  if (updated.length === 0) return { finalizado: true };

  const lead = updated[0] as {
    id: string;
    nome: string;
    telefone: string;
    contrato_url: string | null;
    prevbot_lead_id: string | null;
  };

  await converterLeadAssinado(lead.id, signedUrl || lead.contrato_url);

  const prevbotCallbackUrl = process.env.PREVBOT_CALLBACK_URL;
  if (prevbotCallbackUrl) {
    try {
      await fetch(prevbotCallbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CONTRATO_WEBHOOK_SECRET && {
            Authorization: `Bearer ${process.env.CONTRATO_WEBHOOK_SECRET}`,
          }),
        },
        body: JSON.stringify({
          contrato_id: envelopeId,
          document_id: envelopeId,
          prevbot_lead_id: lead.prevbot_lead_id,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error("[assinaturas-sync] Falha ao notificar PrevBot:", err);
    }
  }

  return { finalizado: true };
}
