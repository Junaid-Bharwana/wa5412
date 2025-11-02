const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const whatsappService = require('./services/whatsapp');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || '*'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create necessary directories
const dirs = ['sessions', 'uploads', 'logs'];
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 WhatsApp Sender API Server Started!');
    console.log('='.repeat(60));
    console.log(`📱 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    console.log(`🔌 API Endpoint: http://localhost:${PORT}/api`);
    console.log('='.repeat(60));
    console.log('📋 Available Endpoints:');
    console.log('   - GET  /api/status          - Check connection status');
    console.log('   - GET  /api/qr              - Get QR code for scanning');
    console.log('   - POST /api/send-message    - Send text message');
    console.log('   - POST /api/send-image      - Send image');
    console.log('   - POST /api/send-document   - Send document');
    console.log('   - POST /api/send-bulk       - Send bulk messages');
    console.log('   - GET  /api/contacts        - Get contacts list');
    console.log('   - GET  /api/groups          - Get groups list');
    console.log('   - POST /api/logout          - Logout session');
    console.log('='.repeat(60));
    
    // Initialize WhatsApp
    whatsappService.initialize();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await whatsappService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await whatsappService.disconnect();
    process.exit(0);
});

