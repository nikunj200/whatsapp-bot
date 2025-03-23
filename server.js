require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const STATE_FILE = 'state.json';

// Load webpage state from JSON file
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return {
        buttons: [],
        textContent: "<p>This is a sample text box. Content can be added or modified here.</p>",
        logoUrl: "https://placehold.co/200x80?text=Your+Logo",
        bannerUrl: "https://placehold.co/800x200?text=Your+Banner"
    };
}

// Save webpage state to JSON file
function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(webpageState, null, 2));
}

let webpageState = loadState();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get the current webpage state
app.get('/api/state', (req, res) => {
    res.json(webpageState);
});

// Add button and save state
function handleAddButton(params) {
    const { url, text = "New Button", color = "#3498db" } = params;
    const button = { url, text, color };
    webpageState.buttons.push(button);
    saveState();
    return { action: 'addButton', message: `Added button linking to ${url} with color ${color}` };
}

// Update text and save state
function handleUpdateText(params) {
    const { text } = params;
    webpageState.textContent = `<p>${text}</p>`;
    saveState();
    return { action: 'updateText', message: 'Text content updated' };
}

// Update logo and save state
function handleUpdateLogo(params) {
    const { url } = params;
    webpageState.logoUrl = url;
    saveState();
    return { action: 'updateLogo', message: 'Logo updated' };
}

// Update banner and save state
function handleUpdateBanner(params) {
    const { url } = params;
    webpageState.bannerUrl = url;
    saveState();
    return { action: 'updateBanner', message: 'Banner updated' };
}

// API endpoint for updates
app.post('/api/update', async (req, res) => {
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'No instruction provided' });

    const result = await processInstruction(instruction);

    switch (result.action) {
        case "addButton":
            return res.json(handleAddButton(result.parameters));
        case "updateText":
            return res.json(handleUpdateText(result.parameters));
        case "updateLogo":
            return res.json(handleUpdateLogo(result.parameters));
        case "updateBanner":
            return res.json(handleUpdateBanner(result.parameters));
        default:
            return res.json({ action: 'unknown', message: 'Could not understand instruction' });
    }
});

// WhatsApp Webhook for Handling AI Responses
app.post('/api/whatsapp-webhook', async (req, res) => {
    console.log('Received WhatsApp message:', req.body);
    const messageBody = req.body.Body;
    const result = await processInstruction(messageBody);

    const twiml = new twilio.twiml.MessagingResponse();

    if (!result || result.action === 'unknown') {
        twiml.message("❌ I couldn't understand that instruction. Try something like 'Add a link to instagram.com in pink'.");
    } else if (result.action === "addButton" && result.parameters) {
        twiml.message(`✅ Added button: ${result.parameters.text} (${result.parameters.url}) - ${result.parameters.color}`);
    } else {
        twiml.message("✅ Successfully processed your request.");
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

// Start the Server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🌐 Visit http://localhost:${port} to see your webpage`);
});
