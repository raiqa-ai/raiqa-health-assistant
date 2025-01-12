const path = require('path');
const fs = require('fs').promises;
const { v4 } = require("uuid");
const { PDFLoader } = require("./PDFLoader");
const { createdDate } = require("../../collector/utils/files");
const { tokenizeString } = require("../../collector/utils/tokenizer");
const { default: slugify } = require("slugify");

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
