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

// Lista de clientes — usa o "Cliente Teste Auditoria" criado no teste anterior
await page.goto('http://localhost:3000/dashboard/clientes');
await page.waitForLoadState('networkidle');

// Busca o cliente de teste pelo nome
const clientLinks = await page.locator('a[href*="/clientes/"]').all();
let clienteUrl = null;
let nomeCliente = null;

for (const link of clientLinks) {
  const href = await link.getAttribute('href');
  if (!href || !/\/clientes\/[0-9a-f-]{36}$/.test(href)) continue;
  const txt = (await link.textContent())?.trim() ?? '';
  if (txt.toLowerCase().includes('teste auditoria') || txt.toLowerCase().includes('cliente teste')) {
    clienteUrl = href;
    nomeCliente = txt;
    break;
  }
}

// Se não achou o de teste, pega o último da lista (mais novo)
if (!clienteUrl) {
  console.log('Cliente de teste não encontrado — usando o mais recente da lista');
  for (const link of [...clientLinks].reverse()) {
    const href = await link.getAttribute('href');
    if (href && /\/clientes\/[0-9a-f-]{36}$/.test(href)) {
      clienteUrl = href;
      nomeCliente = (await link.textContent())?.trim();
      break;
    }
  }
}

if (!clienteUrl) {
  console.log('Nenhum cliente encontrado para deletar.');
  await browser.close();
  process.exit(1);
}

console.log('Cliente a deletar:', nomeCliente, '→', clienteUrl);

// Abre o detalhe do cliente
await page.goto(`http://localhost:3000${clienteUrl}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/d0-detalhe-cliente.png` });

// Aceita o window.confirm() automaticamente
page.on('dialog', async (dialog) => {
  console.log('Dialog:', dialog.type(), '—', dialog.message());
  await dialog.accept();
});

// Clica em Excluir
await page.locator('button:has-text("Excluir")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${DIR}/d1-apos-confirm.png` });
console.log('Screenshot 1 - após confirmar exclusão');

try {
  await page.waitForURL((url) => url.pathname === '/dashboard/clientes', { timeout: 20000 });
  console.log('Cliente excluído! URL:', page.url());
} catch {
  console.log('Redirect não aconteceu. URL:', page.url());
}

await page.screenshot({ path: `${DIR}/d2-pos-deletar.png` });
console.log('Screenshot 2 - pós deletar');

// Log de auditoria filtrado por Cliente + Excluiu
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Cliente' });
await page.selectOption('select[name=acao]', { label: 'Excluiu' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/d3-auditoria-excluiu.png` });
console.log('Screenshot 3 - auditoria: Cliente + Excluiu');

await browser.close();
console.log('DONE');
