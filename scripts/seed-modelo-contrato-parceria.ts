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

const TITULO = "Contrato de Parceria entre Advogados";
const CATEGORIA = "Contratos";
const DESCRICAO =
  "Contrato enviado a um colaborador com cargo Advogado(a) Parceiro(a) para assinatura digital (TramitaSign) — sem cliente envolvido. O percentual de honorários é puxado automaticamente do cadastro do colaborador (Comissão por fase do processo); mudanças futuras nesse percentual não afetam processos já em andamento (congelado no momento em que o colaborador assume cada fase).";

function t(text: string, opts: Partial<TextSpan> = {}): TextSpan {
  return { text, ...opts };
}

const blocks: Block[] = [
  {
    type: "paragraph",
    spans: [
      t("ESCRITÓRIO: ", { bold: true }),
      t(
        "{{advogado}}, com endereço profissional em {{endereco_escritorio}}, doravante denominado ESCRITÓRIO."
      ),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t("ADVOGADO(A) PARCEIRO(A): ", { bold: true }),
      t(
        "{{colaborador_nome}}, inscrito(a) na OAB/{{colaborador_oab_uf}} sob o nº {{colaborador_oab_numero}}, com endereço em {{colaborador_endereco}}, doravante denominado(a) PARCEIRO(A)."
      ),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "As partes firmam o presente contrato de parceria profissional, mediante as cláusulas seguintes."
      ),
    ],
  },
  { type: "divider" },
  {
    type: "heading",
    level: 2,
    spans: [t("Cláusula 1ª — Do Objeto")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "O presente instrumento tem por objeto a integração do(a) PARCEIRO(A) na atuação conjunta em processos indicados pelo ESCRITÓRIO, sem qualquer vínculo empregatício, societário ou de subordinação entre as partes."
      ),
    ],
  },
  {
    type: "heading",
    level: 2,
    spans: [t("Cláusula 2ª — Da Autonomia e Responsabilidade")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "Cada parte responde exclusiva e pessoalmente pelos atos profissionais que praticar, não havendo solidariedade nem responsabilidade do ESCRITÓRIO por atos, omissões ou resultados decorrentes da atuação do(a) PARCEIRO(A), e vice-versa."
      ),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "Vigora neste contrato os efeitos do artigo 39 do Regulamento Geral do Estatuto da Advocacia e da OAB, podendo o(a) PARCEIRO(A) participar de uma ou mais sociedades de advocacia ou firmar parceria com outros advogados, mantendo sua autonomia profissional, sem subordinação ou controle de jornada."
      ),
    ],
  },
  {
    type: "heading",
    level: 2,
    spans: [t("Cláusula 3ª — Dos Honorários")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "Pela atuação nos processos que lhe forem distribuídos, o(a) PARCEIRO(A) fará jus aos seguintes percentuais sobre os honorários recebidos, conforme a fase de atuação:"
      ),
    ],
  },
  {
    type: "list",
    items: [
      [
        t("Somente fase administrativa: "),
        t("{{comissao_administrativo_pct}}%", { bold: true }),
      ],
      [
        t("Somente fase judicial: "),
        t("{{comissao_judicial_pct}}%", { bold: true }),
      ],
      [
        t("Fases administrativa e judicial: "),
        t("{{comissao_ambos_pct}}%", { bold: true }),
      ],
    ],
  },
  {
    type: "paragraph",
    spans: [
      t("Parágrafo primeiro. ", { bold: true }),
      t(
        "Os percentuais acima poderão ser revistos a qualquer tempo, mediante comunicação entre as partes, valendo a alteração somente para os processos distribuídos a partir da nova pactuação — os processos já em andamento permanecem com o percentual vigente na data em que foram distribuídos ao(à) PARCEIRO(A)."
      ),
    ],
  },
  {
    type: "paragraph",
    spans: [
      t("Parágrafo segundo. ", { bold: true }),
      t(
        "Fica estabelecido que, se uma das partes receber individualmente quaisquer valores de clientes relativos a processos objeto desta parceria, deverá comunicar e efetuar imediatamente o repasse da parte devida à outra parte."
      ),
    ],
  },
  {
    type: "heading",
    level: 2,
    spans: [t("Cláusula 4ª — Da Vigência e Rescisão")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "O contrato vigora por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, preservando-se os direitos sobre os processos em andamento até sua conclusão."
      ),
    ],
  },
  {
    type: "heading",
    level: 2,
    spans: [t("Cláusula 5ª — Do Foro")],
  },
  {
    type: "paragraph",
    spans: [
      t(
        "Fica eleito o foro da Comarca de {{cidade_escritorio}}/{{estado_escritorio}} para dirimir eventuais controvérsias oriundas deste contrato."
      ),
    ],
  },
  { type: "divider" },
  {
    type: "paragraph",
    spans: [
      t(
        "As partes reconhecem a validade jurídica deste contrato, assinado por meio eletrônico ou digital, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020. As assinaturas apostas por meios digitais têm a mesma validade, eficácia e força probatória de uma assinatura manuscrita, renunciando as partes à exigência de vias físicas ou reconhecimento de firma."
      ),
    ],
  },
  {
    type: "paragraph",
    align: "center",
    spans: [t("{{cidade_escritorio}}, {{data_hoje}}.")],
  },
  { type: "signatureLine", label: "ESCRITÓRIO — {{advogado}}" },
  {
    type: "signatureLine",
    label:
      "PARCEIRO(A) — {{colaborador_nome}}, OAB/{{colaborador_oab_uf}} {{colaborador_oab_numero}}",
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
    // Não sobrescreve conteúdo/conteudo_blocks num reexecução — achado de
    // revisão: isso descartava em silêncio qualquer ajuste feito depois
    // pelo editor em /dashboard/modelos/[id]/editar. Reexecutar este
    // script só garante que o modelo existe e está ativo; pra mudar o
    // texto depois de criado, edite direto na tela (ou apague a linha no
    // banco antes de rodar de novo, de propósito).
    await sql`
      UPDATE modelos_documento
      SET ativo = true,
          updated_at = now()
      WHERE id = ${existente.id}::uuid
    `;
    console.log(
      `✓ Modelo "${TITULO}" já existia (id ${existente.id}) — conteúdo preservado, só confirmei que está ativo. Pra atualizar o texto, edite pela tela de Modelos.`
    );
  } else {
    await sql`
      INSERT INTO modelos_documento
        (titulo, categoria, descricao, conteudo, conteudo_blocks, usar_timbrado, usar_fundo_timbrado, ocultar_identificacao_escritorio, requer_responsavel_legal)
      VALUES
        (${TITULO}, ${CATEGORIA}, ${DESCRICAO}, ${conteudo}, ${JSON.stringify(blocks)}, true, false, false, false)
      RETURNING id::text
    `;
    console.log(`✓ Modelo "${TITULO}" criado.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
