import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const sql = neon(process.env.DATABASE_URL);

// Busca primeiro endereço exclusivo ativo no banco
const rows = await sql`
  SELECT iea.address, c.name AS client_name, iea.client_id::text
  FROM inbound_email_addresses iea
  JOIN clients c ON c.id = iea.client_id
  WHERE iea.is_active = true
  ORDER BY iea.created_at DESC
  LIMIT 1
`;

if (rows.length === 0) {
  console.log("❌ Nenhum endereço exclusivo encontrado no banco.");
  console.log("   Vá em Clientes → abra um cliente → aba E-mail → clique em 'Gerar endereço exclusivo'.");
  process.exit(1);
}

const { address, client_name, client_id } = rows[0];
console.log(`📬 Endereço exclusivo encontrado: ${address}`);
console.log(`👤 Cliente: ${client_name}`);
console.log("");

// Monta payload no formato Mailgun
const body = new URLSearchParams({
  recipient: address,
  sender: "teste@gmail.com",
  from: "José da Silva <jose@gmail.com>",
  subject: "Preciso de informações sobre meu processo",
  "body-plain":
    "Boa tarde Dr. Orlando,\n\nGostaria de saber sobre o andamento do meu processo trabalhista. " +
    "Já faz 3 meses desde a última audiência e não tive nenhuma novidade. " +
    "Quando podemos conversar?\n\nAtenciosamente,\nJosé da Silva",
  "body-html":
    "<p>Boa tarde Dr. Orlando,</p><p>Gostaria de saber sobre o andamento do meu processo trabalhista. " +
    "Já faz 3 meses desde a última audiência e não tive nenhuma novidade. " +
    "Quando podemos conversar?</p><p>Atenciosamente,<br>José da Silva</p>",
  To: address,
}).toString();

const WEBHOOK_URL = "https://lideradv.vercel.app/api/webhooks/inbound-email";

console.log(`🚀 Enviando POST para: ${WEBHOOK_URL}`);
console.log("");

const res = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});

const raw = await res.text();
console.log(`📡 Status HTTP: ${res.status}`);

let json;
try {
  json = JSON.parse(raw);
  console.log(`📦 Resposta:`, JSON.stringify(json, null, 2));
} catch {
  console.log(`📦 Resposta (texto):`, raw.slice(0, 300));
  process.exit(1);
}

if (json.status === "ok") {
  console.log("");
  console.log("✅ SUCESSO! E-mail processado pelo sistema.");
  console.log("   → IA gerou o resumo e salvou no banco");
  console.log("   → Notificação enviada para o e-mail do escritório (se Resend configurado)");
  console.log(`   → Veja em: https://lideradv.vercel.app/dashboard/clientes/${client_id}`);
} else {
  console.log("⚠️  Resposta inesperada:", json);
}
