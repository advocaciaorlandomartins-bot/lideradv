import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// ── Login ─────────────────────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('✅ Login OK');

// ── 1. Screenshot do dashboard (topbar + sidebar) ─────────────────────────────
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test1-dashboard.png` });
console.log('📸 Screenshot 1: dashboard principal');

// Verifica que "Publicações" aparece na topbar
const pubTopbar = await page.locator('nav a[href="/dashboard/publicacoes"]').count();
console.log(pubTopbar > 0 ? '✅ Publicações no topbar' : '❌ Publicações NÃO encontrada no topbar');

// ── 2. Topbar — verifica todos os links esperados ─────────────────────────────
const topbarLinks = [
  'Dashboard', 'Agenda', 'CRM', 'Produção', 'Clientes', 'Processos',
  'Publicações', 'Financeiro', 'Controles', 'Modelos', 'Assinaturas',
  'PDFs', 'Colaboradores'
];
for (const label of topbarLinks) {
  const el = page.locator(`header nav a:has-text("${label}")`).first();
  const vis = await el.isVisible().catch(() => false);
  console.log(vis ? `  ✅ Topbar: ${label}` : `  ❌ Topbar: ${label} AUSENTE`);
}

// ── 3. Sidebar mobile — abre e verifica ───────────────────────────────────────
// Resize to mobile to trigger sidebar button
await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(300);

const burgerBtn = page.locator('button[aria-label="Abrir menu"]').first();
const hasBurger = await burgerBtn.isVisible().catch(() => false);
if (hasBurger) {
  await burgerBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/test2-sidebar.png` });
  console.log('📸 Screenshot 2: sidebar mobile aberto');

  const sidebarLinks = ['Agenda', 'Produção', 'Assinaturas', 'PDFs', 'Publicações'];
  for (const label of sidebarLinks) {
    const el = page.locator(`aside a:has-text("${label}")`).first();
    const vis = await el.isVisible().catch(() => false);
    console.log(vis ? `  ✅ Sidebar: ${label}` : `  ❌ Sidebar: ${label} AUSENTE`);
  }

  // Fecha sidebar
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
} else {
  console.log('ℹ️  Botão burger não visível — sidebar pode ser desktop-only nesta resolução');
}

// ── 4. Volta ao desktop e testa Gerenciador dropdown ─────────────────────────
await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(300);

// Clica no botão Gerenciador
const gerBtn = page.locator('header button:has-text("Gerenciador")');
await gerBtn.click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${DIR}/test3-gerenciador-dropdown.png` });
console.log('📸 Screenshot 3: dropdown Gerenciador');

const logAudit = await page.locator('text=Log de Auditoria').isVisible().catch(() => false);
console.log(logAudit ? '✅ "Log de Auditoria" no dropdown' : '❌ "Log de Auditoria" ausente');

// ── 5. Navega ao Gerenciador ─────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/gerenciador`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test4-gerenciador.png` });
console.log('📸 Screenshot 4: Gerenciador (Visão Geral)');

// Verifica abas de navegação
const tabGeralVis = await page.locator('a:has-text("Visão Geral")').isVisible().catch(() => false);
const tabAuditVis = await page.locator('a:has-text("Log de Auditoria")').isVisible().catch(() => false);
console.log(tabGeralVis ? '✅ Tab "Visão Geral" visível' : '❌ Tab "Visão Geral" ausente');
console.log(tabAuditVis ? '✅ Tab "Log de Auditoria" visível' : '❌ Tab "Log de Auditoria" ausente');

// ── 6. Navega ao Log de Auditoria ────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/gerenciador/auditoria`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test5-auditoria.png` });
console.log('📸 Screenshot 5: Log de Auditoria');

const exibir10 = await page.locator('text=Exibir').isVisible().catch(() => false);
console.log(exibir10 ? '✅ Seletor "Exibir: 10 20 50" visível' : '❌ Seletor de paginação ausente');

// ── 7. Testa Publicações ──────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/publicacoes`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test6-publicacoes.png` });
const pubTitle = await page.locator('h1:has-text("Publicações")').isVisible().catch(() => false);
console.log(pubTitle ? '✅ Página Publicações carregou' : '❌ Página Publicações com erro');

// ── 8. Testa PDFs ─────────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/ferramentas-pdf`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test7-ferramentas-pdf.png` });
const proiaLabel = await page.locator('text=ProIA').isVisible().catch(() => false);
const pdfImgCard = await page.locator('text=Converter PDF em imagens').isVisible().catch(() => false);
console.log(proiaLabel ? '✅ Label "ProIA" visível' : '❌ Label "ProIA" ausente');
console.log(pdfImgCard ? '✅ Card "Converter PDF em imagens" visível' : '❌ Card ausente');

// ── 9. Usuários ───────────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/usuarios`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/test8-usuarios.png` });
const usersTitle = await page.locator('h1:has-text("Usuários")').isVisible().catch(() => false);
console.log(usersTitle ? '✅ Página Usuários carregou' : '❌ Página Usuários com erro');

console.log('\n=== TESTE CONCLUÍDO ===');
await browser.close();
