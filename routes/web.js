const express = require('express');
const router = express.Router();
const path = require('path');

// Serve main dashboard
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve API documentation
router.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'docs.html'));
});

module.exports = router;

