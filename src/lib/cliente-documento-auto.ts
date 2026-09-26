import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sql from "./db";
import { logAction } from "./audit";
import { extractText } from "./anthropic-text";
import type { MembroFamilia } from "./clients-db";

/**
 * Preenchimento automático do cadastro do cliente a partir de dado
 * reconhecido depois do cadastro inicial — documento anexado (RG,
 * comprovante de residência, carta do INSS, laudo médico etc.) ou dado
 * reconhecido pela Íris numa conversa. Mesmo princípio do write-back que já
 * existe pra documento de processo em cerebroJuridico.ts (analisarDocumento),
 * só que aqui não depende de o cliente já ter um processo cadastrado.
 *
 * Regra de segurança: só preenche campo que está NULO/vazio hoje — nunca
 * sobrescreve um dado que já existe (mesmo que a IA leia algo diferente),
 * porque não tem como saber qual das duas versões está certa.
 */

export interface DadosClienteExtraidos {
  doc?: string | null;
  rg?: string | null;
  rg_orgao?: string | null;
  birth_date?: string | null;
  genero?: string | null;
  filiacao_mae?: string | null;
  filiacao_pai?: string | null;
  naturalidade_cidade?: string | null;
  naturalidade_estado?: string | null;
  cep?: string | null;
  street?: string | null;
  addr_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  nis?: string | null;
  num_beneficio?: string | null;
  status_beneficio?: string | null;
  tipo_beneficio?: string | null;
  data_inicio_beneficio?: string | null;
  valor_beneficio?: number | null;
  categoria_contribuinte?: string | null;
  cid_principal?: string | null;
  tipo_incapacidade?: string | null;
  data_diagnostico?: string | null;
  data_afastamento?: string | null;
  atividade_anterior?: string | null;
  num_contribuicoes?: number | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
  responsavel_parentesco?: string | null;
  responsavel_cpf?: string | null;
  responsavel_rg?: string | null;
  responsavel_rg_orgao?: string | null;
  responsavel_email?: string | null;
  renda_familiar_per_capita?: string | null;
}

const CAMPOS_DATA = new Set([
  "birth_date",
  "data_inicio_beneficio",
  "data_diagnostico",
  "data_afastamento",
]);
const CAMPOS_NUMERICOS = new Set(["valor_beneficio", "num_contribuicoes"]);
// Campos onde o cadastro/importação automática grava um placeholder em vez
// de deixar NULL — sem tratar isso como "vazio", o dado real nunca entraria
// por cima do "PENDENTE"/"--".
const PLACEHOLDERS = new Set(["PENDENTE", "--"]);

// Uso de sql.query (placeholders $1/$2 reais, não sql`` do Neon) exige
// interpolar o NOME da coluna direto na string — só é seguro porque todo
// `campo` é validado contra esta whitelist antes de entrar na query, nunca
// vem direto de input externo sem passar por essa checagem.
const CAMPOS_PERMITIDOS = new Set<keyof DadosClienteExtraidos>([
  "doc",
  "rg",
  "rg_orgao",
  "birth_date",
  "genero",
  "filiacao_mae",
  "filiacao_pai",
  "naturalidade_cidade",
  "naturalidade_estado",
  "cep",
  "street",
  "addr_number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "phone",
  "email",
  "nis",
  "num_beneficio",
  "status_beneficio",
  "tipo_beneficio",
  "data_inicio_beneficio",
  "valor_beneficio",
  "categoria_contribuinte",
  "cid_principal",
  "tipo_incapacidade",
  "data_diagnostico",
  "data_afastamento",
  "atividade_anterior",
  "num_contribuicoes",
  "responsavel_nome",
  "responsavel_telefone",
  "responsavel_parentesco",
  "responsavel_cpf",
  "responsavel_rg",
  "responsavel_rg_orgao",
  "responsavel_email",
  "renda_familiar_per_capita",
]);

/**
 * Aplica os campos de `dados` no cliente `clienteId`, um por um, só quando
 * o campo atual estiver vazio (NULL, string vazia ou placeholder). Devolve
 * a lista dos campos que de fato mudaram. Usada tanto pela extração
 * automática de documento quanto pela ferramenta da Íris — mesma regra,
 * um lugar só.
 */
