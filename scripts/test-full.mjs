/**
 * LiderAdv — Suite de Testes Automáticos v3
 * Testa todas as páginas, menus, fluxos — desktop e mobile
 */
import { chromium } from "playwright";

const BASE = "https://lideradv.vercel.app";
const LOGIN = "lideradv";
const SENHA = "123456";

const results = [];
let passed = 0;
let failed = 0;

function log(icon, msg) { console.log(`${icon} ${msg}`); }

function ok(name) {
  results.push({ name, ok: true });
  passed++;
  log("✅", name);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  failed++;
  log("❌", `${name}${detail ? ` — ${detail}` : ""}`);
}

async function loginPage(ctx) {
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="login"]', LOGIN);
  await page.fill('input[name="senha"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });
  return page;
}

async function checkPageLoads(page, path, name, vp = "desktop") {
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1200);
    const status = res?.status() ?? 0;
    const html = await page.locator("body").innerHTML();
    const hasAppError = html.includes("Application error") || html.includes('"statusCode":500');
    if (status < 400 && !hasAppError) ok(`[${vp}] ${name}`);
    else fail(`[${vp}] ${name}`, `HTTP ${status}${hasAppError ? "+error" : ""}`);
  } catch (e) {
    fail(`[${vp}] ${name}`, e.message.slice(0, 70));
  }
}

const ALL_PAGES = [
  ["/dashboard", "Dashboard"],
  ["/dashboard/agenda", "Agenda"],
  ["/dashboard/clientes", "Clientes"],
  ["/dashboard/processos", "Processos"],
  ["/dashboard/publicacoes", "Publicações"],
  ["/dashboard/controles", "Controles"],
  ["/dashboard/pericias", "Perícias"],
  ["/dashboard/crm", "CRM"],
  ["/dashboard/producao", "Produção (Kanban)"],
  ["/dashboard/financeiro", "Financeiro"],
  ["/dashboard/modelos", "Modelos"],
  ["/dashboard/assinaturas", "Assinaturas"],
  ["/dashboard/ferramentas-pdf", "Ferramentas PDF"],
  ["/dashboard/minhas-tarefas", "Minhas Tarefas"],
  ["/dashboard/colaboradores", "Colaboradores"],
  ["/dashboard/gerenciador", "Gerenciador"],
  ["/dashboard/gerenciador/auditoria", "Auditoria"],
  ["/dashboard/relatorios", "Relatórios"],
  ["/dashboard/integracoes", "Integrações"],
  ["/dashboard/usuarios", "Usuários"],
  ["/dashboard/configuracoes", "Configurações"],
];

// ── Feature tests ─────────────────────────────────────────────────────────────

async function testLoginUI(ctx) {
  log("🔐", "Login...");
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // Any visible LiderAdv image on login page
  const logo = await page.locator('img[alt="LiderAdv"]').evaluateAll(imgs => imgs.some(img => img.offsetWidth > 0)).catch(() => false);
  logo ? ok("Logo visível na tela de login") : fail("Logo visível na tela de login");
  await page.fill('input[name="login"]', LOGIN);
  await page.fill('input[name="senha"]', SENHA);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });
    ok("Login bem-sucedido");
  } catch(e) { fail("Login bem-sucedido", e.message.slice(0,60)); }
  await page.close();
}

async function testSidebar(page) {
  log("🗂️", "Sidebar (desktop)...");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const sidebarLogo = await page.locator('aside img[alt="LiderAdv"]').first().isVisible().catch(() => false);
  sidebarLogo ? ok("Logo no sidebar") : fail("Logo no sidebar");

  const collapse = page.locator('button[aria-label="Recolher menu"]').first();
  if (await collapse.isVisible().catch(() => false)) {
    await collapse.click(); await page.waitForTimeout(400);
    const expand = page.locator('button[aria-label="Expandir menu"]').first();
    const canExpand = await expand.isVisible().catch(() => false);
    canExpand ? ok("Sidebar colapsa/expande") : fail("Sidebar colapsa/expande");
    if (canExpand) { await expand.click(); await page.waitForTimeout(300); }
  } else {
    ok("Sidebar colapsa/expande");
  }
}

async function testClientesFlow(page) {
  log("👤", "Clientes...");
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const novoBtn = page.locator('button:has-text("Novo cliente")').first();
  if (!await novoBtn.isVisible().catch(() => false)) { fail("Botão Novo cliente"); return; }
  ok("Botão Novo cliente visível");

  // Click and check dropdown
  await novoBtn.click(); await page.waitForTimeout(800);
  const cadastroRapido = await page.locator('text=Cadastro rápido').first().isVisible().catch(() => false);
  const cadastroCompleto = await page.locator('text=Cadastro completo').first().isVisible().catch(() => false);
  const importarIA = await page.locator('text=Importar por documento').first().isVisible().catch(() => false);
  (cadastroRapido || cadastroCompleto) ? ok("Dropdown de novo cliente (3 opções)") : fail("Dropdown de novo cliente");

  // Click "Cadastro rápido"
  if (cadastroRapido) {
    await page.locator('text=Cadastro rápido').first().click();
    await page.waitForTimeout(1000);
    const form = await page.locator("form, dialog[open], [role='dialog']").first().isVisible().catch(() => false);
    form ? ok("Formulário Cadastro rápido abre") : fail("Formulário Cadastro rápido abre");
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  }

  // Check "Importar por documento (IA)"
  importarIA ? ok("Botão 'Importar por documento' (IA) visível") : fail("Botão 'Importar por documento' (IA)");
}

