import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const documents = {
  academic: {
    filename: "brochure.pdf",
    documentName: "SGRRU Official Academic Brochure 2026-27",
  },
  fee: {
    filename: "fee.pdf",
    documentName: "SGRRU Official Fee Structure 2026-27",
  },
};

function splitText(text, documentName, filename) {
  const chunks = [];
  const chunkSize = 1000;
  const chunkOverlap = 150;
  const step = chunkSize - chunkOverlap;

  for (let start = 0; start < text.length; start += step) {
    const pageContent = text.slice(start, start + chunkSize).trim();
    if (pageContent) {
      chunks.push({
        pageContent,
        metadata: { documentName, source: filename },
      });
    }
    if (start + chunkSize >= text.length) break;
  }

  return chunks;
}

const output = {};

for (const [key, document] of Object.entries(documents)) {
  const buffer = await readFile(`public/pdfs/${document.filename}`);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  output[key] = splitText(result.text || "", document.documentName, document.filename);
}

await mkdir("src/data", { recursive: true });
await writeFile("src/data/official-documents.json", `${JSON.stringify(output, null, 2)}\n`);
console.log("Extracted official PDF text to src/data/official-documents.json");
