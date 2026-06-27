import { chromium } from 'playwright';

const LOGIN = process.env.ADV_LOGIN ?? 'advocaciaorlandomartins@gmail.com';
const SENHA = process.env.ADV_SENHA ?? '';
const BASE  = 'http://localhost:3000';
const OUT   = 'crm-screenshot.png';

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// 1. Login
await page.goto(`${BASE}/`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'crm-login.png', fullPage: false });

if (page.url().includes('/dashboard')) {
  console.log('Já autenticado, indo para o CRM…');
} else {
  if (!SENHA) {
    console.error('ERRO: defina ADV_SENHA=suasenha para fazer login.');
    await browser.close();
    process.exit(1);
  }
  const loginField = page.locator('input[name="login"], input[type="email"], input[name="email"]').first();
  const senhaField = page.locator('input[name="senha"], input[type="password"]').first();
  await loginField.fill(LOGIN);
  await senhaField.fill(SENHA);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/dashboard**`, { timeout: 10000 });
}

// 2. CRM page
await page.goto(`${BASE}/dashboard/crm`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: OUT, fullPage: true });
console.log(`Screenshot salvo: ${OUT}`);

await browser.close();
