import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sql from "./db";
import { logAction } from "./audit";

/**
 * Preenchimento automático do cadastro do cliente a partir de QUALQUER
 * documento anexado depois (RG, comprovante de residência, carta do INSS,
 * laudo médico etc.) — mesmo princípio do write-back que já existe pra
 * documento de processo em cerebroJuridico.ts (analisarDocumento), só que
 * aqui não depende de o cliente já ter um processo cadastrado.
 *
 * Regra de segurança: só preenche campo que está NULO/vazio hoje — nunca
 * sobrescreve um dado que já existe (mesmo que a IA leia algo diferente),
 * porque não tem como saber qual das duas versões está certa.
 */

const EXTRACTION_PROMPT = `Extraia todos os dados deste documento brasileiro e retorne SOMENTE o JSON abaixo. Pode ser um documento de identificação, um comprovante de residência (conta de água/luz/telefone, contrato de aluguel) ou um documento médico/previdenciário (carta de concessão/indeferimento do INSS, extrato do CNIS, laudo médico, atestado). Preencha só os campos que existirem nesse tipo de documento — campos ausentes, ilegíveis ou que não se aplicam ao documento devem ter valor null. Nunca invente dado que não esteja explícito no documento.

{
  "cpf": "000.000.000-00",
  "rg": "00.000.000-0",
  "rg_orgao": "SSP/UF",
  "birth_date": "YYYY-MM-DD",
  "genero": "Masculino|Feminino|null",
  "mother_name": "Nome da mãe",
  "father_name": "Nome do pai",
  "naturalidade_city": "Cidade",
  "naturalidade_state": "UF",
  "zipcode": "00000-000",
  "street": "Logradouro",
  "addr_number": "000",
  "complement": "Complemento",
  "neighborhood": "Bairro",
  "city": "Cidade",
  "state": "UF",
  "nis": "NIS/PIS/PASEP, só dígitos",
  "num_beneficio": "Número do benefício (NB) do INSS",
  "status_beneficio": "ativo|suspenso|cessado|nao_recebe|null",
  "tipo_beneficio": "descrição do benefício, ex: Auxílio-doença, BPC/LOAS",
  "data_inicio_beneficio": "YYYY-MM-DD",
  "valor_beneficio": "valor numérico sem formatação, ex: 1518.00",
  "categoria_contribuinte": "empregado|individual|especial|avulso|facultativo|null",
  "cid_principal": "Código CID-10 do diagnóstico principal",
  "tipo_incapacidade": "permanente|temporaria|nao_se_aplica|null",
  "data_diagnostico": "YYYY-MM-DD",
  "data_afastamento": "YYYY-MM-DD",
  "atividade_anterior": "última profissão antes do afastamento",
  "num_contribuicoes": "número inteiro de contribuições, se constar"
}`;

