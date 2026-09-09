import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// Migração de correção, one-time: 17 intimações reais (TRF5/TJAL, com a OAB
// do Orlando) chegaram no sistema via captura automática mas nunca foram
// vinculadas a um processo/cliente — porque o cliente nunca tinha sido
// cadastrado no LiderAdv. Sem vínculo, essas intimações não geram prazo,
// não aparecem no Kanban, não entram no "Monitoramento" — a mais antiga é de
// abril/2026. Orlando confirmou (09/09/2026): "são meus processos na
// justiça que deveria esta sendo monitorados".
//
// Cadastro MÍNIMO E EXPLICITAMENTE INCOMPLETO — só o nome (extraído da
// intimação) e o número CNJ são reais. CPF/telefone/e-mail/endereço NÃO
// existem em lugar nenhum do sistema pra esses casos, então uso um
// placeholder óbvio ("PENDENTE"/"--") em vez de inventar um dado que
// pareça real — e bloqueio mensagens automáticas (bloquear_mensagens) pra
// nenhum fluxo tentar mandar WhatsApp pra um número que não existe.
// Precisa ser completado manualmente por quem já tem a pasta física/digital
// de cada caso.
const CASOS: {
  numero: string;
  nome: string;
  tribunal: "TRF5" | "TJAL";
}[] = [
  {
    numero: "0018028-22.2025.4.05.8000",
    nome: "JOSE CARLOS DE OLIVEIRA",
    tribunal: "TRF5",
  },
  {
    numero: "0033957-95.2025.4.05.8000",
    nome: "JOAO MELO FORTES",
    tribunal: "TRF5",
  },
  {
    numero: "0006304-49.2024.4.05.8002",
    nome: "MARIO PEREIRA DOS SANTOS",
    tribunal: "TRF5",
  },
  {
    numero: "0044028-59.2025.4.05.8000",
    nome: "ADENILSON VALENTIM DA SILVA",
    tribunal: "TRF5",
  },
  {
    numero: "0700799-48.2025.8.02.0081",
    nome: "JOSE KOTSCHEY REIS QUEIROZ",
    tribunal: "TJAL",
  },
  {
    numero: "0046269-06.2025.4.05.8000",
    nome: "ALEXANDRE GUEDES DE MELO",
    tribunal: "TRF5",
  },
  {
    numero: "0045129-34.2025.4.05.8000",
    nome: "MARIA SILVANA MACIEL DE ARAUJO",
    tribunal: "TRF5",
  },
  {
    numero: "0030391-07.2026.4.05.8000",
    nome: "SILVANIZIA MEDEIROS DA SILVA",
    tribunal: "TRF5",
  },
];

const RESPONSAVEL_ORLANDO = "1a402d85-c347-4203-9c64-5fdba84aaa4e";

async function main() {
  for (const caso of CASOS) {
    // Não duplica se rodar de novo — nem por número de processo, nem se já
    // existir um cliente com esse nome exato (checagem simples, mas o
    // objetivo aqui é evitar duplicar em re-execução acidental, não é
    // dedup geral do sistema).
    const jaExiste = await sql`
      SELECT 1 FROM processos WHERE numero = ${caso.numero} LIMIT 1
    `;
    if (jaExiste.length > 0) {
      console.log(`— já existe processo ${caso.numero}, pulando.`);
      continue;
    }

    const area = caso.tribunal === "TRF5" ? "Previdenciário" : "A definir";
    const notes =
      `⚠️ CADASTRO INCOMPLETO — importado automaticamente em 09/09/2026 a partir ` +
      `de intimação judicial (${caso.tribunal}) que chegou sem cliente/processo ` +
      `vinculado no sistema. Nome e número do processo são reais (extraídos da ` +
      `intimação); CPF, telefone, e-mail e endereço são placeholder e PRECISAM ` +
      `ser conferidos e preenchidos com os dados reais da pasta do caso.`;

    const [cliente] = await sql`
      INSERT INTO clients (
        type, name, doc, email, phone, cep, street, addr_number,
        neighborhood, city, state, notes, bloquear_mensagens
      ) VALUES (
        'PF', ${caso.nome}, 'PENDENTE', ${`pendente+${caso.numero.replace(/\D/g, "")}@lideradv.local`},
        'PENDENTE', 'PENDENTE', 'PENDENTE', 'PENDENTE',
        'PENDENTE', 'PENDENTE', '--', ${notes}, true
      )
      RETURNING id::text
    `;

    await sql`
      INSERT INTO processos (
        client_id, numero, tipo_acao, area, estagio_producao,
        responsavel_id, status
      ) VALUES (
        ${cliente.id}::uuid, ${caso.numero}, 'PENDENTE (confirmar tipo de ação)',
        ${area}, 'judicial', ${RESPONSAVEL_ORLANDO}::uuid, 'ativo'
      )
      RETURNING id::text
    `;

    const linkadas = await sql`
      UPDATE publicacoes
      SET processo_id = (SELECT id FROM processos WHERE numero = ${caso.numero} LIMIT 1)
      WHERE processo = ${caso.numero} AND processo_id IS NULL
      RETURNING id
    `;

    console.log(
      `✓ ${caso.numero} — cliente "${caso.nome}" criado, ${linkadas.length} intimação(ões) vinculada(s).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
