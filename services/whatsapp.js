const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.qrCode = null;
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.sessionPath = path.join(__dirname, '..', 'sessions', process.env.SESSION_NAME || 'whatsapp-session');
    }

    async initialize() {
        try {
            console.log('🔄 Initializing WhatsApp connection...');
            
            // Ensure session directory exists
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            const { version } = await fetchLatestBaileysVersion();

            this.sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }),
                browser: ['WhatsApp Sender API', 'Chrome', '1.0.0'],
                getMessage: async (key) => {
                    return { conversation: '' };
                }
            });

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qrCode = qr;
                    this.connectionState = 'qr';
                    console.log('📱 QR Code generated! Scan it from web interface.');
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
                    
                    this.isConnected = false;
                    this.connectionState = 'disconnected';
                    
                    if (shouldReconnect) {
                        setTimeout(() => this.initialize(), 3000);
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp connected successfully!');
                    this.isConnected = true;
                    this.connectionState = 'connected';
                    this.qrCode = null;
                    
                    // Send webhook notification if enabled
                    this.sendWebhook('connected', { message: 'WhatsApp connected successfully' });
                }
            });

            // Save credentials on update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages (for webhooks)
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type === 'notify') {
                    for (const msg of messages) {
                        if (!msg.key.fromMe && process.env.WEBHOOK_ENABLED === 'true') {
                            this.sendWebhook('message', {
                                from: msg.key.remoteJid,
                                message: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                                timestamp: msg.messageTimestamp
                            });
                        }
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error initializing WhatsApp:', error);
            this.connectionState = 'error';
        }
    }

    async sendMessage(number, message) {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            const jid = this.formatNumber(number);
            await this.sock.sendMessage(jid, { text: message });
            return { success: true, message: 'Message sent successfully' };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async sendImage(number, imageBuffer, caption = '') {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            const jid = this.formatNumber(number);
            await this.sock.sendMessage(jid, {
                image: imageBuffer,
                caption: caption
            });
            return { success: true, message: 'Image sent successfully' };
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    async sendDocument(number, documentBuffer, filename, mimetype) {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            const jid = this.formatNumber(number);
            await this.sock.sendMessage(jid, {
                document: documentBuffer,
                fileName: filename,
                mimetype: mimetype
            });
            return { success: true, message: 'Document sent successfully' };
        } catch (error) {
            console.error('Error sending document:', error);
            throw error;
        }
    }

    async sendBulkMessages(numbers, message, delay = 2000) {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        const results = [];
        for (const number of numbers) {
            try {
                await this.sendMessage(number, message);
                results.push({ number, success: true });
                
                // Delay between messages to avoid spam detection
                if (delay > 0) {
                    await this.sleep(delay);
                }
            } catch (error) {
                results.push({ number, success: false, error: error.message });
            }
        }
        return results;
    }

    async getContacts() {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            const contacts = await this.sock.store?.contacts || {};
            return Object.values(contacts).map(contact => ({
                id: contact.id,
                name: contact.name || contact.notify || contact.verifiedName || 'Unknown',
                number: contact.id.split('@')[0]
            }));
        } catch (error) {
            console.error('Error getting contacts:', error);
            return [];
        }
    }

    async getGroups() {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            const groups = await this.sock.groupFetchAllParticipating();
            return Object.values(groups).map(group => ({
                id: group.id,
                name: group.subject,
                participants: group.participants.length,
                owner: group.owner
            }));
        } catch (error) {
            console.error('Error getting groups:', error);
            return [];
        }
    }

    async sendGroupMessage(groupId, message) {
        if (!this.isConnected) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            await this.sock.sendMessage(groupId, { text: message });
            return { success: true, message: 'Group message sent successfully' };
        } catch (error) {
            console.error('Error sending group message:', error);
            throw error;
        }
    }

    async logout() {
        try {
            if (this.sock) {
                await this.sock.logout();
            }
            
            // Delete session files
            if (fs.existsSync(this.sessionPath)) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
            }
            
            this.isConnected = false;
            this.connectionState = 'disconnected';
            this.qrCode = null;
            
            console.log('✅ Logged out successfully');
            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            console.error('Error logging out:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.sock) {
                await this.sock.end();
            }
            this.isConnected = false;
            this.connectionState = 'disconnected';
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            state: this.connectionState,
            hasQR: !!this.qrCode
        };
    }

    getQRCode() {
        return this.qrCode;
    }

    formatNumber(number) {
        // Remove all non-numeric characters
        let cleaned = number.replace(/\D/g, '');
        
        // Add country code if not present
        if (!cleaned.startsWith('1') && cleaned.length === 10) {
            cleaned = '1' + cleaned; // Add US country code
        }
        
        // Add @s.whatsapp.net suffix
        return cleaned + '@s.whatsapp.net';
    }

    async sendWebhook(event, data) {
        if (process.env.WEBHOOK_ENABLED !== 'true' || !process.env.WEBHOOK_URL) {
            return;
        }

        try {
            await axios.post(process.env.WEBHOOK_URL, {
                event,
                data,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error sending webhook:', error.message);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new WhatsAppService();

