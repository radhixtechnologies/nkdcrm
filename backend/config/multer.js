/**
 * Multer Configuration for Document & Excel File Uploads
 * Validates file type and size safely
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Ensure uploads directory exists with writable temp fallback
const preferredUploadDir = path.resolve(__dirname, '../../uploads');
let uploadDir = preferredUploadDir;
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.accessSync(uploadDir, fs.constants.W_OK);
} catch (err) {
    uploadDir = path.join(os.tmpdir(), 'nkd-crm-uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    console.warn(`⚠️ Using temporary upload directory (${uploadDir}): ${err.message}`);
}

// Configure disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        const name = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter - Require BOTH valid extension AND safe MIME type
const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream' // Fallback used by some mobile/OS pickers; still guarded strictly by allowedExtensions
];

const allowedExtensions = ['.xls', '.xlsx', '.csv', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (allowedExtensions.includes(ext) && allowedMimes.includes(mime)) {
        cb(null, true);
    } else {
        const err = new Error('Invalid file type. Allowed: Excel (.xls, .xlsx, .csv), PDF, JPG, PNG, WEBP, Word (.doc, .docx)');
        err.status = 400;
        cb(err, false);
    }
};

const excelExtensions = ['.xls', '.xlsx', '.csv'];
const excelMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
    'application/octet-stream'
];

const excelFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (excelExtensions.includes(ext) && excelMimes.includes(mime)) {
        cb(null, true);
    } else {
        const err = new Error('Invalid spreadsheet file. Please upload a .xlsx, .xls, or .csv file.');
        err.status = 400;
        cb(err, false);
    }
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxFileSize }
});

const uploadMemory = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: maxFileSize }
});

const uploadExcel = multer({
    storage: multer.memoryStorage(),
    fileFilter: excelFileFilter,
    limits: { fileSize: maxFileSize }
});

upload.uploadDir = uploadDir;
upload.uploadMemory = uploadMemory;
upload.uploadExcel = uploadExcel;

module.exports = upload;
