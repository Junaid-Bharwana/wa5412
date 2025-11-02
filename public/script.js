// Configuration
const API_BASE = window.location.origin + '/api';
let statusCheckInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkStatus();
    startStatusCheck();
});

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// Check connection status
async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        
        if (data.success) {
            updateStatus(data.data);
        }
    } catch (error) {
        console.error('Error checking status:', error);
        showError('Failed to check status');
    }
}

// Update status display
function updateStatus(status) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const connStatus = document.getElementById('connStatus');
    const connState = document.getElementById('connState');
    
    // Update status indicator
    statusDot.className = 'status-dot';
    if (status.connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
    
    // Update connection info
    connStatus.textContent = status.connected ? 'Connected ✅' : 'Disconnected ❌';
    connState.textContent = status.state;
    
    // Show appropriate section
    document.getElementById('qrSection').style.display = 'none';
    document.getElementById('connectedSection').style.display = 'none';
    document.getElementById('disconnectedSection').style.display = 'none';
    
    if (status.connected) {
        document.getElementById('connectedSection').style.display = 'block';
    } else if (status.hasQR) {
        document.getElementById('qrSection').style.display = 'block';
        loadQR();
    } else {
        document.getElementById('disconnectedSection').style.display = 'block';
    }
}

// Load QR code
async function loadQR() {
    try {
        const response = await fetch(`${API_BASE}/qr`);
        const data = await response.json();
        
        if (data.success && data.qr) {
            const qrCodeDiv = document.getElementById('qrCode');
            qrCodeDiv.innerHTML = '<div class="spinner"></div> Generating QR Code...';
            
            // Check if QRCode library is loaded
            if (typeof QRCode !== 'undefined') {
                qrCodeDiv.innerHTML = '';
                QRCode.toCanvas(data.qr, { width: 300, margin: 2 }, (error, canvas) => {
                    if (error) {
                        console.error('QR Code error:', error);
                        qrCodeDiv.innerHTML = '<p class="error-message">Error generating QR code</p>';
                        return;
                    }
                    qrCodeDiv.appendChild(canvas);
                });
            } else {
                // Fallback: Display QR as text with instructions
                qrCodeDiv.innerHTML = `
                    <div style="background: white; padding: 20px; border-radius: 10px; color: black;">
                        <p><strong>QR Code Data:</strong></p>
                        <textarea readonly style="width: 100%; height: 150px; font-size: 10px; color: black;">${data.qr}</textarea>
                        <p style="margin-top: 10px;"><strong>Alternative:</strong> Use a QR code generator website:</p>
                        <ol style="text-align: left;">
                            <li>Copy the text above</li>
                            <li>Go to: <a href="https://www.qr-code-generator.com/" target="_blank">qr-code-generator.com</a></li>
                            <li>Paste the text and generate QR</li>
                            <li>Scan with WhatsApp</li>
                        </ol>
                    </div>
                `;
            }
        } else {
            document.getElementById('qrCode').innerHTML = '<p class="warning-message">No QR code available. Please refresh.</p>';
        }
    } catch (error) {
        console.error('Error loading QR:', error);
        document.getElementById('qrCode').innerHTML = '<p class="error-message">Error loading QR code. Please refresh the page.</p>';
    }
}

// Refresh QR code
function refreshQR() {
    loadQR();
    document.getElementById('qrImageContainer').style.display = 'none';
}

// Show QR as image (alternative method)
function showQRImage() {
    const qrImageContainer = document.getElementById('qrImageContainer');
    const qrImage = document.getElementById('qrImage');
    
    qrImage.src = `${API_BASE}/qr-image?t=${Date.now()}`;
    qrImageContainer.style.display = 'block';
    
    qrImage.onerror = function() {
        qrImageContainer.innerHTML = '<p class="error-message">Failed to load QR image. Please try refreshing.</p>';
    };
}

// Start automatic status checking
function startStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusCheckInterval = setInterval(checkStatus, 5000); // Check every 5 seconds
}

