const { trashFile, writeToServerDocuments } = require("../../../utils/files");
const { processPdfDocument } = require("../../../../server/utils/files/pdfProcessor");
const { default: slugify } = require("slugify");

async function asPdf({ fullFilePath = "", filename = "" }) {
  try {
    console.log(`-- Working ${filename} --`);
    const data = await processPdfDocument(fullFilePath, filename);
    
    const document = writeToServerDocuments(
      data,
      `${slugify(filename)}-${data.id}`
    );
    trashFile(fullFilePath);
    console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
    return { success: true, reason: null, documents: [document] };
  } catch (error) {
    console.error(`Error processing PDF ${filename}:`, error.message);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: error.message,
      documents: [],
    };
  }
}

module.exports = { asPdf };