function strOrNull(v: unknown): string | null {
  return v !== null && v !== undefined && String(v).trim() !== ""
    ? String(v).trim()
    : null;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return !isNaN(n) ? n : null;
}
function normDate(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  const brMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

export async function analisarDocumentoCliente(
  documentoId: string,
  clienteId: string
): Promise<{ camposPreenchidos: string[] }> {
  const [doc] =
    await sql`SELECT * FROM documentos WHERE id = ${documentoId}::uuid`;
  if (!doc) return { camposPreenchidos: [] };

  const docUrl = doc.url as string;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const resp =
    docUrl.includes(".private.blob.vercel-storage.com") && blobToken
      ? await fetch(docUrl, {
          headers: { Authorization: `Bearer ${blobToken}` },
        })
      : await fetch(docUrl);
  if (!resp.ok) return { camposPreenchidos: [] };

  const buffer = await resp.arrayBuffer();
  const b64 = Buffer.from(buffer).toString("base64");
  const mime = (doc.tipo as string) || "application/pdf";
  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  if (!isPdf && !isImage) return { camposPreenchidos: [] };

  const content: Anthropic.MessageParam["content"] = [
    isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: b64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mime as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: b64,
          },
        },
    { type: "text", text: EXTRACTION_PROMPT },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const aiResp = await client.messages.create(
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    },
    isPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : {}
  );
  const rawText =
    aiResp.content[0].type === "text" ? aiResp.content[0].text : "";
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return { camposPreenchidos: [] };

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(match[0]);
  } catch {
    return { camposPreenchidos: [] };
  }

  const [atual] = await sql`
    SELECT doc, rg, rg_orgao, birth_date, genero, filiacao_mae, filiacao_pai,
           naturalidade_cidade, naturalidade_estado,
           cep, street, addr_number, complement, neighborhood, city, state,
           nis, num_beneficio, status_beneficio, tipo_beneficio,
           data_inicio_beneficio, valor_beneficio, categoria_contribuinte,
           cid_principal, tipo_incapacidade, data_diagnostico,
           data_afastamento, atividade_anterior, num_contribuicoes
    FROM clients WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
  `;
  if (!atual) return { camposPreenchidos: [] };

  // Placeholder do import automático (ver client-actions/api/inss confirmar)
  // conta como "vazio" — senão o dado real nunca entraria por cima do "PENDENTE".
  const vazio = (v: unknown) =>
    v === null || v === undefined || v === "" || v === "PENDENTE" || v === "--";

  const candidatos: Array<{
    campo: string;
    valor: string | number | null;
  }> = [
    { campo: "doc", valor: strOrNull(extracted.cpf) },
    { campo: "rg", valor: strOrNull(extracted.rg) },
    { campo: "rg_orgao", valor: strOrNull(extracted.rg_orgao) },
    { campo: "birth_date", valor: normDate(extracted.birth_date) },
    { campo: "genero", valor: strOrNull(extracted.genero) },
    { campo: "filiacao_mae", valor: strOrNull(extracted.mother_name) },
    { campo: "filiacao_pai", valor: strOrNull(extracted.father_name) },
    {
      campo: "naturalidade_cidade",
      valor: strOrNull(extracted.naturalidade_city),
    },
    {
      campo: "naturalidade_estado",
      valor: strOrNull(extracted.naturalidade_state),
    },
    { campo: "cep", valor: strOrNull(extracted.zipcode) },
    { campo: "street", valor: strOrNull(extracted.street) },
    { campo: "addr_number", valor: strOrNull(extracted.addr_number) },
    { campo: "complement", valor: strOrNull(extracted.complement) },
    { campo: "neighborhood", valor: strOrNull(extracted.neighborhood) },
    { campo: "city", valor: strOrNull(extracted.city) },
    { campo: "state", valor: strOrNull(extracted.state) },
    { campo: "nis", valor: strOrNull(extracted.nis) },
    { campo: "num_beneficio", valor: strOrNull(extracted.num_beneficio) },
    { campo: "status_beneficio", valor: strOrNull(extracted.status_beneficio) },
    { campo: "tipo_beneficio", valor: strOrNull(extracted.tipo_beneficio) },
    {
      campo: "data_inicio_beneficio",
      valor: normDate(extracted.data_inicio_beneficio),
    },
    { campo: "valor_beneficio", valor: numOrNull(extracted.valor_beneficio) },
    {
      campo: "categoria_contribuinte",
      valor: strOrNull(extracted.categoria_contribuinte),
    },
    { campo: "cid_principal", valor: strOrNull(extracted.cid_principal) },
    {
      campo: "tipo_incapacidade",
      valor: strOrNull(extracted.tipo_incapacidade),
    },
    { campo: "data_diagnostico", valor: normDate(extracted.data_diagnostico) },
    { campo: "data_afastamento", valor: normDate(extracted.data_afastamento) },
    {
      campo: "atividade_anterior",
      valor: strOrNull(extracted.atividade_anterior),
    },
    {
      campo: "num_contribuicoes",
      valor: numOrNull(extracted.num_contribuicoes),
    },
  ];

  const preenchidos: string[] = [];
  for (const { campo, valor } of candidatos) {
    if (valor === null) continue;
    if (!vazio((atual as Record<string, unknown>)[campo])) continue;
    preenchidos.push(campo);
  }
  if (preenchidos.length === 0) return { camposPreenchidos: [] };

  // COALESCE trata "PENDENTE"/"--" como se fosse null via NULLIF, mantendo
  // o valor real se já não for placeholder.
  await sql`
    UPDATE clients SET
      doc                    = COALESCE(NULLIF(NULLIF(doc, 'PENDENTE'), ''),                       ${candidatos.find((c) => c.campo === "doc")!.valor as string | null}),
      rg                     = COALESCE(rg,                                                          ${candidatos.find((c) => c.campo === "rg")!.valor as string | null}),
      rg_orgao               = COALESCE(rg_orgao,                                                    ${candidatos.find((c) => c.campo === "rg_orgao")!.valor as string | null}),
      birth_date             = COALESCE(birth_date,                                                  ${candidatos.find((c) => c.campo === "birth_date")!.valor as string | null}::date),
      genero                 = COALESCE(genero,                                                      ${candidatos.find((c) => c.campo === "genero")!.valor as string | null}),
      filiacao_mae           = COALESCE(filiacao_mae,                                                ${candidatos.find((c) => c.campo === "filiacao_mae")!.valor as string | null}),
      filiacao_pai           = COALESCE(filiacao_pai,                                                ${candidatos.find((c) => c.campo === "filiacao_pai")!.valor as string | null}),
      naturalidade_cidade    = COALESCE(naturalidade_cidade,                                         ${candidatos.find((c) => c.campo === "naturalidade_cidade")!.valor as string | null}),
      naturalidade_estado    = COALESCE(naturalidade_estado,                                         ${candidatos.find((c) => c.campo === "naturalidade_estado")!.valor as string | null}),
      cep                    = COALESCE(NULLIF(NULLIF(cep, 'PENDENTE'), ''),                         ${candidatos.find((c) => c.campo === "cep")!.valor as string | null}),
      street                 = COALESCE(NULLIF(NULLIF(street, 'PENDENTE'), ''),                      ${candidatos.find((c) => c.campo === "street")!.valor as string | null}),
      addr_number            = COALESCE(NULLIF(NULLIF(addr_number, 'PENDENTE'), ''),                 ${candidatos.find((c) => c.campo === "addr_number")!.valor as string | null}),
      complement             = COALESCE(complement,                                                  ${candidatos.find((c) => c.campo === "complement")!.valor as string | null}),
      neighborhood           = COALESCE(NULLIF(NULLIF(neighborhood, 'PENDENTE'), ''),                ${candidatos.find((c) => c.campo === "neighborhood")!.valor as string | null}),
      city                   = COALESCE(NULLIF(NULLIF(city, 'PENDENTE'), ''),                        ${candidatos.find((c) => c.campo === "city")!.valor as string | null}),
      state                  = COALESCE(NULLIF(NULLIF(state, '--'), ''),                             ${candidatos.find((c) => c.campo === "state")!.valor as string | null}),
      nis                    = COALESCE(nis,                                                          ${candidatos.find((c) => c.campo === "nis")!.valor as string | null}),
      num_beneficio          = COALESCE(num_beneficio,                                                ${candidatos.find((c) => c.campo === "num_beneficio")!.valor as string | null}),
      status_beneficio       = COALESCE(status_beneficio,                                             ${candidatos.find((c) => c.campo === "status_beneficio")!.valor as string | null}),
      tipo_beneficio         = COALESCE(tipo_beneficio,                                               ${candidatos.find((c) => c.campo === "tipo_beneficio")!.valor as string | null}),
      data_inicio_beneficio  = COALESCE(data_inicio_beneficio,                                        ${candidatos.find((c) => c.campo === "data_inicio_beneficio")!.valor as string | null}::date),
      valor_beneficio        = COALESCE(valor_beneficio,                                              ${candidatos.find((c) => c.campo === "valor_beneficio")!.valor as number | null}),
      categoria_contribuinte = COALESCE(categoria_contribuinte,                                       ${candidatos.find((c) => c.campo === "categoria_contribuinte")!.valor as string | null}),
      cid_principal          = COALESCE(cid_principal,                                                ${candidatos.find((c) => c.campo === "cid_principal")!.valor as string | null}),
      tipo_incapacidade      = COALESCE(tipo_incapacidade,                                            ${candidatos.find((c) => c.campo === "tipo_incapacidade")!.valor as string | null}),
      data_diagnostico       = COALESCE(data_diagnostico,                                             ${candidatos.find((c) => c.campo === "data_diagnostico")!.valor as string | null}::date),
      data_afastamento       = COALESCE(data_afastamento,                                             ${candidatos.find((c) => c.campo === "data_afastamento")!.valor as string | null}::date),
      atividade_anterior     = COALESCE(atividade_anterior,                                           ${candidatos.find((c) => c.campo === "atividade_anterior")!.valor as string | null}),
      num_contribuicoes      = COALESCE(num_contribuicoes,                                            ${candidatos.find((c) => c.campo === "num_contribuicoes")!.valor as number | null})
    WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
  `.catch((e) => {
    console.error("[cliente-documento-auto] falha ao atualizar cliente:", e);
    return null;
  });

  await logAction({
    acao: "editar",
    entidade: "cliente",
    entidadeId: clienteId,
    descricao: `Preenchimento automático a partir do documento "${doc.nome}": ${preenchidos.join(", ")}`,
    _login: "sistema (IA)",
  }).catch(() => null);

  return { camposPreenchidos: preenchidos };
}
