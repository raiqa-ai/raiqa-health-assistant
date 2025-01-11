const path = require('path');
const fs = require('fs').promises;
const { v4 } = require("uuid");
const { createdDate } = require("../../../collector/utils/files");
const { tokenizeString } = require("../../../collector/utils/tokenizer");
const { default: slugify } = require("slugify");

class PDFLoader {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.options = options;
  }

  async getPdfJS() {
    return import('pdfjs-dist/legacy/build/pdf.js');
  }

  async load() {
    const buffer = await fs.readFile(this.filePath);
    const { getDocument, version } = await this.getPdfJS();

    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const meta = await pdf.getMetadata().catch(() => null);
    const documents = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      if (content.items.length === 0) continue;

      let lastY;
      const textItems = [];
      for (const item of content.items) {
        if ("str" in item) {
          if (lastY === item.transform[5] || !lastY) {
            textItems.push(item.str);
          } else {
            textItems.push(`\n${item.str}`);
          }
          lastY = item.transform[5];
        }
      }

      const text = textItems.join("");
      documents.push({
        pageContent: text.trim(),
        metadata: {
          source: this.filePath,
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: pdf.numPages,
          },
          loc: { pageNumber: i },
        },
      });
    }
    return documents;
  }
}

async function extractPdfText(filePath) {
  const pdfLoader = new PDFLoader(filePath, {
    splitPages: true,
  });

  const docs = await pdfLoader.load();
  const pageContent = [];

  for (const doc of docs) {
    if (!doc.pageContent || !doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
  }

  return {
    content: pageContent.join(""),
    metadata: docs[0]?.metadata?.pdf || {},
  };
}

async function processPdfDocument(filePath, filename) {
  const { content, metadata } = await extractPdfText(filePath);
  
  if (!content.length) {
    throw new Error(`No text content found in ${filename}`);
  }

  return {
    id: v4(),
    url: "file://" + filePath,
    title: filename,
    docAuthor: metadata?.info?.Creator || "no author found",
    description: metadata?.info?.Title || "No description found.",
    docSource: "pdf file uploaded by the user.",
    chunkSource: "",
    published: createdDate(filePath),
    wordCount: content.split(" ").length,
    pageContent: content,
    token_count_estimate: tokenizeString(content).length,
  };
}

module.exports = {
  extractPdfText,
  processPdfDocument
};
