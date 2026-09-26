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
  nomeDocumento: string,
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
    const nomeArquivo = `${nomeDocumento.replace(/[/\\]/g, "-")} (assinado).pdf`;

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
  signedUrls: string[];
}): Promise<{ finalizado: boolean }> {
  const { envelopeId, remoteStatus, signers, signedUrls } = params;

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
  const jaConcluido = nosso?.status === "concluido";

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

  // UPDATE condicional e atômico (WHERE status <> 'concluido' RETURNING
  // id) em vez de checar `jaConcluido` em memória e depois fazer um
  // UPDATE incondicional — webhooks reenviam o mesmo evento em timeout, e
  // duas entregas quase simultâneas podiam ler "ainda não concluído" antes
  // de qualquer uma commitar, passando as duas pelo salvamento do PDF e
  // pelo aviso ao PrevBot (documento duplicado nos Documentos do cliente,
  // callback duplicado). Só a entrega que realmente muda a linha segue.
  let transicaoParaConcluido = false;
  if (finalizado && !jaConcluido) {
    const [transicao] = await sql`
      UPDATE envelopes SET status = 'concluido', atualizado_em = now()
      WHERE id = ${envelopeId}::uuid AND status <> 'concluido'
      RETURNING id
    `;
    transicaoParaConcluido = !!transicao;
  } else if (
    (remoteStatus === "cancelado" || remoteStatus === "falhou") &&
    nosso?.status !== remoteStatus &&
    !jaConcluido
  ) {
    // Sem isso, um envelope cancelado ou que falhou do lado do TramitaSign
    // (PDF não pôde ser preparado etc.) ficava marcado "aguardando" pra
    // sempre no nosso sistema, sem nada avisando que não vai mesmo sair
    // do lugar. `!jaConcluido` evita o cenário oposto: um evento
    // cancelado/falhou chegando atrasado ou fora de ordem DEPOIS do
    // envelope já ter sido legitimamente assinado e concluído não pode
    // reverter esse status — o PDF assinado já está na área do cliente.
    await sql`
      UPDATE envelopes SET status = ${remoteStatus}, atualizado_em = now()
      WHERE id = ${envelopeId}::uuid
    `;
  }

  if (!finalizado) return { finalizado: false };
  if (!transicaoParaConcluido) return { finalizado: true };

  // Salva TODOS os documentos assinados do envelope na área do cliente —
  // um envelope pode ter mais de um documento (wizard permite selecionar
  // vários modelos), correlacionados pela mesma ordem em que foram
  // enviados ao TramitaSign (envelope_documentos.ordem).
  if (signedUrls.length > 0 && nosso?.client_id) {
    const documentos = await sql`
      SELECT nome FROM envelope_documentos
      WHERE envelope_id = ${envelopeId}::uuid
      ORDER BY ordem
    `;
    for (let i = 0; i < signedUrls.length; i++) {
      const nomeDoc =
        (documentos[i]?.nome as string | undefined) ??
        `${nosso.nome} (${i + 1})`;
      await salvarPdfAssinadoNoCliente(nosso.client_id, nomeDoc, signedUrls[i]);
    }
  }

  // Envelope concluído — se for um lead do PrevBot (contrato_id = nosso
  // envelope_id), converte e avisa o PrevBot de volta.
  const primeiroUrl = signedUrls[0] ?? null;
  const updated = await sql`
    UPDATE crm_leads SET
      contrato_status      = 'assinado',
      contrato_url         = COALESCE(${primeiroUrl}, contrato_url),
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

  await converterLeadAssinado(lead.id, primeiroUrl || lead.contrato_url);

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
