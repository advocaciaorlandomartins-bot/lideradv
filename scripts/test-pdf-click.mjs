import { chromium } from "playwright";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://lideradv.vercel.app";

async function criarPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  page.drawText("SECRETARIA DE SEGURANÇA PÚBLICA", { x: 100, y: height - 80, size: 14, font: fontBold, color: rgb(0, 0, 0.6) });
  page.drawText("CARTEIRA DE IDENTIDADE / REGISTRO GERAL", { x: 100, y: height - 100, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
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
    ["CEP:", "04101-040"],
    ["ENDEREÇO:", "Rua das Flores, 142, Apto 31"],
    ["BAIRRO:", "Vila Mariana"],
    ["CIDADE/UF:", "São Paulo / SP"],
  ];
  let y = height - 160;
  for (const [label, valor] of campos) {
    page.drawText(label, { x: 60, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(valor, { x: 180, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 24;
  }
  return await pdfDoc.save();
}

async function main() {
  const pdfBytes = await criarPdf();
  const pdfPath = join(__dirname, "test-documento.pdf");
  writeFileSync(pdfPath, pdfBytes);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="login"]', "lideradv");
  await page.fill('input[name="senha"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard**`, { timeout: 15000 });

  // Go to clientes
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Open dropdown
  await page.locator('button:has-text("Novo cliente")').first().click();
  await page.waitForTimeout(600);

  // Click "Importar por documento"
  await page.locator('text=Importar por documento').first().click();
  await page.waitForTimeout(1000);

  // Upload file
  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(__dirname, "r1-upload.png") });

  // Click "Extrair dados com IA"
  const extractBtn = page.locator('button:has-text("Extrair dados com IA")').first();
  if (await extractBtn.isVisible().catch(() => false)) {
    await extractBtn.click();
    console.log("Clicked 'Extrair dados com IA'");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(__dirname, "r2-loading.png") });

    // Wait up to 30s for result
    console.log("Waiting for AI result (up to 30s)...");
    try {
      await page.waitForSelector('text=Revisar, text=Nome, text=CPF, [class*="result"], button:has-text("Salvar")', { timeout: 30000 });
    } catch {}
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(__dirname, "r3-result.png") });

    const bodyText = await page.locator("body").innerText();
    // Check for success indicators
    const hasResult = bodyText.includes("Nome") && bodyText.includes("CPF");
    const hasError = bodyText.includes("Erro") || bodyText.includes("erro") || bodyText.includes("quota") || bodyText.includes("429");
    console.log("Has result data:", hasResult);
    console.log("Has error:", hasError);
    if (hasError) {
      const errorEl = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').first().innerText().catch(() => "");
      console.log("Error message:", errorEl.slice(0, 200));
    }
  } else {
    console.log("Button not found - taking screenshot");
    await page.screenshot({ path: join(__dirname, "r1-upload.png") });
  }

  await browser.close();
  console.log("Done. Screenshots saved in scripts/");
}

main().catch(e => { console.error(e); process.exit(1); });