export async function aplicarCamposClienteSeVazios(
  clienteId: string,
  dados: DadosClienteExtraidos,
  origem: string
): Promise<string[]> {
  const campos = (Object.keys(dados) as (keyof DadosClienteExtraidos)[]).filter(
    (c) => CAMPOS_PERMITIDOS.has(c)
  );
  if (campos.length === 0) return [];

  const colunas = campos.join(", ");
  const [atual] = (await sql
    .query(
      `SELECT ${colunas} FROM clients WHERE id = $1::uuid AND deleted_at IS NULL`,
      [clienteId]
    )
    .catch(() => [null])) as [Record<string, unknown> | null];
  if (!atual) return [];

  const vazio = (v: unknown) =>
    v === null ||
    v === undefined ||
    v === "" ||
    (typeof v === "string" && PLACEHOLDERS.has(v));

  const elegiveis: (keyof DadosClienteExtraidos)[] = [];
  for (const campo of campos) {
    const novoValor = dados[campo];
    if (novoValor === null || novoValor === undefined || novoValor === "")
      continue;
    if (!vazio(atual[campo])) continue;
    elegiveis.push(campo);
  }
  if (elegiveis.length === 0) return [];

  // Só entra na lista devolvida (e no que é anunciado como "preenchido")
  // se o UPDATE realmente confirmou — antes o campo era considerado
  // preenchido só por ELEGIBILIDADE, mesmo quando o UPDATE falhava e o
  // erro era engolido: a Íris/o cadastro diziam "atualizado" pro usuário
  // sem o dado ter sido gravado de verdade.
  const preenchidos: (keyof DadosClienteExtraidos)[] = [];
  for (const campo of elegiveis) {
    const valor = dados[campo];
    const cast = CAMPOS_DATA.has(campo)
      ? "::date"
      : CAMPOS_NUMERICOS.has(campo)
        ? "::numeric"
        : "";
    const ok = await sql
      .query(`UPDATE clients SET ${campo} = $1${cast} WHERE id = $2::uuid`, [
        valor,
        clienteId,
      ])
      .then(() => true)
      .catch((e) => {
        console.error(
          `[cliente-documento-auto] falha ao gravar campo "${campo}":`,
          e
        );
        return false;
      });
    if (ok) preenchidos.push(campo);
  }
  if (preenchidos.length === 0) return [];

  await logAction({
    acao: "editar",
    entidade: "cliente",
    entidadeId: clienteId,
    descricao: `Preenchimento automático (${origem}): ${preenchidos.join(", ")}`,
    _login: "sistema (IA)",
  }).catch(() => null);

  return preenchidos;
}

