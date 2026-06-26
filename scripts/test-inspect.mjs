import { chromium } from "playwright";
import crypto from "crypto";

const SECRET = "19ffd8d4a3a21dad52beec6bdc981735f25c5ee8d27dcb5f4bad75c97495db28";
const exp = Math.floor(Date.now() / 1000) + 28800;
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  login: "admin",
  categoria: "admin",
  permissoes: {
    clientes: ["ver","editar","criar","excluir"],
    processos: ["ver","editar","criar","excluir"],
    financeiro: ["ver","editar","criar","excluir"],
    publicacoes: ["ver","editar","criar","excluir"],
    colaboradores: ["ver","editar","criar","excluir"],
    remuneracoes: ["ver","editar","criar","excluir"],
    relatorios: ["ver"],
    configuracoes: ["ver","editar"]
  },
  exp
};
const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
const TOKEN = payload + "." + sig;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: "pt-BR" });
await ctx.addCookies([{ name: "adv_session", value: TOKEN, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();

// Capture ALL console messages and network errors
const errors = [];
const failedRequests = [];

page.on("console", msg => {
  if (msg.type() === "error") {
    errors.push(`CONSOLE [${msg.type()}]: ${msg.text()}`);
  }
});
page.on("pageerror", err => {
  errors.push(`PAGE ERROR: ${err.message.slice(0, 200)}`);
});
page.on("response", response => {
  if (response.status() >= 400) {
    failedRequests.push(`${response.status()} ${response.url().slice(0, 100)}`);
  }
});

await page.goto("http://localhost:3000/dashboard/financeiro?tab=remuneracoes", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

console.log("=== ERRORS ===");
for (const e of errors) console.log(e);

console.log("\n=== FAILED REQUESTS ===");
for (const r of failedRequests) console.log(r);

console.log("\n=== DOM CHECK ===");
const aPagarEl = await page.locator('text="A Pagar"').first();
const tag = await aPagarEl.evaluate(e => ({
  self: e.tagName,
  parent: e.parentElement?.tagName,
  grandParent: e.parentElement?.parentElement?.tagName,
  parentClass: e.parentElement?.className.slice(0, 80),
}));
console.log("A Pagar element:", JSON.stringify(tag, null, 2));

await browser.close();
