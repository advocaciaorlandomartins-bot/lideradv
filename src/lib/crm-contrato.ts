/**
 * Lógica compartilhada de conversão de lead em cliente/processo quando contrato é assinado.
 * Usada pelo webhook do TramitaSign e pelo endpoint do PrevBot.
 */

import sql from "./db";

export async function converterLeadAssinado(
  leadId: string,
  contratoUrl: string | null
): Promise<{
  clientId: string | null;
  processoId: string | null;
  documentoId: string | null;
}> {
  const rows = await sql`
    SELECT nome, email, telefone, tipo, empresa, area_interesse,
           client_id::text, processo_id::text, contrato_url
    FROM crm_leads WHERE id = ${leadId}::uuid
  `;
  if (rows.length === 0)
    return { clientId: null, processoId: null, documentoId: null };

  const lead = rows[0] as {
    nome: string;
    email: string | null;
    telefone: string | null;
    tipo: string;
    empresa: string | null;
    area_interesse: string | null;
    client_id: string | null;
    processo_id: string | null;
    contrato_url: string | null;
  };

  const urlContrato = contratoUrl || lead.contrato_url;

  // 1. Cria cliente se ainda não existe
  let clientId: string = lead.client_id ?? "";
  if (!clientId) {
    const cr = await sql`
      INSERT INTO clients (
        type, name, doc, email, phone,
        cep, street, addr_number, neighborhood, city, state,
        status, notes
      ) VALUES (
        ${lead.tipo ?? "PF"},
        ${lead.nome},
        '',
        ${lead.email ?? ""},
        ${lead.telefone ?? ""},
        '', '', '', '', '', '',
        'ativo',
        ${lead.empresa ? `Empresa: ${lead.empresa}` : null}
      )
      RETURNING id::text
    `;
    clientId = cr[0].id as string;
    await sql`UPDATE crm_leads SET client_id = ${clientId}::uuid WHERE id = ${leadId}::uuid`;
  }

  // 2. Cria processo em Análise se ainda não existe
  let processoId: string = lead.processo_id ?? "";
  if (!processoId) {
    const area = (lead.area_interesse as string | null) ?? "Previdenciário";
    const pr = await sql`
      INSERT INTO processos (
        client_id, lead_id, tipo_acao, area,
        status, estagio_producao, data_estagio_at
      ) VALUES (
        ${clientId}::uuid,
        ${leadId}::uuid,
        ${area},
        ${area},
        'ativo',
        'analise',
        NOW()
      )
      RETURNING id::text
    `;
    processoId = pr[0].id as string;
    await sql`UPDATE crm_leads SET processo_id = ${processoId}::uuid WHERE id = ${leadId}::uuid`;
  }

  // 3. Salva contrato em documentos vinculado ao cliente (idempotente)
  let documentoId: string | null = null;
  if (urlContrato) {
    const docExiste = await sql`
      SELECT id::text FROM documentos
      WHERE entity_type = 'cliente' AND entity_id = ${clientId}::uuid AND tipo = 'contrato'
      LIMIT 1
    `;
    if (docExiste.length === 0) {
      const docRows = await sql`
        INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
        VALUES ('cliente', ${clientId}::uuid, 'Contrato de Honorários', 'contrato', 0, ${urlContrato}, ${urlContrato})
        RETURNING id::text
      `;
      documentoId = docRows[0].id as string;
    } else {
      documentoId = docExiste[0].id as string;
    }
  }

  // 4. Fecha o lead
  await sql`
    UPDATE crm_leads SET estagio = 'fechado', updated_at = NOW()
    WHERE id = ${leadId}::uuid
  `;

  return { clientId, processoId, documentoId };
}
