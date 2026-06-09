// Cria um PDF de 3 páginas para testar a conversão
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.HelveticaBold);

const cores = [
  { bg: rgb(0.95, 0.9, 1.0), titulo: 'Pagina 1 - AdvMartins' },
  { bg: rgb(0.9, 0.95, 1.0), titulo: 'Pagina 2 - Contrato' },
  { bg: rgb(0.9, 1.0, 0.95), titulo: 'Pagina 3 - Encerramento' },
];

for (const { bg, titulo } of cores) {
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // Fundo colorido suave
  page.drawRectangle({ x: 0, y: 0, width, height, color: bg });

  // Cabeçalho
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.35, 0.2, 0.9) });
  page.drawText('AdvMartins', { x: 30, y: height - 52, size: 28, font, color: rgb(1, 1, 1) });

  // Título da página
  page.drawText(titulo, { x: 50, y: height - 160, size: 22, font, color: rgb(0.2, 0.1, 0.5) });

  // Linhas de conteúdo fictício
  for (let i = 0; i < 8; i++) {
    page.drawRectangle({ x: 50, y: height - 210 - i * 40, width: 495, height: 2, color: rgb(0.85, 0.85, 0.9) });
    page.drawText(`Linha de conteudo ${i + 1} — dado juridico de exemplo`, {
      x: 50, y: height - 235 - i * 40, size: 12, font, color: rgb(0.4, 0.4, 0.5),
    });
  }

  // Rodapé
  page.drawText('Documento gerado para teste | AdvMartins SaaS', {
    x: 50, y: 30, size: 10, font, color: rgb(0.6, 0.6, 0.7),
  });
}

const bytes = await doc.save();
writeFileSync('C:/Users/Orlando/Documents/Teste/next-app/teste-conversao.pdf', bytes);
console.log('PDF criado: teste-conversao.pdf (' + bytes.length + ' bytes, 3 paginas)');
