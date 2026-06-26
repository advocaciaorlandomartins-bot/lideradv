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

// Cria um lançamento de teste para deletar
await page.goto('http://localhost:3000/dashboard/financeiro/novo');
await page.waitForLoadState('networkidle');
await page.locator('select').nth(1).selectOption('Honorários');
await page.fill('input[name="data_vencimento"]', '2026-08-01');
const vi = page.locator('input[placeholder="0,00"]').first();
await vi.click(); await vi.fill('100'); await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.click('text=Salvar lançamento');
await page.waitForURL((url) => !url.pathname.includes('/novo'), { timeout: 15000 });
console.log('Lançamento de teste criado (R$100)');

// Aceita qualquer confirm dialog
page.on('dialog', async (dialog) => {
  console.log('Dialog:', dialog.message().slice(0, 80));
  await dialog.accept();
});

// Financeiro
await page.goto('http://localhost:3000/dashboard/financeiro');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/dl0-financeiro.png` });

// Botões "Excluir" exatos
const excluirBtns = page.getByRole('button', { name: 'Excluir', exact: true });
const countAntes = await excluirBtns.count();
console.log('Botões "Excluir" antes:', countAntes);

if (countAntes === 0) {
  console.log('Nenhum botão Excluir visível. Verificando todos os botões:');
  const allBtns = await page.locator('button').allTextContents();
  console.log(allBtns.filter(t => t.trim().length > 0 && t.trim().length < 30));
  await browser.close();
  process.exit(0);
}

await page.screenshot({ path: `${DIR}/dl1-antes-deletar.png` });
console.log('Screenshot 1 - antes de deletar');

// Clica no primeiro Excluir
const btnExcluir = excluirBtns.first();
console.log('Clicando Excluir...');
await btnExcluir.click();
await page.waitForTimeout(3000);

await page.screenshot({ path: `${DIR}/dl2-apos-deletar.png` });
console.log('Screenshot 2 - após deletar');

const countDepois = await page.getByRole('button', { name: 'Excluir', exact: true }).count();
console.log('Botões Excluir depois:', countDepois, '(era', countAntes, ')');

// Log de auditoria filtrado por Lançamento + Excluiu
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Lançamento' });
await page.selectOption('select[name=acao]', { label: 'Excluiu' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/dl3-auditoria-excluiu.png` });
console.log('Screenshot 3 - auditoria: Lançamento + Excluiu');

await browser.close();
console.log('DONE');
