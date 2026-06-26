/**
 * Testa o Cadastro por IA com PDF:
 * 1. Cria um PDF com dados de documento brasileiro (texto)
 * 2. Envia para /api/clientes/importacao-ia
 * 3. Exibe o JSON extraído pelo GPT-4o
 * 4. Testa também via browser (Playwright)
 */
import { chromium } from "playwright";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://lideradv.vercel.app";

// ── 1. Cria PDF de teste ──────────────────────────────────────────────────────

async function criarPdfTeste() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Cabeçalho
  page.drawText("SECRETARIA DE SEGURANÇA PÚBLICA", {
    x: 100, y: height - 80,
    size: 14, font: fontBold, color: rgb(0, 0, 0.6),
  });
  page.drawText("CARTEIRA DE IDENTIDADE / REGISTRO GERAL", {
    x: 100, y: height - 100,
    size: 12, font, color: rgb(0.3, 0.3, 0.3),
  });

  // Dados do documento
  const campos = [
    ["NOME:", "CARLOS ROBERTO DE OLIVEIRA SANTOS"],
    ["CPF:", "392.857.640-10"],
    ["RG:", "47.853.921-6"],
    ["ÓRGÃO EMISSOR:", "SSP/SP"],
    ["DATA DE EMISSÃO:", "12/08/2018"],
    ["DATA DE NASCIMENTO:", "04/11/1987"],
    ["FILIAÇÃO (PAI):", "ANTÔNIO DE OLIVEIRA"],
    ["FILIAÇÃO (MÃE):", "MARIA SANTOS DE OLIVEIRA"],
    ["NATURALIDADE:", "São Paulo - SP"],
    ["ENDEREÇO:", "Rua das Flores, 142, Apto 31"],
    ["BAIRRO:", "Vila Mariana"],
    ["CIDADE/UF:", "São Paulo / SP"],
    ["CEP:", "04101-040"],
    ["TELEFONE:", "(11) 98765-4321"],
    ["E-MAIL:", "carlos.oliveira@email.com"],
  ];

  let y = height - 160;
  for (const [label, valor] of campos) {
    page.drawText(label, { x: 60, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(valor, { x: 180, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 24;
  }

  // Rodapé
  page.drawText("Documento gerado para fins de teste — LiderAdv", {
    x: 150, y: 40, size: 8, font, color: rgb(0.6, 0.6, 0.6),
  });

  return await pdfDoc.save();
}

// ── 2. Testa via fetch (API direta) ──────────────────────────────────────────

async function testarViaApi(pdfBytes, cookie) {
  console.log("\n🔬 Testando via API direta...");

  const fd = new globalThis.FormData();
  fd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "documento_teste.pdf");

  const res = await fetch(`${BASE}/api/clientes/importacao-ia`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: fd,
  });

  const json = await res.json();
  console.log(`Status: ${res.status}`);

  if (res.ok && json.data) {
    console.log("\n✅ Extração bem-sucedida! Dados extraídos pelo GPT-4o:\n");
    const d = json.data;
    const campos = [
      ["Nome", d.name],
      ["CPF", d.cpf],
      ["RG", d.rg],
      ["Órgão RG", d.rg_orgao],
      ["Data emissão", d.rg_data_emissao],
      ["Nascimento", d.birth_date],
      ["Gênero", d.genero],
      ["Pai", d.father_name],
      ["Mãe", d.mother_name],
      ["Naturalidade", `${d.naturalidade_city ?? ""}${d.naturalidade_state ? "/" + d.naturalidade_state : ""}`],
      ["CEP", d.zipcode],
      ["Logradouro", d.street],
      ["Número", d.addr_number],
      ["Bairro", d.neighborhood],
      ["Cidade", d.city],
      ["Estado", d.state],
      ["Tipo doc", d.document_type],
    ];
    for (const [k, v] of campos) {
      if (v) console.log(`  ${k.padEnd(14)}: ${v}`);
    }
  } else {
    console.log("❌ Erro:", JSON.stringify(json, null, 2));
  }

  return res.ok;
}

// ── 3. Testa via browser (Playwright) ────────────────────────────────────────

async function testarViaBrowser(pdfPath) {
  console.log("\n🌐 Testando via browser (Playwright)...");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="login"]', "lideradv");
  await page.fill('input[name="senha"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });

  // Ir para clientes
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Clicar "Novo cliente"
  await page.locator('button:has-text("Novo cliente")').first().click();
  await page.waitForTimeout(800);

  // Clicar "Importar por documento"
  await page.locator('text=Importar por documento').first().click();
  await page.waitForTimeout(1000);

  // Tirar screenshot da tela de upload
  await page.screenshot({ path: join(__dirname, "pdf-ia-modal.png") });

  // Fazer upload do PDF
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles(pdfPath);
    console.log("  📎 PDF enviado via input file");
  } else {
    // Try to upload via the modal's hidden input
    const hiddenInput = await page.locator('input[type="file"]').first().isVisible().catch(() => false);
    if (!hiddenInput) {
      console.log("  ⚠️  Input de arquivo não visível — tentando forçar upload");
    }
    await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: join(__dirname, "pdf-ia-upload.png") });

  // Aguardar a IA processar (pode demorar até 15s)
  console.log("  ⏳ Aguardando processamento GPT-4o...");
  try {
    await page.waitForSelector(
      'text=Nome, input[name="name"], [class*="resultado"], [class*="extracted"], button:has-text("Usar dados")',
      { timeout: 30000 }
    );
    console.log("  ✅ Resultado da IA apareceu!");
  } catch {
    console.log("  ⏰ Timeout esperando resultado (pode estar em loading)");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(__dirname, "pdf-ia-resultado.png") });
  console.log(`  📸 Screenshots salvas em scripts/`);

  await browser.close();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(55));
  console.log("🤖 Teste: Cadastro por IA com PDF");
  console.log("═".repeat(55));

  // Cria o PDF
  console.log("\n📄 Criando PDF de teste com dados brasileiros...");
  const pdfBytes = await criarPdfTeste();
  const pdfPath = join(__dirname, "test-documento.pdf");
  writeFileSync(pdfPath, pdfBytes);
  console.log(`  Salvo em: ${pdfPath} (${pdfBytes.length} bytes)`);

  // Obtém session cookie
  console.log("\n🔐 Obtendo sessão...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "lideradv", senha: "123456" }),
  }).catch(() => null);

  // Use browser to get cookie
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const loginPage = await ctx.newPage();
  await loginPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await loginPage.fill('input[name="login"]', "lideradv");
  await loginPage.fill('input[name="senha"]', "123456");
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });
  const cookies = await ctx.cookies();
  const cookie = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  await browser.close();

  // Testa via API
  const apiOk = await testarViaApi(pdfBytes, cookie);

  // Testa via browser
  await testarViaBrowser(pdfPath);

  console.log("\n" + "═".repeat(55));
  console.log(apiOk ? "🎉 PDF lido com sucesso pelo GPT-4o!" : "❌ Falha na leitura do PDF");
  console.log("═".repeat(55));
}

main().catch(e => { console.error("Erro:", e); process.exit(1); });