const EXTRACTION_PROMPT = `Extraia todos os dados deste documento brasileiro e retorne SOMENTE o JSON abaixo. Pode ser um documento de identificação, um comprovante de residência (conta de água/luz/telefone, contrato de aluguel), um documento médico/previdenciário (carta de concessão/indeferimento do INSS, extrato do CNIS, laudo médico, atestado) ou o Comprovante de Cadastro do CadÚnico (Ministério do Desenvolvimento e Assistência Social). Preencha só os campos que existirem nesse tipo de documento — campos ausentes, ilegíveis ou que não se aplicam ao documento devem ter valor null. Nunca invente dado que não esteja explícito no documento.

Se o documento for o Comprovante de Cadastro do CadÚnico: "renda_familiar_per_capita" é o texto da faixa em "Faixa de renda familiar por pessoa (per capita)" (ex: "Entre R$ 210,01 até meio salário mínimo") — NUNCA use a "Faixa de renda familiar total" para esse campo, são faixas diferentes. "membros_familia" é a lista completa da tabela "Integrantes da família", um item por linha, incluindo a Pessoa Responsável pela Unidade Familiar.

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
  "num_contribuicoes": "número inteiro de contribuições, se constar",
  "renda_familiar_per_capita": "faixa de renda per capita (CadÚnico)",
  "membros_familia": [
    {
      "nome": "Nome completo",
      "parentesco": "Parentesco com o RF (ou 'Pessoa Responsável pela Unidade Familiar')",
      "data_nascimento": "YYYY-MM-DD",
      "cpf": "000.000.000-00"
    }
  ]
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
export function parseMembrosFamilia(v: unknown): MembroFamilia[] | null {
  if (!Array.isArray(v)) return null;
  const membros = v
    .map((item): MembroFamilia | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const nome = strOrNull(o.nome);
      if (!nome) return null;
      return {
        nome,
        parentesco: strOrNull(o.parentesco),
        data_nascimento: normDate(o.data_nascimento),
        cpf: strOrNull(o.cpf),
      };
    })
    .filter((m): m is MembroFamilia => m !== null);
  return membros.length > 0 ? membros : null;
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
      max_tokens: 1536,
      messages: [{ role: "user", content }],
    },
    isPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : {}
  );
  const rawText = extractText(aiResp);
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return { camposPreenchidos: [] };

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(match[0]);
  } catch {
    return { camposPreenchidos: [] };
  }

  const dados: DadosClienteExtraidos = {
    doc: strOrNull(extracted.cpf),
    rg: strOrNull(extracted.rg),
    rg_orgao: strOrNull(extracted.rg_orgao),
    birth_date: normDate(extracted.birth_date),
    genero: strOrNull(extracted.genero),
    filiacao_mae: strOrNull(extracted.mother_name),
    filiacao_pai: strOrNull(extracted.father_name),
    naturalidade_cidade: strOrNull(extracted.naturalidade_city),
    naturalidade_estado: strOrNull(extracted.naturalidade_state),
    cep: strOrNull(extracted.zipcode),
    street: strOrNull(extracted.street),
    addr_number: strOrNull(extracted.addr_number),
    complement: strOrNull(extracted.complement),
    neighborhood: strOrNull(extracted.neighborhood),
    city: strOrNull(extracted.city),
    state: strOrNull(extracted.state),
    nis: strOrNull(extracted.nis),
    num_beneficio: strOrNull(extracted.num_beneficio),
    status_beneficio: strOrNull(extracted.status_beneficio),
    tipo_beneficio: strOrNull(extracted.tipo_beneficio),
    data_inicio_beneficio: normDate(extracted.data_inicio_beneficio),
    valor_beneficio: numOrNull(extracted.valor_beneficio),
    categoria_contribuinte: strOrNull(extracted.categoria_contribuinte),
    cid_principal: strOrNull(extracted.cid_principal),
    tipo_incapacidade: strOrNull(extracted.tipo_incapacidade),
    data_diagnostico: normDate(extracted.data_diagnostico),
    data_afastamento: normDate(extracted.data_afastamento),
    atividade_anterior: strOrNull(extracted.atividade_anterior),
    num_contribuicoes: numOrNull(extracted.num_contribuicoes),
    renda_familiar_per_capita: strOrNull(extracted.renda_familiar_per_capita),
  };
  // Remove chaves null pra aplicarCamposClienteSeVazios só considerar o que
  // o documento realmente trouxe.
  for (const k of Object.keys(dados) as (keyof DadosClienteExtraidos)[]) {
    if (dados[k] === null) delete dados[k];
  }

  const preenchidos = await aplicarCamposClienteSeVazios(
    clienteId,
    dados,
    `documento "${doc.nome}"`
  );

  const gravouMembros = await aplicarMembrosFamiliaSeVazio(
    clienteId,
    extracted.membros_familia,
    `documento "${doc.nome}"`
  );
  if (gravouMembros) preenchidos.push("membros_familia");

  return { camposPreenchidos: preenchidos };
}

/**
 * membros_familia é JSONB (lista de {nome, parentesco, data_nascimento,
 * cpf}) — fora do mecanismo genérico de colunas escalares de
 * aplicarCamposClienteSeVazios. Mesma regra de não sobrescrever: só grava
 * se o cliente ainda não tem nenhum membro cadastrado. Reaproveitada tanto
 * pela extração em documento de cliente (acima) quanto pela extração em
 * documento de processo (cerebroJuridico.ts:analisarDocumento) — CadÚnico
 * pode ser anexado em qualquer um dos dois lugares.
 */
export async function aplicarMembrosFamiliaSeVazio(
  clienteId: string,
  rawMembrosFamilia: unknown,
  origem: string
): Promise<boolean> {
  const membrosFamilia = parseMembrosFamilia(rawMembrosFamilia);
  if (!membrosFamilia) return false;

  const [atual] = await sql`
    SELECT membros_familia FROM clients
    WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
  `.catch(() => [null]);
  const jaTemMembros =
    Array.isArray(atual?.membros_familia) && atual.membros_familia.length > 0;
  if (!atual || jaTemMembros) return false;

  const ok = await sql`
    UPDATE clients SET membros_familia = ${JSON.stringify(membrosFamilia)}::jsonb
    WHERE id = ${clienteId}::uuid
  `
    .then(() => true)
    .catch((e) => {
      console.error(
        "[cliente-documento-auto] falha ao gravar membros_familia:",
        e
      );
      return false;
    });
  if (ok) {
    await logAction({
      acao: "editar",
      entidade: "cliente",
      entidadeId: clienteId,
      descricao: `Preenchimento automático (${origem}): membros_familia`,
      _login: "sistema (IA)",
    }).catch(() => null);
  }
  return ok;
}
