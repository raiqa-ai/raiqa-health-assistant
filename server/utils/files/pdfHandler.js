const multer = require("multer");
const { fileUploadStorage } = require('./storageConfigs');
const { extractPdfText } = require('./pdfProcessor');

function handlePdfUpload(request, response, next) {
  const upload = multer({ 
    storage: fileUploadStorage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    }
  }).single('file');

  upload(request, response, async function (err) {
    if (err) {
      response.status(500).json({
        success: false,
        error: `Invalid PDF upload. ${err.message}`,
      }).end();
      return;
    }

    try {
      if (request.file) {
        request.pdfText = await extractPdfText(request.file.path);
      }
      next();
    } catch (error) {
      response.status(500).json({
        success: false,
        error: `Failed to process PDF. ${error.message}`,
      }).end();
    }
  });
}

module.exports = { handlePdfUpload };
