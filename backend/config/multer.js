/**
 * Multer Configuration for Excel File Uploads
 * Validates file type and size
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter - Accept Excel, PDF, Images, Word
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/pdf', // .pdf
        'image/jpeg', // .jpg, .jpeg
        'image/png', // .png
        'image/webp', // .webp
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];

    const allowedExtensions = ['.xls', '.xlsx', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    // Check mime type (preferred) or extension (fallback)
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        // Less strict: Log warning but allow if extension matches common types?
        // For now, strict allow list is safer but needs to cover common types.
        cb(new Error('Invalid file type. Allowed: Excel, PDF, JPG, PNG, Word'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    }
});

module.exports = upload;
