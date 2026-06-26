import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

const LOGIN = 'advocaciaorlandomartins@gmail.com';
const SENHA = 'Wk921a07@';

// ── Passo 1: Login ──
await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', LOGIN);
await page.fill('[name=senha]', SENHA);
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login OK');

await page.screenshot({ path: `${DIR}/lo0-dashboard.png` });

// ── Passo 2: Logout (botão "Sair") ──
// O botão pode estar na topbar (dropdown do usuário) ou na sidebar
// Tenta primeiro na topbar — clica no avatar/nome para abrir o dropdown
const avatarBtn = page.locator('[class*="avatar"], button:has-text("Administrador"), button[aria-label*="usuário"]').first();
const temAvatar = await avatarBtn.isVisible().catch(() => false);
if (temAvatar) {
  await avatarBtn.click();
  await page.waitForTimeout(400);
}

// Procura o botão "Sair" com match exato
const sairBtn = page.getByRole('button', { name: 'Sair', exact: true });
const temSair = await sairBtn.isVisible().catch(() => false);
console.log('Botão "Sair" visível:', temSair);

if (!temSair) {
  // Pode estar no menu do usuário na topbar — tenta clicar no nome do usuário
  const userMenu = page.locator('button').filter({ hasText: /advocacia|administrador/i }).first();
  const temMenu = await userMenu.isVisible().catch(() => false);
  if (temMenu) {
    await userMenu.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/lo0b-menu-aberto.png` });
  }
}

await page.screenshot({ path: `${DIR}/lo1-antes-logout.png` });
console.log('Screenshot 1 - antes do logout');

const hora = new Date().toLocaleTimeString('pt-BR');
console.log('Hora do logout:', hora);

await page.getByRole('button', { name: 'Sair', exact: true }).click();

// Aguarda redirect para a tela de login
try {
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/login', { timeout: 10000 });
  console.log('Logout feito! URL:', page.url());
} catch {
  console.log('URL após logout:', page.url());
}

await page.screenshot({ path: `${DIR}/lo2-apos-logout.png` });
console.log('Screenshot 2 - após logout (tela de login)');

// ── Passo 3: Login novamente para ver o log ──
await page.fill('[name=login]', LOGIN);
await page.fill('[name=senha]', SENHA);
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Re-login OK');

// ── Passo 4: Log de auditoria filtrado por Usuário + Logout ──
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Usuário' });
await page.selectOption('select[name=acao]', { label: 'Logout' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/lo3-auditoria-logout.png` });
console.log('Screenshot 3 - auditoria: Usuário + Logout');

const linhas = await page.locator('tbody tr').allTextContents();
console.log('Registros de logout:', linhas.length);
for (const l of linhas.slice(0, 3)) {
  console.log(' ', l.replace(/\s+/g, ' ').trim().slice(0, 120));
}

await browser.close();
console.log('DONE');
