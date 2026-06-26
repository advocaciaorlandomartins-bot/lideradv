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

const SS = "C:/Users/Orlando/Documents/Teste/screenshots/mobile";
import { mkdirSync } from "fs";
try { mkdirSync(SS, { recursive: true }); } catch {}

const VIEWPORTS = [
  { name: "iphone14", width: 390, height: 844 },
  { name: "pixel7",   width: 412, height: 915 },
];

const PAGES = [
  { path: "/dashboard",                       name: "dashboard" },
  { path: "/dashboard/clientes",              name: "clientes" },
  { path: "/dashboard/processos",             name: "processos" },
  { path: "/dashboard/publicacoes",           name: "publicacoes" },
  { path: "/dashboard/financeiro",            name: "financeiro-lancamentos" },
  { path: "/dashboard/financeiro?tab=remuneracoes", name: "financeiro-remuneracoes" },
  { path: "/dashboard/financeiro?tab=contas", name: "financeiro-contas" },
  { path: "/dashboard/colaboradores",         name: "colaboradores" },
  { path: "/dashboard/gerenciador",           name: "gerenciador" },
  { path: "/dashboard/relatorios",            name: "relatorios" },
];

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  console.log(`\n══ ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ══`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, locale: "pt-BR" });
  await ctx.addCookies([{ name: "adv_session", value: TOKEN, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", e => errors.push(e.message.slice(0, 100)));
  page.on("response", r => { if (r.status() >= 500) errors.push(`500: ${r.url().split("/").pop()}`); });

  for (const pg of PAGES) {
    errors.length = 0;
    const t0 = Date.now();
    try {
      await page.goto(`http://localhost:3000${pg.path}`, { waitUntil: "networkidle", timeout: 15000 });
    } catch {
      console.log(`  TIMEOUT ${pg.name}`);
      continue;
    }
    const ms = Date.now() - t0;

    // Scroll para testar overflow horizontal
    const scrollX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const hasHScroll = scrollX > 4;

    // Screenshot sem scroll
    await page.screenshot({ path: `${SS}/${vp.name}-${pg.name}.png`, fullPage: false });

    const status = errors.length ? `WARN (${errors[0]})` : "OK";
    const hscroll = hasHScroll ? ` | H-SCROLL +${scrollX}px` : "";
    console.log(`  ${status === "OK" ? "✅" : "⚠️ "} ${pg.name.padEnd(28)} ${ms}ms${hscroll}`);
  }

  // Testar hamburger/sidebar no dashboard
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  const hamburger = page.locator("button").filter({ hasText: "" }).first();
  // Procurar por botão de menu (hamburguer)
  const menuBtn = page.locator("header button").first();
  if (await menuBtn.count() > 0) {
    await menuBtn.tap();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SS}/${vp.name}-sidebar-open.png`, fullPage: false });
    console.log(`  ✅ hamburger tap → sidebar-open screenshot`);
  }

  await ctx.close();
}

console.log("\n══ SCREENSHOTS SALVAS ══");
console.log(`Pasta: ${SS}`);
await browser.close();
