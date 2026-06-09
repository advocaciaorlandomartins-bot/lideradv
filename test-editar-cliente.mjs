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

// Lista de clientes
await page.goto('http://localhost:3000/dashboard/clientes');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/e0-lista-clientes.png` });

// Pega o href do primeiro link com UUID de cliente (padrão /clientes/{uuid})
const clientLinks = await page.locator('a[href*="/clientes/"]').all();
let clienteUrl = null;
for (const link of clientLinks) {
  const href = await link.getAttribute('href');
  // UUID tem 36 chars: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  if (href && /\/clientes\/[0-9a-f-]{36}$/.test(href)) {
    clienteUrl = href;
    const txt = await link.textContent();
    console.log('Cliente selecionado:', txt?.trim(), '→', href);
    break;
  }
}

if (!clienteUrl) {
  console.log('Nenhum cliente com UUID encontrado. Screenshot:');
  await page.screenshot({ path: `${DIR}/e0b-debug.png` });
  await browser.close();
  process.exit(1);
}

// Abre o cliente
await page.goto(`http://localhost:3000${clienteUrl}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/e1-detalhe-cliente.png` });
console.log('URL detalhe:', page.url());

// Navega direto para editar
await page.goto(`http://localhost:3000${clienteUrl}/editar`);
await page.waitForLoadState('networkidle');
console.log('URL editar:', page.url());
await page.screenshot({ path: `${DIR}/e2-form-editar.png` });

// Edita o campo de observações
const obsField = page.locator('textarea[name="notes"]').first();
const obsAtual = await obsField.inputValue();
const novaObs = `Editado via teste automatizado em ${new Date().toLocaleTimeString('pt-BR')}`;
await obsField.fill(novaObs);
console.log('Obs anterior:', obsAtual || '(vazio)');
console.log('Nova obs:', novaObs);

await page.screenshot({ path: `${DIR}/e3-form-editado.png` });

// Salvar
await page.click('button[type=submit]');

try {
  await page.waitForURL((url) => !url.pathname.includes('/editar'), { timeout: 20000 });
  console.log('Salvo! URL:', page.url());
} catch {
  console.log('Redirect não aconteceu. URL:', page.url());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const erros = await page.locator('[class*="text-red"]').allTextContents();
  if (erros.length) console.log('Erros:', erros.filter(Boolean));
}

await page.screenshot({ path: `${DIR}/e4-pos-salvar.png` });
console.log('Screenshot 4 - pós salvar');

// Log de auditoria filtrado por Cliente + ação editar
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Cliente' });
await page.selectOption('select[name=acao]', { label: 'Editou' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/e5-auditoria-editou.png` });
console.log('Screenshot 5 - auditoria filtrada: Cliente + Editou');

await browser.close();
console.log('DONE');
