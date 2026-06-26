import { chromium } from 'playwright';

const SESSION = 'eyJpZCI6IjY3MThjYjk5LWM4YmUtNDFmMi1hNWJkLTNlZjI4MWM1NjE4ZiIsImxvZ2luIjoiYWR2b2NhY2lhb3JsYW5kb21hcnRpbnNAZ21haWwuY29tIiwiY2F0ZWdvcmlhIjoiQWRtaW5pc3RyYWRvcihhKSIsInBlcm1pc3NvZXMiOnsibW9kZWxvcyI6WyJ2ZXIiLCJjcmlhciIsImVkaXRhciIsImV4Y2x1aXIiXSwiY2xpZW50ZXMiOlsidmVyIiwiY3JpYXIiLCJlZGl0YXIiLCJleGNsdWlyIl0sInVzdWFyaW9zIjpbInZlciIsImNyaWFyIiwiZWRpdGFyIiwiZXhjbHVpciJdLCJjb250cm9sZXMiOlsidmVyIiwiY3JpYXIiLCJlZGl0YXIiLCJleGNsdWlyIl0sInByb2Nlc3NvcyI6WyJ2ZXIiLCJjcmlhciIsImVkaXRhciIsImV4Y2x1aXIiXSwiZmluYW5jZWlybyI6WyJ2ZXIiLCJjcmlhciIsImVkaXRhciIsImV4Y2x1aXIiXSwicmVsYXRvcmlvcyI6WyJ2ZXIiLCJjcmlhciIsImVkaXRhciIsImV4Y2x1aXIiXSwicmVtdW5lcmFjb2VzIjpbInZlciIsImNyaWFyIiwiZWRpdGFyIiwiZXhjbHVpciJdLCJjb2xhYm9yYWRvcmVzIjpbInZlciIsImNyaWFyIiwiZWRpdGFyIiwiZXhjbHVpciJdLCJjb25maWd1cmFjb2VzIjpbInZlciIsImNyaWFyIiwiZWRpdGFyIiwiZXhjbHVpciJdfSwiZXhwIjoxNzgwNTMwOTc3fQ.1edeee542c695553fabfc1b2c67d754206bdf2127d99ff6dc04a488270390998';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'adv_session', value: SESSION, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const nav = async (url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
};
const shot = async (name) => {
  await page.screenshot({ path: `/tmp/sub-${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
};

// INTIMAÇÕES
console.log('\n1. INTIMAÇÕES — tela inicial');
await nav('http://localhost:3000/dashboard/processos/intimacoes');
await shot('01-intimacoes');
const kpiIntimacoes = await page.locator('button').filter({ hasText: /^(Total|Pendentes|Urgentes|Lidas)$/ }).count();
console.log(`   KPI buttons: ${kpiIntimacoes}`);

console.log('   Clicar "Urgentes"');
const urgentesBtn = page.locator('button').filter({ hasText: /^Urgentes$/ }).first();
if (await urgentesBtn.isVisible().catch(() => false)) {
  await urgentesBtn.click();
  await page.waitForTimeout(400);
  await shot('01b-intimacoes-urgentes');
  const rows = await page.locator('[class*="divide-y"] > div').count();
  console.log(`   rows após filtro Urgentes: ${rows}`);
}

// Verificar link "Ver processo"
const verProcesso = page.locator('a:has-text("Ver processo")').first();
const href = await verProcesso.getAttribute('href').catch(() => '');
console.log(`   "Ver processo" href: ${href}`);

// MONITORAMENTO
console.log('\n2. MONITORAMENTO — tela inicial');
await nav('http://localhost:3000/dashboard/processos/central-captura');
await shot('02-monitoramento');
const kpiCaptura = await page.locator('button').filter({ hasText: /^(Monitorados|Movimentações hoje|Com erro|Inativos)$/ }).count();
console.log(`   KPI buttons: ${kpiCaptura}`);

console.log('   Clicar "Com erro"');
const erroBtn = page.locator('button').filter({ hasText: /^Com erro$/ }).first();
if (await erroBtn.isVisible().catch(() => false)) {
  await erroBtn.click();
  await page.waitForTimeout(400);
  await shot('02b-captura-erro');
  const rows = await page.locator('[class*="divide-y"] > div').count();
  console.log(`   rows após filtro Com erro: ${rows}`);
}

// ANDAMENTOS
console.log('\n3. ANDAMENTOS — tela inicial');
await nav('http://localhost:3000/dashboard/processos/andamentos');
await shot('03-andamentos');
const kpiAndamentos = await page.locator('button').filter({ hasText: /^(Hoje|Não lidos|Esta semana)$/ }).count();
console.log(`   KPI buttons (sem Processos): ${kpiAndamentos}`);

// "Processos" KPI deveria ser um Link
const processosKpi = page.locator('a:has-text("Processos")').first();
const processosHref = await processosKpi.getAttribute('href').catch(() => '');
console.log(`   KPI "Processos" href: ${processosHref}`);

console.log('   Clicar "Não lidos"');
const naoLidosBtn = page.locator('button').filter({ hasText: /^Não lidos$/ }).first();
if (await naoLidosBtn.isVisible().catch(() => false)) {
  await naoLidosBtn.click();
  await page.waitForTimeout(400);
  await shot('03b-andamentos-nao-lidos');
  const rows = await page.locator('[class*="divide-y"] > div').count();
  console.log(`   rows após filtro Não lidos: ${rows}`);
}

// "Ver processo" nos andamentos
const verProcessoAnd = page.locator('a:has-text("Ver processo")').first();
const hrefAnd = await verProcessoAnd.getAttribute('href').catch(() => '');
console.log(`   "Ver processo" href: ${hrefAnd}`);

await browser.close();
if (errors.length) { console.log(`\nERROS (${errors.length}):`); errors.slice(0,3).forEach(e => console.log(' -', e.slice(0,150))); }
else { console.log('\nNenhum erro de console!'); }
