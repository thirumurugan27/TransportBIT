const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Memory storage for files that are processed in-memory (Excel, CSV)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Profile upload storage
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'admin' + ext);
  }
});
const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Fuel indent bill upload storage
const fuelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'Documents', 'FuelIndents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const id = req.params.id || req.body.indent_id || 'fuel';
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueName = `fuel_${id}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});
const fuelUpload = multer({
  storage: fuelStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Purchase invoice upload storage
const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'Documents', 'Purchase');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const orderId = req.params.id || req.body.order_id || 'invoice';
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueName = `invoice_${orderId}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});
const invoiceUpload = multer({
  storage: invoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = {
  memoryUpload,
  profileUpload,
  fuelUpload,
  invoiceUpload
};
