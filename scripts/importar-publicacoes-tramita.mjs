// Importação histórica das publicações do TramitaSign para o banco LiderAdv
// Execute: node scripts/importar-publicacoes-tramita.mjs
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dir, "../.env.local"), "utf8");
const dbUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const sql = neon(dbUrl);

const TRAMITA_BASE = "https://planilha.tramitacaointeligente.com.br";
const API_KEY = "MKeVK8ybEvmqaQmx1GG6PcqZKLZP4oLxmYD2UbQR6pSt";

// Step 1: Login via session to get publications
async function getSessionCookie() {
  const loginPage = await fetch(`${TRAMITA_BASE}/usuarios/login`);
  const html = await loginPage.text();
  const csrf = html.match(/csrf-token" content="([^"]+)"/)?.[1] ?? "";
  const cookies = loginPage.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  const loginRes = await fetch(`${TRAMITA_BASE}/usuarios/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Cookie: cookieHeader,
    },
    redirect: "manual",
    body: new URLSearchParams({
      "user[email]": "advocaciaorlandomartins@gmail.com",
      "user[password]": "Wk921a07@",
      authenticity_token: csrf,
    }),
  });

  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  return loginCookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchPublications(sessionCookie) {
  const res = await fetch(`${TRAMITA_BASE}/publicacoes`, {
    headers: {
      Cookie: sessionCookie,
      Accept: "application/json",
      "X-Inertia": "true",
      "X-Inertia-Version": "8a03475bffc5d612f244cb6d77a2edf1658cd23d",
    },
  });
  const data = await res.json();
  return data?.initialData?.publications ?? [];
}

async function importar(pubs) {
  let inseridos = 0;
  let pulados = 0;

  for (const pub of pubs) {
    const processo = pub.data?.numeroprocessocommascara ?? "";
    const tipo = pub.data?.tipoDocumento ?? "Publicação";
    const disponibilizacao = pub.data_disponibilizacao ?? pub.publication_date;

    if (!processo || !disponibilizacao) {
      pulados++;
      continue;
    }

    const tribunal = pub.data?.siglaTribunal ?? "";
    const orgao = pub.data?.nomeOrgao ?? "—";
    const link = pub.data?.link ?? null;
    const conteudoCompleto = pub.sanitized_text ?? null;
    const destinatario = pub.data?.destinatarios?.[0]?.nome ?? null;
    const advogados = (pub.data?.destinatarioadvogados ?? [])
      .map((a) => a.advogado?.nome)
      .filter(Boolean);

    const existe = await sql`
      SELECT 1 FROM publicacoes
      WHERE processo = ${processo}
        AND tipo = ${tipo}
        AND disponibilizacao = ${disponibilizacao}::date
      LIMIT 1
    `;

    if (existe.length > 0) {
      console.log(`  SKIP  ${tipo} — ${processo} — ${disponibilizacao}`);
      pulados++;
      continue;
    }

    const rows = await sql`
      INSERT INTO publicacoes
        (processo, tipo, destinatario, advogados, orgao, tribunal,
         disponibilizacao, status, origem, conteudo, conteudo_completo)
      VALUES (
        ${processo}, ${tipo}, ${destinatario}, ${advogados}, ${orgao},
        ${tribunal}, ${disponibilizacao}::date, 'nao_lida', 'tramitasign',
        ${link}, ${conteudoCompleto}
      )
      RETURNING id
    `;

    const newId = rows[0]?.id;
    if (newId && pub.summary?.resumo) {
      const resumoIa = JSON.stringify({
        texto: pub.summary.resumo ?? null,
        prazo_dias: pub.summary.prazo ?? null,
        acao_necessaria: pub.summary.necessidade_acao ?? null,
        audiencia: pub.summary.data_audiencia ?? null,
      });
      await sql`UPDATE publicacoes SET resumo_ia = ${resumoIa}::jsonb WHERE id = ${newId}`;
    }

    console.log(`  INSERT ${tipo} — ${processo} — ${disponibilizacao}`);
    inseridos++;
  }

  return { inseridos, pulados };
}

console.log("Conectando ao TramitaSign...");
const cookie = await getSessionCookie();
console.log("Login OK. Buscando publicações...");
const pubs = await fetchPublications(cookie);
console.log(`Encontradas: ${pubs.length} publicações`);
console.log("Importando...");
const { inseridos, pulados } = await importar(pubs);
console.log(`\nConcluído: ${inseridos} inseridas, ${pulados} puladas.`);
