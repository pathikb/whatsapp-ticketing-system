const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// WhatsApp Cloud API configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Function to escape XML special characters
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '<';
      case '>': return '>';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '"';
    }
  });
}

// Generate virtual pass image
async function generatePassImage(passDetails, returnBuffer = false) {
  const { userName, eventName, eventDate, passCategory } = passDetails;
  
  // Escape all text content
  const safeEventName = escapeXml(eventName);
  const safePassCategory = escapeXml(passCategory);
  const safeUserName = escapeXml(userName);
  const safeEventDate = escapeXml(eventDate);
  
  const width = 800;
  const headerHeight = 100;
  const qrSize = 200;
  const padding = 40;
  const iconSize = 24;
  const contentStart = headerHeight + padding;
  const leftColumnWidth = width - qrSize - (3 * padding);
  const height = headerHeight + (4 * padding) + 150; // Adjusted height
  
  // Generate QR code
  const qrCode = await QRCode.toBuffer(`EVENT:${eventName}|USER:${userName}|DATE:${eventDate}`);

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Gradient Header -->
      <defs>
        <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#7C3AED;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#9333EA;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Header -->
      <rect width="${width}" height="${headerHeight}" fill="url(#headerGradient)" />
      <text x="${padding}" y="${headerHeight - 30}" font-family="Arial" font-size="32" fill="white" font-weight="bold">${safeEventName}</text>
      <text x="${padding}" y="${headerHeight - 5}" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.9)">${safePassCategory} Pass</text>

      <!-- Body -->
      <rect x="0" y="${headerHeight}" width="${width}" height="${height - headerHeight}" fill="#ffffff" />

      <!-- Event Details -->
      <g transform="translate(${padding}, ${contentStart})">
        <!-- Calendar Icon -->
        <rect x="0" y="0" width="${iconSize}" height="${iconSize}" rx="4" fill="#6B7280"/>
        <text x="${iconSize + 15}" y="18" font-family="Arial" font-size="16" fill="#6B7280">Date &amp; Time</text>
        <text x="${iconSize + 15}" y="45" font-family="Arial" font-size="20" fill="#111827">${safeEventDate}</text>

        <!-- User Icon -->
        <circle cx="12" cy="${padding + 50}" r="12" fill="#6B7280"/>
        <text x="${iconSize + 15}" y="${padding + 60}" font-family="Arial" font-size="16" fill="#6B7280">Attendee</text>
        <text x="${iconSize + 15}" y="${padding + 87}" font-family="Arial" font-size="20" fill="#111827">${safeUserName}</text>

        <!-- Category Icon -->
        <rect x="0" y="${2 * padding + 70}" width="${iconSize}" height="${iconSize}" rx="4" fill="#6B7280"/>
        <text x="${iconSize + 15}" y="${2 * padding + 90}" font-family="Arial" font-size="16" fill="#6B7280">Pass Category</text>
        <text x="${iconSize + 15}" y="${2 * padding + 117}" font-family="Arial" font-size="20" fill="#111827">${safePassCategory}</text>
      </g>

      <!-- Vertical Dashed Line -->
      <line x1="${leftColumnWidth + padding}" y1="${contentStart}" 
            x2="${leftColumnWidth + padding}" y2="${height - padding}" 
            stroke="#E5E7EB" stroke-width="2" stroke-dasharray="8,8"/>

      <!-- QR Code Section -->
      <g transform="translate(${width - qrSize - padding}, ${contentStart})">
        <image href="data:image/png;base64,${qrCode.toString('base64')}" 
               width="${qrSize}" height="${qrSize}" />
        <text x="${qrSize/2}" y="${qrSize + 30}" 
              font-family="Arial" font-size="16" fill="#6B7280" text-anchor="middle">
          Ticket #${uuidv4().split('-')[0].toUpperCase()}
        </text>
      </g>
    </svg>`;

  if (returnBuffer) {
    return sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  const imagePath = path.join(tempDir, `${uuidv4()}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(imagePath);
    
  return imagePath;
}

// Get pass image for testing
async function getPassImage(passDetails) {
  try {
    const imageBuffer = await generatePassImage(passDetails, true);
    return imageBuffer;
  } catch (error) {
    throw error;
  }
}

// Send message via WhatsApp
async function sendWhatsAppMessage(phoneNumber, message, mediaUrl = null) {
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: 'pass_notification',
      language: {
        code: 'en'
      }
    }
  };
  
  if (mediaUrl) {
    payload.type = 'image';
    payload.image = {
      link: mediaUrl
    };
  }
  
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// Send pass to single user
async function sendPassToUser(user, event, pass) {
  const passDetails = {
    userName: user.name,
    eventName: event.name,
    eventDate: event.date.toDateString(),
    passCategory: pass.category
  };
  
  // Generate pass image
  const imagePath = await generatePassImage(passDetails);
  
  try {
    // Upload image to your CDN or storage service
    const imageUrl = await uploadImageToCDN(imagePath);
    
    // Send WhatsApp message
    await sendWhatsAppMessage(user.phone, '', imageUrl);
    
    // Clean up temporary file
    fs.unlinkSync(imagePath);
    
    return { success: true };
  } catch (error) {
    // Clean up temporary file in case of error
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    throw error;
  }
}

// Batch send passes to event users
async function sendPassesToEventUsers(event, users, passes) {
  const results = [];
  
  for (const user of users) {
    const pass = passes.find(p => p.userId === user.id);
    if (!pass) continue;
    
    try {
      const result = await sendPassToUser(user, event, pass);
      results.push({ userId: user.id, success: true });
      
      // Add random delay between 1-4 seconds
      const delay = Math.floor(Math.random() * 3000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      results.push({ userId: user.id, success: false, error: error.message });
    }
  }
  
  return results;
}

module.exports = {
  sendPassToUser,
  sendPassesToEventUsers,
  getPassImage
};