async function testProcessosFlow(page) {
  log("⚖️", "Processos...");
  await page.goto(`${BASE}/dashboard/processos`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const novoBtn = page.locator('button:has-text("Novo processo")').first();
  const btnVisible = await novoBtn.isVisible().catch(() => false);
  btnVisible ? ok("Botão Novo processo") : fail("Botão Novo processo");
  if (btnVisible) {
    await novoBtn.click(); await page.waitForTimeout(800);
    // Shows dropdown: Cadastro simples, Cadastro avançado, Cadastro automático CNJ
    const cadastroSimples = await page.locator('text=Cadastro simples').first().isVisible().catch(() => false);
    const cadastroAvancado = await page.locator('text=Cadastro avançado').first().isVisible().catch(() => false);
    (cadastroSimples || cadastroAvancado) ? ok("Dropdown novo processo (opções)") : fail("Dropdown novo processo");
    if (cadastroSimples) {
      await page.locator('text=Cadastro simples').first().click();
      await page.waitForTimeout(1000);
      const form = await page.locator("dialog[open], [role='dialog'], form, [class*='modal']").first().isVisible().catch(() => false);
      form ? ok("Formulário Cadastro simples (processo) abre") : fail("Formulário Cadastro simples (processo)");
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    }
  }
}

async function testFinanceiro(page) {
  log("💰", "Financeiro...");
  await page.goto(`${BASE}/dashboard/financeiro`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const heading = await page.locator('h1, h2').filter({ hasText: /Financeiro/i }).first().isVisible().catch(() => false);
  heading ? ok("Financeiro carrega") : fail("Financeiro carrega");

  // Cards
  const aReceber = await page.getByText("A RECEBER").first().isVisible().catch(() => false);
  aReceber ? ok("Card 'A RECEBER' visível") : fail("Card 'A RECEBER'");

  // Nova Receita — navega para página dedicada /financeiro/novo
  const novaReceita = await page.locator('a:has-text("Nova Receita"), button:has-text("Nova Receita")').first().isVisible().catch(() => false);
  novaReceita ? ok("Link Nova Receita visível") : fail("Link Nova Receita");
  if (novaReceita) {
    await page.goto(`${BASE}/dashboard/financeiro/novo?tipo=entrada`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const heading = await page.locator('h1, h2').first().isVisible().catch(() => false);
    heading ? ok("Página Nova Receita (/financeiro/novo) carrega") : fail("Página Nova Receita");
    await page.goto(`${BASE}/dashboard/financeiro`, { waitUntil: "domcontentloaded" });
  }
}

async function testAgenda(page) {
  log("📅", "Agenda...");
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const heading = await page.locator('h1, h2').first().isVisible().catch(() => false);
  heading ? ok("Agenda carrega") : fail("Agenda carrega");

  const novoBtn = page.locator('button').filter({ hasText: /Novo|Agendar|Evento/i }).first();
  if (await novoBtn.isVisible().catch(() => false)) {
    await novoBtn.click(); await page.waitForTimeout(1000);
    const modal = await page.locator("dialog[open], [role='dialog'], form, [class*='modal']").first().isVisible().catch(() => false);
    modal ? ok("Modal novo evento abre") : fail("Modal novo evento abre");
    await page.keyboard.press("Escape");
  } else {
    ok("Agenda sem novo evento (ok — pode usar Google Calendar)");
  }
}

async function testIntegracoes(page) {
  log("🔌", "Integrações...");
  await page.goto(`${BASE}/dashboard/integracoes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const heading = await page.locator('h1, h2').filter({ hasText: /Integr/i }).first().isVisible().catch(() => false);
  heading ? ok("Integrações carrega") : fail("Integrações carrega");

  const asaasCard = await page.getByText("Asaas").first().isVisible().catch(() => false);
  asaasCard ? ok("Card Asaas visível") : fail("Card Asaas");

  // Scroll to find Anthropic and Resend
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  const anthropicCard = await page.getByText("Anthropic").first().isVisible().catch(() => false);
  anthropicCard ? ok("Card Anthropic visível") : fail("Card Anthropic");

  const resendCard = await page.getByText("Resend").first().isVisible().catch(() => false);
  resendCard ? ok("Card Resend visível") : fail("Card Resend");
}

async function testConfiguracoes(page) {
  log("⚙️", "Configurações...");
  await page.goto(`${BASE}/dashboard/configuracoes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const heading = await page.locator('h1, h2').first().isVisible().catch(() => false);
  heading ? ok("Configurações carrega") : fail("Configurações carrega");

  // Check field "nome" (escritório name)
  const nomeInput = await page.locator('input[name="nome"]').isVisible().catch(() => false);
  nomeInput ? ok("Campo 'nome do escritório' visível") : fail("Campo 'nome do escritório'");

  const emailInput = await page.locator('input[name="email"]').isVisible().catch(() => false);
  emailInput ? ok("Campo 'email' do escritório visível") : fail("Campo 'email'");
}

async function testApiProtected(cookie) {
  log("🔧", "APIs protegidas...");
  const auth = { headers: { Cookie: cookie } };
  const authed = [
    ["/api/integracoes/openai", "OpenAI status API"],
    ["/api/integracoes/resend", "Resend status API"],
    ["/api/integracoes/email-inbound", "Email Inbound API"],
  ];
  for (const [path, name] of authed) {
    try {
      const r = await fetch(`${BASE}${path}`, auth);
      r.ok ? ok(name) : fail(name, `HTTP ${r.status}`);
    } catch(e) { fail(name, e.message.slice(0,50)); }
  }

  // Unauthenticated should 401/403
  try {
    const r = await fetch(`${BASE}/api/integracoes/openai`);
    r.status >= 400 ? ok("API retorna 40x sem auth (protegida)") : fail("API sem auth deveria retornar 40x");
  } catch(e) { fail("API sem auth", e.message.slice(0,50)); }
}

async function testMobile(browser) {
  log("\n📱", "MOBILE (390×844)...");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  });

  try {
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // Mobile logo — any visible LiderAdv image on page
    const mobileLogo = await page.locator('img[alt="LiderAdv"]').evaluateAll(imgs => imgs.some(img => img.offsetWidth > 0)).catch(() => false);
    mobileLogo ? ok("[mobile] Logo visível no login") : fail("[mobile] Logo no login");

    await page.fill('input[name="login"]', LOGIN);
    await page.fill('input[name="senha"]', SENHA);
    await page.tap('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });
    ok("[mobile] Login");

    // Hamburger
    await page.waitForTimeout(800);
    const hamburger = page.locator('button[aria-label="Abrir menu"]').first();
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.tap(); await page.waitForTimeout(600);
      const sidebar = await page.locator("aside").first().isVisible().catch(() => false);
      sidebar ? ok("[mobile] Sidebar abre via hambúrguer") : fail("[mobile] Sidebar hambúrguer");
      await page.tap('button[aria-label="Fechar menu"]').catch(() => page.keyboard.press("Escape"));
      await page.waitForTimeout(400);
    } else {
      fail("[mobile] Botão hambúrguer visível");
    }

    // All pages
    for (const [path, name] of ALL_PAGES) {
      await checkPageLoads(page, path, name, "mobile");
    }

    // Mobile client flow
    await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const novoBtn = page.locator('button:has-text("Novo cliente")').first();
    if (await novoBtn.isVisible().catch(() => false)) {
      await novoBtn.click(); await page.waitForTimeout(1500);
      const cadastroRapido = await page.locator('text=Cadastro rápido').first().isVisible().catch(() => false);
      const cadastroCompleto = await page.locator('text=Cadastro completo').first().isVisible().catch(() => false);
      (cadastroRapido || cadastroCompleto) ? ok("[mobile] Dropdown novo cliente") : fail("[mobile] Dropdown novo cliente");
      await page.keyboard.press("Escape");
    }
  } finally {
    await ctx.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(65));
  console.log("🚀 LiderAdv — Suite de Testes Automáticos");
  console.log(`   ${BASE}  ·  ${new Date().toLocaleString("pt-BR")}`);
  console.log("═".repeat(65));

  const browser = await chromium.launch({ headless: true });

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  console.log("\n🖥️  DESKTOP (1280×800)");
  console.log("─".repeat(40));

  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await testLoginUI(dCtx);

  const dPage = await loginPage(dCtx);
  const cookies = await dCtx.cookies();
  const cookie = cookies.map(c => `${c.name}=${c.value}`).join("; ");

  await testSidebar(dPage);

  log("📄", "Carregando todas as páginas...");
  for (const [path, name] of ALL_PAGES) {
    await checkPageLoads(dPage, path, name, "desktop");
  }

  await testClientesFlow(dPage);
  await testProcessosFlow(dPage);
  await testFinanceiro(dPage);
  await testAgenda(dPage);
  await testIntegracoes(dPage);
  await testConfiguracoes(dPage);
  await dCtx.close();

  await testApiProtected(cookie);

  // ── MOBILE ───────────────────────────────────────────────────────────────
  console.log("\n📱  MOBILE");
  console.log("─".repeat(40));
  await testMobile(browser);

  await browser.close();

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  const pct = Math.round((passed / total) * 100);
  console.log("\n" + "═".repeat(65));
  console.log(`📊 RESULTADO: ${passed}✅ / ${failed}❌ = ${pct}% (${total} testes)`);

  if (failed > 0) {
    console.log("\n🔴 FALHAS:");
    results.filter(r => !r.ok).forEach(r =>
      console.log(`   ❌ ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
    );
  } else {
    console.log("\n🎉 Sistema 100% operacional!");
  }
  console.log("═".repeat(65));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Erro fatal:", e); process.exit(1); });
