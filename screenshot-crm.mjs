import { chromium } from 'playwright';
const LOGIN = 'advocaciaorlandomartins@gmail.com';
const SENHA = process.env.ADV_SENHA;
const BASE  = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);
if (!page.url().includes('/dashboard')) {
  await page.locator('input[name="login"], input[type="email"]').first().fill(LOGIN);
  await page.locator('input[name="senha"], input[type="password"]').first().fill(SENHA);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/dashboard**`, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

await page.goto(`${BASE}/dashboard/usuarios/novo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);
// Scroll até o final da tabela de permissões (Gerenciador fica perto do fim)
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(400);
await page.screenshot({ path: 'permissoes-fim.png', fullPage: false });
console.log('OK');
await browser.close();
