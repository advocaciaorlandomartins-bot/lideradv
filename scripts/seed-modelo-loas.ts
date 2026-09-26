import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import {
  isValidBlocks,
  flattenBlocksToText,
  type Block,
  type TextSpan,
} from "../src/lib/modelo-blocks";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

const TITULO = "Formulário LOAS";
const CATEGORIA = "Previdenciário";
const DESCRICAO =
  "Declaração de composição familiar e situação socioeconômica exigida nos Juizados Especiais Federais de Maceió/AL para processos de LOAS/BPC. A parte autora é identificada pelo nome e CPF do responsável legal cadastrado no cliente. Puxa automaticamente os dados do grupo familiar (extraídos do CadÚnico) — as seções b.1 a b.5 ficam em branco para preenchimento manual, conforme o formulário oficial.";

function t(text: string, opts: Partial<TextSpan> = {}): TextSpan {
  return { text, ...opts };
}

const BLANK_LINE =
  "____________________ ____________________ ____________________";

function blankParagraph(): Block {
  return { type: "paragraph", spans: [t(BLANK_LINE)] };
}

function membroRow(n: number): TextSpan[][] {
  return [
    [t(`{{membro${n}_nome}}`)],
    [t(`{{membro${n}_parentesco}}`)],
    [t(`{{membro${n}_nascimento}}`)],
    [t("")],
    [t(`{{membro${n}_cpf}}`)],
  ];
}

const blocks: Block[] = [
  {
    type: "paragraph",
    align: "center",
    spans: [t("PODER JUDICIÁRIO", { bold: true })],
  },
  {
    type: "paragraph",
    align: "center",
    spans: [t("SEÇÃO JUDICIÁRIA DE ALAGOAS", { bold: true })],
  },
  {
    type: "paragraph",
    align: "center",
    spans: [t("JUIZADOS ESPECIAIS FEDERAIS DE MACEIÓ", { bold: true })],
  },
  {
    type: "paragraph",
    align: "center",
    spans: [t("Av. Menino Marcelo, s/n, Serraria – Maceió/AL")],
  },
  { type: "divider" },
  {
    type: "paragraph",
    spans: [
      t("A parte autora, "),
      t("{{responsavel_nome}}", { bold: true }),
      t(", portador(a) do CPF nº "),
      t("{{responsavel_cpf}}", { bold: true }),
      t(", declara:"),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "a) que a composição de sua renda familiar corresponde ao discriminado no quadro abaixo:"
      ),
    ],
  },
  {
    type: "paragraph",
    align: "center",
    spans: [
      t("RENDA FAMILIAR (membros da família residentes sob o mesmo teto)", {
        bold: true,
      }),
    ],
  },
  {
    type: "table",
    rows: [
      [
        [t("Nome completo", { bold: true })],
        [t("Grau de parentesco", { bold: true })],
        [t("Data de nascimento", { bold: true })],
        [t("Remuneração mensal em R$", { bold: true })],
        [t("CPF", { bold: true })],
      ],
      membroRow(1),
      membroRow(2),
      membroRow(3),
      membroRow(4),
      membroRow(5),
      membroRow(6),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "Faixa de renda familiar por pessoa (per capita), conforme Cadastro Único (CadÚnico): "
      ),
      t("{{renda_familiar_per_capita}}", { bold: true }),
      t("."),
    ],
  },
  {
    type: "paragraph",
    spans: [t("b) que reside no imóvel a seguir descrito, mencionando:")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "b.1. os principais bens que o guarnecem (eletrodomésticos; móveis de grande porte, tais como armários, mesas e camas):"
      ),
    ],
  },
  blankParagraph(),
  blankParagraph(),
  {
    type: "paragraph",
    spans: [t("b.2. quantidade de cômodos (quartos, salas e banheiros):")],
  },
  blankParagraph(),
  {
    type: "paragraph",
    spans: [
      t(
        "b.3. serviços básicos disponíveis na residência (existência de luz elétrica, serviço de água e outros):"
      ),
    ],
  },
  blankParagraph(),
  {
    type: "paragraph",
    spans: [t("b.4. área aproximada do imóvel:")],
  },
  blankParagraph(),
  {
    type: "paragraph",
    spans: [
      t(
        "b.5. se o imóvel é próprio ou alugado, indicando, quando existirem, os valores pagos a título de aluguéis ou prestação de financiamento:"
      ),
    ],
  },
  blankParagraph(),
  {
    type: "paragraph",
    spans: [
      t(
        "Fica a parte autora ciente que poderá ser responsabilizada criminalmente, caso as informações aqui prestadas não correspondam à verdade."
      ),
    ],
  },
  {
    type: "paragraph",
    spans: [t("Data: ________/_________/_________.")],
  },
  {
    type: "signatureLine",
    label: "ASSINATURA DA PARTE AUTORA",
  },
];

async function main() {
  if (!isValidBlocks(blocks)) {
    throw new Error("Blocos inválidos — corrija a estrutura antes de subir.");
  }
  const conteudo = flattenBlocksToText(blocks);

  const [existente] = await sql`
    SELECT id::text FROM modelos_documento WHERE titulo = ${TITULO}
  `;

  if (existente) {
    await sql`
      UPDATE modelos_documento
      SET categoria = ${CATEGORIA},
          descricao = ${DESCRICAO},
          conteudo = ${conteudo},
          conteudo_blocks = ${JSON.stringify(blocks)},
          usar_timbrado = false,
          usar_fundo_timbrado = false,
          requer_responsavel_legal = true,
          ativo = true,
          updated_at = now()
      WHERE id = ${existente.id}::uuid
    `;
    console.log(`✓ Modelo "${TITULO}" atualizado (id ${existente.id}).`);
  } else {
    await sql`
      INSERT INTO modelos_documento
        (titulo, categoria, descricao, conteudo, conteudo_blocks, usar_timbrado, usar_fundo_timbrado, requer_responsavel_legal)
      VALUES
        (${TITULO}, ${CATEGORIA}, ${DESCRICAO}, ${conteudo}, ${JSON.stringify(blocks)}, false, false, true)
    `;
    console.log(`✓ Modelo "${TITULO}" criado.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