// Send message
async function sendMessage(event) {
    event.preventDefault();
    
    const number = document.getElementById('phoneNumber').value;
    const message = document.getElementById('message').value;
    const resultDiv = document.getElementById('sendResult');
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box';
    resultDiv.innerHTML = '<div class="spinner"></div> Sending message...';
    
    try {
        const response = await fetch(`${API_BASE}/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.className = 'result-box success';
            resultDiv.textContent = '✅ Message sent successfully!';
            document.getElementById('sendForm').reset();
        } else {
            resultDiv.className = 'result-box error';
            resultDiv.textContent = '❌ Error: ' + (data.error || data.message);
        }
    } catch (error) {
        resultDiv.className = 'result-box error';
        resultDiv.textContent = '❌ Error: ' + error.message;
    }
}

// Send image
async function sendImage(event) {
    event.preventDefault();
    
    const number = document.getElementById('imagePhoneNumber').value;
    const imageFile = document.getElementById('imageFile').files[0];
    const caption = document.getElementById('imageCaption').value;
    const resultDiv = document.getElementById('imageResult');
    
    if (!imageFile) {
        alert('Please select an image');
        return;
    }
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box';
    resultDiv.innerHTML = '<div class="spinner"></div> Sending image...';
    
    const formData = new FormData();
    formData.append('number', number);
    formData.append('image', imageFile);
    formData.append('caption', caption);
    
    try {
        const response = await fetch(`${API_BASE}/send-image`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.className = 'result-box success';
            resultDiv.textContent = '✅ Image sent successfully!';
            document.getElementById('sendImageForm').reset();
        } else {
            resultDiv.className = 'result-box error';
            resultDiv.textContent = '❌ Error: ' + (data.error || data.message);
        }
    } catch (error) {
        resultDiv.className = 'result-box error';
        resultDiv.textContent = '❌ Error: ' + error.message;
    }
}

// Send bulk messages
async function sendBulk(event) {
    event.preventDefault();
    
    const numbersText = document.getElementById('bulkNumbers').value;
    const message = document.getElementById('bulkMessage').value;
    const delay = parseInt(document.getElementById('bulkDelay').value);
    const resultDiv = document.getElementById('bulkResult');
    
    const numbers = numbersText.split('\n').filter(n => n.trim());
    
    if (numbers.length === 0) {
        alert('Please enter at least one phone number');
        return;
    }
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box';
    resultDiv.innerHTML = `<div class="spinner"></div> Sending to ${numbers.length} numbers...`;
    
    try {
        const response = await fetch(`${API_BASE}/send-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numbers, message, delay })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const successful = data.data.results.filter(r => r.success).length;
            const failed = data.data.results.length - successful;
            
            resultDiv.className = 'result-box success';
            resultDiv.innerHTML = `
                ✅ Bulk send completed!<br>
                Successful: ${successful}<br>
                Failed: ${failed}
            `;
            
            // Show detailed results
            if (failed > 0) {
                const failedNumbers = data.data.results
                    .filter(r => !r.success)
                    .map(r => `${r.number}: ${r.error}`)
                    .join('<br>');
                resultDiv.innerHTML += `<br><br>Failed numbers:<br>${failedNumbers}`;
            }
        } else {
            resultDiv.className = 'result-box error';
            resultDiv.textContent = '❌ Error: ' + (data.error || data.message);
        }
    } catch (error) {
        resultDiv.className = 'result-box error';
        resultDiv.textContent = '❌ Error: ' + error.message;
    }
}

// Load contacts
async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '<div class="spinner"></div> Loading contacts...';
    
    try {
        const response = await fetch(`${API_BASE}/contacts`);
        const data = await response.json();
        
        if (data.success) {
            if (data.data.length === 0) {
                contactsList.innerHTML = '<p class="info-text">No contacts found</p>';
                return;
            }
            
            contactsList.innerHTML = data.data.map(contact => `
                <div class="contact-item">
                    <div>
                        <div class="contact-name">${contact.name}</div>
                        <div class="contact-number">${contact.number}</div>
                    </div>
                    <button class="btn btn-primary" onclick="quickSend('${contact.number}')">📤 Send</button>
                </div>
            `).join('');
        } else {
            contactsList.innerHTML = '<p class="error-message">❌ ' + (data.error || data.message) + '</p>';
        }
    } catch (error) {
        contactsList.innerHTML = '<p class="error-message">❌ Error loading contacts</p>';
    }
}

// Load groups
async function loadGroups() {
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '<div class="spinner"></div> Loading groups...';
    
    try {
        const response = await fetch(`${API_BASE}/groups`);
        const data = await response.json();
        
        if (data.success) {
            if (data.data.length === 0) {
                groupsList.innerHTML = '<p class="info-text">No groups found</p>';
                return;
            }
            
            groupsList.innerHTML = data.data.map(group => `
                <div class="group-item">
                    <div>
                        <div class="group-name">${group.name}</div>
                        <div class="group-info">👥 ${group.participants} members • ID: ${group.id}</div>
                    </div>
                    <button class="btn btn-primary" onclick="copyGroupId('${group.id}')">📋 Copy ID</button>
                </div>
            `).join('');
        } else {
            groupsList.innerHTML = '<p class="error-message">❌ ' + (data.error || data.message) + '</p>';
        }
    } catch (error) {
        groupsList.innerHTML = '<p class="error-message">❌ Error loading groups</p>';
    }
}

// Send group message
async function sendGroupMessage(event) {
    event.preventDefault();
    
    const groupId = document.getElementById('groupId').value;
    const message = document.getElementById('groupMessage').value;
    const resultDiv = document.getElementById('groupResult');
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box';
    resultDiv.innerHTML = '<div class="spinner"></div> Sending to group...';
    
    try {
        const response = await fetch(`${API_BASE}/send-group-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ groupId, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.className = 'result-box success';
            resultDiv.textContent = '✅ Group message sent successfully!';
            document.getElementById('groupForm').reset();
        } else {
            resultDiv.className = 'result-box error';
            resultDiv.textContent = '❌ Error: ' + (data.error || data.message);
        }
    } catch (error) {
        resultDiv.className = 'result-box error';
        resultDiv.textContent = '❌ Error: ' + error.message;
    }
}

// Quick send (from contacts)
function quickSend(number) {
    showTab('send');
    document.querySelector('.tab[onclick*="send"]').click();
    document.getElementById('phoneNumber').value = number;
    document.getElementById('message').focus();
}

// Copy group ID
function copyGroupId(groupId) {
    navigator.clipboard.writeText(groupId).then(() => {
        alert('✅ Group ID copied to clipboard!');
        document.getElementById('groupId').value = groupId;
    });
}

// Logout
async function logout() {
    if (!confirm('Are you sure you want to logout? You will need to scan QR code again.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Logged out successfully');
            checkStatus();
        } else {
            alert('❌ Error: ' + (data.error || data.message));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Helper functions
function showError(message) {
    alert('❌ ' + message);
}

