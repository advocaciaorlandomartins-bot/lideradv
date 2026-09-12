import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// Migração de correção, one-time: Controles → "Perícias e Av. Sociais"
// mostrava "0 registros" mesmo com 10 perícias reais agendadas no sistema.
// Causa: a tabela `controles` (de onde essa tela lê) nunca recebeu uma
// linha sequer para nenhuma das 10 — created_at delas em rajadas de
// poucos segundos (ex.: duas do mesmo cliente 2s uma da outra) indica
// que vieram de um import em lote que nunca escreveu em `controles`, não
// de um bug ativo no fluxo normal (POST /api/inss/confirmar já insere em
// `controles` junto com `pericias` — testado isoladamente e funciona).
// Backfill único: 1 linha de controle por perícia ainda "agendado".
// Todos os processos ativos hoje têm Orlando como responsável (confirmado
// em produção) — mesmo padrão do fluxo normal, que grava quem processou.
// Sem isso, o controle ficaria com responsavel_id nulo e ficaria invisível
// em "Carga da equipe"/Minhas Tarefas (aquelas telas usam INNER JOIN em
// usuarios pelo responsavel_id).
const RESPONSAVEL_LOGIN = "advocaciaorlandomartins@gmail.com";

async function main() {
  const [usuario] = await sql`
    SELECT id::text FROM usuarios WHERE login = ${RESPONSAVEL_LOGIN} LIMIT 1
  `;
  if (!usuario) throw new Error(`Usuário ${RESPONSAVEL_LOGIN} não encontrado.`);

  const pericias = await sql`
    SELECT p.id::text, p.tipo, p.client_id::text, p.processo_id::text,
           p.data_pericia::text, cl.name AS cliente_nome
    FROM pericias p
    JOIN clients cl ON cl.id = p.client_id
    WHERE p.status = 'agendado'
    ORDER BY p.data_pericia
  `;

  const TIPO_LABEL: Record<string, string> = {
    pericia_administrativa: "Perícia médica administrativa",
    avaliacao_social_administrativa: "Avaliação social administrativa",
  };

  let criadas = 0;
  for (const p of pericias) {
    // Evita duplicar se rodar de novo: já existe controle desse tipo pra
    // esse cliente nessa data exata?
    const existe = await sql`
      SELECT 1 FROM controles
      WHERE tipo = 'pericias' AND cliente_id = ${p.client_id}::uuid
        AND data_evento = ${p.data_pericia}::date
      LIMIT 1
    `;
    if (existe.length > 0) {
      console.log(
        `— já existe controle pra ${p.cliente_nome} em ${p.data_pericia}, pulando.`
      );
      continue;
    }

    const descricao = `${TIPO_LABEL[p.tipo] ?? p.tipo} — ${p.cliente_nome}`;
    // tipo_demanda é varchar(20) e semanticamente é Judicial/Extrajudicial/
    // Consultiva (controles-types.ts) — os rótulos de perícia não cabem e
    // não fazem sentido nesse campo, então fica de fora (nullable).
    await sql`
      INSERT INTO controles
        (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, prioridade)
      VALUES
        ('pericias', ${p.data_pericia}::date, ${descricao},
         ${p.client_id}::uuid, ${p.processo_id ? p.processo_id : null}::uuid,
         ${usuario.id}::uuid, 'alta')
    `;
    criadas++;
    console.log(`✓ controle criado: ${descricao} (${p.data_pericia})`);
  }

  console.log(`\n${criadas} controle(s) de perícia criado(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
