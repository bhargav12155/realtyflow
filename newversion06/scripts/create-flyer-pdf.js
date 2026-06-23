import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagePath = path.join(__dirname, '../attached_assets/Both_1769045055053.PNG');
const outputPath = path.join(__dirname, '../attached_assets/MyGoldenBrick_Flyer.pdf');

const doc = new PDFDocument({
  size: 'letter',
  margin: 0
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

const pageWidth = 612;
const pageHeight = 792;

doc.image(imagePath, 0, 0, {
  fit: [pageWidth, pageHeight],
  align: 'center',
  valign: 'center'
});

doc.end();

writeStream.on('finish', () => {
  console.log(`PDF created successfully: ${outputPath}`);
});

writeStream.on('error', (err) => {
  console.error('Error creating PDF:', err);
});
