const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const whatsappService = require('../services/whatsapp');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// API Key middleware
const checkApiKey = (req, res, next) => {
    if (process.env.ENABLE_API_KEY !== 'true') {
        return next();
    }

    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or missing API key'
        });
    }
    
    next();
};

// Apply API key check to all routes
router.use(checkApiKey);

// Get connection status
router.get('/status', (req, res) => {
    const status = whatsappService.getStatus();
    res.json({
        success: true,
        data: status
    });
});

// Get QR code
router.get('/qr', (req, res) => {
    const qr = whatsappService.getQRCode();
    
    if (!qr) {
        return res.json({
            success: false,
            message: 'No QR code available. Either already connected or not initialized.'
        });
    }
    
    res.json({
        success: true,
        qr: qr
    });
});

// Get QR code as image
router.get('/qr-image', async (req, res) => {
    const QRCode = require('qrcode');
    const qr = whatsappService.getQRCode();
    
    if (!qr) {
        return res.status(404).send('No QR code available');
    }
    
    try {
        const qrImage = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
        const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
        const img = Buffer.from(base64Data, 'base64');
        
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length
        });
        res.end(img);
    } catch (error) {
        res.status(500).send('Error generating QR code');
    }
});

// Send text message
router.post('/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Number and message are required'
            });
        }
        
        const result = await whatsappService.sendMessage(number, message);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send image
router.post('/send-image', upload.single('image'), async (req, res) => {
    try {
        const { number, caption } = req.body;
        
        if (!number || !req.file) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Number and image are required'
            });
        }
        
        const imageBuffer = fs.readFileSync(req.file.path);
        const result = await whatsappService.sendImage(number, imageBuffer, caption || '');
        
        // Delete uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send document
router.post('/send-document', upload.single('document'), async (req, res) => {
    try {
        const { number } = req.body;
        
        if (!number || !req.file) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Number and document are required'
            });
        }
        
        const documentBuffer = fs.readFileSync(req.file.path);
        const result = await whatsappService.sendDocument(
            number,
            documentBuffer,
            req.file.originalname,
            req.file.mimetype
        );
        
        // Delete uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send bulk messages
router.post('/send-bulk', async (req, res) => {
    try {
        const { numbers, message, delay } = req.body;
        
        if (!numbers || !Array.isArray(numbers) || !message) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'Numbers (array) and message are required'
            });
        }
        
        const results = await whatsappService.sendBulkMessages(numbers, message, delay || 2000);
        
        res.json({
            success: true,
            data: {
                total: numbers.length,
                results: results
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get contacts
router.get('/contacts', async (req, res) => {
    try {
        const contacts = await whatsappService.getContacts();
        res.json({
            success: true,
            data: contacts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get groups
router.get('/groups', async (req, res) => {
    try {
        const groups = await whatsappService.getGroups();
        res.json({
            success: true,
            data: groups
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send group message
router.post('/send-group-message', async (req, res) => {
    try {
        const { groupId, message } = req.body;
        
        if (!groupId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Group ID and message are required'
            });
        }
        
        const result = await whatsappService.sendGroupMessage(groupId, message);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        const result = await whatsappService.logout();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

