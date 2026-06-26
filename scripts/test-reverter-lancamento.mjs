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

// Precisa de um lançamento JÁ PAGO para poder reverter
// Primeiro paga um lançamento pendente
await page.goto('http://localhost:3000/dashboard/financeiro/novo');
await page.waitForLoadState('networkidle');
await page.locator('select').nth(1).selectOption('Honorários');
await page.fill('input[name="data_vencimento"]', '2026-07-25');
const vi = page.locator('input[placeholder="0,00"]').first();
await vi.click(); await vi.fill('300'); await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.click('text=Salvar lançamento');
await page.waitForURL((url) => !url.pathname.includes('/novo'), { timeout: 15000 });
console.log('Lançamento criado');

// Financeiro — paga o lançamento recém criado
await page.goto('http://localhost:3000/dashboard/financeiro');
await page.waitForLoadState('networkidle');

// Aceita o confirm do revert
page.on('dialog', async (dialog) => {
  console.log('Dialog:', dialog.message().slice(0, 80));
  await dialog.accept();
});

const recebiBtn = page.getByRole('button', { name: 'Recebi', exact: true }).first();
const temRecebi = await recebiBtn.isVisible().catch(() => false);
if (temRecebi) {
  await recebiBtn.click();
  await page.waitForTimeout(3000);
  console.log('Lançamento marcado como pago');
} else {
  console.log('Nenhum botão Recebi — talvez já tenha pago');
}

// Agora localiza o botão Desfazer (lançamento pago → reverter para pendente)
await page.goto('http://localhost:3000/dashboard/financeiro');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/r0-financeiro.png` });

// Clica na tab Concluídas para ver os pagos
const concluidasTab = page.getByRole('button', { name: /Conclu/i }).first();
if (await concluidasTab.isVisible().catch(() => false)) {
  await concluidasTab.click();
  await page.waitForTimeout(500);
}

const desfazerBtns = page.getByRole('button', { name: 'Desfazer', exact: true });
const countDesfazer = await desfazerBtns.count();
console.log('Botões "Desfazer" encontrados:', countDesfazer);

if (countDesfazer === 0) {
  // Tenta na view "Todos"
  const todosTab = page.getByRole('button', { name: 'Todos', exact: true }).first();
  if (await todosTab.isVisible().catch(() => false)) {
    await todosTab.click();
    await page.waitForTimeout(500);
  }
  const count2 = await page.getByRole('button', { name: 'Desfazer', exact: true }).count();
  console.log('Botões Desfazer após ir para Todos:', count2);
}

await page.screenshot({ path: `${DIR}/r1-antes-reverter.png` });
console.log('Screenshot 1 - antes de reverter');

const btnDesfazer = page.getByRole('button', { name: 'Desfazer', exact: true }).first();
await btnDesfazer.click();
await page.waitForTimeout(3000);

await page.screenshot({ path: `${DIR}/r2-apos-reverter.png` });
console.log('Screenshot 2 - após reverter');

const desfazerDepois = await page.getByRole('button', { name: 'Desfazer', exact: true }).count();
const recebiDepois = await page.getByRole('button', { name: 'Recebi', exact: true }).count();
console.log('Desfazer depois:', desfazerDepois, '| Recebi depois:', recebiDepois);

// Log de auditoria filtrado por Lançamento + Reverteu
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Lançamento' });
await page.selectOption('select[name=acao]', { label: 'Reverteu' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/r3-auditoria-reverteu.png` });
console.log('Screenshot 3 - auditoria: Lançamento + Reverteu');

await browser.close();
console.log('DONE');
