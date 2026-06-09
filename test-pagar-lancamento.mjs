import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 250 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Login
await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login OK');

// Garante que existe lançamento pendente criando um agora
await page.goto('http://localhost:3000/dashboard/financeiro/novo');
await page.waitForLoadState('networkidle');
await page.locator('select').nth(1).selectOption('Honorários');
await page.fill('input[name="data_vencimento"]', '2026-07-20');
const vi = page.locator('input[placeholder="0,00"]').first();
await vi.click(); await vi.fill('750'); await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.click('text=Salvar lançamento');
await page.waitForURL((url) => !url.pathname.includes('/novo'), { timeout: 15000 });
console.log('Lançamento pendente criado');

// Financeiro — vai para tab Pendentes
await page.goto('http://localhost:3000/dashboard/financeiro');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/p0-financeiro.png` });

// Clica na tab Pendentes para garantir que vemos os lançamentos certos
const pendentesTab = page.locator('button:text-is("Pendentes"), a:text-is("Pendentes")').first();
if (await pendentesTab.isVisible().catch(() => false)) {
  await pendentesTab.click();
  await page.waitForTimeout(500);
}

// Botões de ação "Recebi" — usar match EXATO para não pegar "Recebido"
const recebiBtns = page.getByRole('button', { name: 'Recebi', exact: true });
const countAntes = await recebiBtns.count();
console.log('Botões "Recebi" (exato) antes:', countAntes);

if (countAntes === 0) {
  console.log('Sem botões Recebi — verificando lançamentos:');
  const allBtns = await page.locator('button').allTextContents();
  console.log('Todos os buttons:', allBtns.filter(t => t.trim().length > 0 && t.trim().length < 30));
  await page.screenshot({ path: `${DIR}/p0b-debug.png` });
  await browser.close();
  process.exit(0);
}

await page.screenshot({ path: `${DIR}/p1-antes-pagar.png` });
console.log('Screenshot 1 - antes de pagar');

// Clica no primeiro "Recebi" exato
const btnAlvo = recebiBtns.first();
const btnTexto = await btnAlvo.textContent();
console.log('Clicando botão:', btnTexto?.trim());
await btnAlvo.click();

// Aguarda router.refresh() completar
await page.waitForTimeout(3000);
await page.screenshot({ path: `${DIR}/p2-apos-pagar.png` });
console.log('Screenshot 2 - após pagar');

const countDepois = await page.getByRole('button', { name: 'Recebi', exact: true }).count();
const desfazerCount = await page.getByRole('button', { name: 'Desfazer', exact: true }).count();
console.log('Botões "Recebi" depois:', countDepois, '| "Desfazer":', desfazerCount);

// Log de auditoria filtrado por Lançamento + Pagou
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Lançamento' });
await page.selectOption('select[name=acao]', { label: 'Pagou' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/p3-auditoria-pagou.png` });
console.log('Screenshot 3 - auditoria: Lançamento + Pagou');

await browser.close();
console.log('DONE');
