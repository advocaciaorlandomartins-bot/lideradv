import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import {
  extractPdfContent,
  isSupportedImage,
  type ContentPart,
} from "@/lib/pdf-extract";

export const dynamic = "force-dynamic";

const EXTRACTION_PROMPT = `Extraia todos os dados deste documento brasileiro e retorne SOMENTE o JSON abaixo. Pode ser um documento de identificação, um comprovante de residência (conta de água/luz/telefone, contrato de aluguel) ou um documento médico/previdenciário (carta de concessão/indeferimento do INSS, extrato do CNIS, laudo médico, atestado). Preencha só os campos que existirem nesse tipo de documento — campos ausentes, ilegíveis ou que não se aplicam ao documento devem ter valor null.

{
  "name": "Nome completo",
  "cpf": "000.000.000-00",
  "rg": "00.000.000-0",
  "rg_orgao": "SSP/UF",
  "rg_data_emissao": "YYYY-MM-DD",
  "birth_date": "YYYY-MM-DD",
  "genero": "Masculino|Feminino|null",
  "father_name": "Nome do pai",
  "mother_name": "Nome da mãe",
  "cnh_numero": "00000000000",
  "cnh_categoria": "AB",
  "cnh_validade": "YYYY-MM-DD",
  "naturalidade_city": "Cidade",
  "naturalidade_state": "UF",
  "zipcode": "00000-000",
  "street": "Logradouro",
  "addr_number": "000",
  "complement": "Complemento (apto, bloco, casa dos fundos etc)",
  "neighborhood": "Bairro",
  "city": "Cidade",
  "state": "UF",
  "nis": "NIS/PIS/PASEP, só dígitos",
  "num_beneficio": "Número do benefício (NB) do INSS",
  "status_beneficio": "ativo|suspenso|cessado|nao_recebe|null — status atual do benefício, se identificável",
  "tipo_beneficio": "descrição do benefício, ex: Auxílio-doença, Aposentadoria por invalidez, BPC/LOAS, Pensão por morte",
  "data_inicio_beneficio": "YYYY-MM-DD (DIB — data de início do benefício)",
  "valor_beneficio": "valor numérico sem formatação, ex: 1518.00",
  "categoria_contribuinte": "empregado|individual|especial|avulso|facultativo|null",
  "cid_principal": "Código CID-10 do diagnóstico principal, ex: M54.5",
  "tipo_incapacidade": "permanente|temporaria|nao_se_aplica|null",
  "data_diagnostico": "YYYY-MM-DD",
  "data_afastamento": "YYYY-MM-DD — data de afastamento do trabalho, se constar",
  "atividade_anterior": "última atividade/profissão exercida antes do afastamento, se constar",
  "num_contribuicoes": "número inteiro de contribuições/carência, se constar",
  "document_type": "RG|CNH|CPF|Passaporte|Titulo de Eleitor|Certidao de Nascimento|Certidao de Casamento|Comprovante de Residencia|Carta de Concessao INSS|Carta de Indeferimento INSS|Extrato CNIS|Laudo Medico|Outro"
}`;

export interface AiExtractedData {
  name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_orgao: string | null;
  rg_data_emissao: string | null;
  birth_date: string | null;
  genero: string | null;
  father_name: string | null;
  mother_name: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  naturalidade_city: string | null;
  naturalidade_state: string | null;
  zipcode: string | null;
  street: string | null;
  addr_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  nis: string | null;
  num_beneficio: string | null;
  status_beneficio: string | null;
  tipo_beneficio: string | null;
  data_inicio_beneficio: string | null;
  valor_beneficio: string | null;
  categoria_contribuinte: string | null;
  cid_principal: string | null;
  tipo_incapacidade: string | null;
  data_diagnostico: string | null;
  data_afastamento: string | null;
  atividade_anterior: string | null;
  num_contribuicoes: string | null;
  document_type: string | null;
}

function parseJson(raw: string): AiExtractedData | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as AiExtractedData;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "criar"))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY não configurada no servidor. Adicione-a ao .env.local.",
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envio de arquivo inválido." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "Nenhum arquivo recebido." },
      { status: 400 }
    );
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`,
      },
      { status: 422 }
    );
  }

  const fileType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const buffer = Buffer.from(await file.arrayBuffer());
  const client = new Anthropic({ apiKey });

  try {
    let rawText = "";

    if (isSupportedImage(fileType)) {
      const base64 = buffer.toString("base64");
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: fileType, data: base64 },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
      const block = res.content[0];
      rawText = block?.type === "text" ? block.text : "";
    } else if (fileType === "application/pdf") {
      let pdfContent: ContentPart[];
      try {
        pdfContent = await extractPdfContent(buffer, EXTRACTION_PROMPT);
      } catch (e) {
        console.error("PDF processing error:", e);
        return NextResponse.json(
          {
            error:
              "Não foi possível processar o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.",
          },
          { status: 422 }
        );
      }

      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: pdfContent }],
      });
      const block = res.content[0];
      rawText = block?.type === "text" ? block.text : "";
    } else {
      return NextResponse.json(
        {
          error: `Formato não suportado: ${fileType}. Use JPEG, PNG, WebP, GIF ou PDF.`,
        },
        { status: 422 }
      );
    }

    const extracted = parseJson(rawText);
    if (!extracted) {
      return NextResponse.json(
        {
          error:
            "O modelo não retornou dados estruturados. Tente com um documento mais legível.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: extracted });
  } catch (err: unknown) {
    console.error(
      "Anthropic extraction error:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro ao processar documento. Tente novamente." },
      { status: 500 }
    );
  }
}
