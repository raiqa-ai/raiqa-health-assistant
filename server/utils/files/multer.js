const multer = require("multer");
const { fileUploadStorage, fileAPIUploadStorage } = require('./storageConfigs');

function handleFileUpload(request, response, next) {
  const upload = multer({ storage: fileUploadStorage }).single("file");
  upload(request, response, function (err) {
    if (err) {
      response.status(500).json({
        success: false,
        error: `Invalid file upload. ${err.message}`,
      }).end();
      return;
    }
    next();
  });
}

function handleAPIFileUpload(request, response, next) {
  const upload = multer({ storage: fileAPIUploadStorage }).single("file");
  upload(request, response, function (err) {
    if (err) {
      response.status(500).json({
        success: false,
        error: `Invalid file upload. ${err.message}`,
      }).end();
      return;
    }
    next();
  });
}

module.exports = {
  handleFileUpload,
  handleAPIFileUpload
};
