const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4 } = require("uuid");

const fileUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput = process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, `../../../collector/hotdir`)
      : path.resolve(process.env.STORAGE_DIR, `documents`);
    fs.mkdirSync(uploadOutput, { recursive: true });
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
    cb(null, file.originalname);
  },
});

const fileAPIUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput = process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, `../../../collector/hotdir`)
      : path.resolve(process.env.STORAGE_DIR, `documents`);
    fs.mkdirSync(uploadOutput, { recursive: true });
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    cb(null, file.originalname);
  },
});

const pfpUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput = process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, `../../storage/assets`)
      : path.resolve(process.env.STORAGE_DIR, `assets`);
    fs.mkdirSync(uploadOutput, { recursive: true });
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    cb(null, file.originalname);
  },
});

const assetUploadStorage = multer.diskStorage({
  destination: function (_, __, cb) {
    const uploadOutput = process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, `../../storage/assets`)
      : path.resolve(process.env.STORAGE_DIR, `assets`);
    fs.mkdirSync(uploadOutput, { recursive: true });
    cb(null, uploadOutput);
  },
  filename: function (_, file, cb) {
    cb(null, file.originalname);
  },
});

module.exports = {
  fileUploadStorage,
  fileAPIUploadStorage,
  assetUploadStorage,
  pfpUploadStorage
};