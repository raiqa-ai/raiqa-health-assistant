const multer = require("multer");
const { pfpUploadStorage } = require('./storageConfigs');

function handlePfpUpload(request, response, next) {
  const upload = multer({ storage: pfpUploadStorage }).single("file");
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

module.exports = { handlePfpUpload };