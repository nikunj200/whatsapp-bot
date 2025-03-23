require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Store the latest webpage state
let webpageState = {
  buttons: [
    {
      url: '#',
      text: 'Sample Button',
      color: '#3498db'
    }
  ],
  textContent: "<p>This is a sample text box. Content can be added or modified here.</p>",
  logoUrl: "https://placehold.co/200x80?text=Your+Logo",
  bannerUrl: "https://placehold.co/800x200?text=Your+Banner"
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('Request Body:', JSON.stringify(req.body));
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve the HTML file as the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get the current webpage state
app.get('/api/state', (req, res) => {
  res.json(webpageState);
});

// Function to process user instructions using Gemini AI
async function processInstruction(instruction) {
    console.log('Processing instruction:', instruction);

    if (!instruction) {
        return { action: 'unknown', message: 'No instruction provided' };
    }

    const prompt = `
    You are an AI that translates user instructions into structured JSON commands.
    Ensure colors are converted to proper HEX codes (e.g., "redish blue" -> "#4E5ABA").
    
    **Example Inputs & Outputs:**
    
    - **User Input:** "Add a link to google.com in redish blue"
      **Output JSON:**
      {
        "action": "addButton",
        "parameters": {
          "url": "https://google.com",
          "text": "Google",
          "color": "#4E5ABA"
        }
      }
    
    - **User Input:** "Update text to 'Welcome to my site!'"
      **Output JSON:**
      {
        "action": "updateText",
        "parameters": {
          "text": "Welcome to my site!"
        }
      }
    
    **User Instruction:** "${instruction}"
    **Return JSON only, without explanation.**
    `;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const response = await model.generateContent(prompt);
        const jsonResponse = response.response.text().trim();

        console.log('Gemini AI raw response:', jsonResponse);

        // Ensure we return a valid JSON
        return JSON.parse(jsonResponse);
    } catch (error) {
        console.error('Error processing instruction with Gemini:', error);
        return { action: 'error', message: 'AI processing failed' };
    }
}

// API endpoint for direct updates
app.post('/api/update', async (req, res) => {
    const { instruction } = req.body;

    if (!instruction) {
        return res.status(400).json({ error: 'No instruction provided' });
    }

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

// WhatsApp webhook endpoint
app.post('/api/whatsapp-webhook', async (req, res) => {
    console.log('Received WhatsApp message:', req.body);
    const messageBody = req.body.Body;
    const result = await processInstruction(messageBody);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(`✅ ${result.message}`);

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

// Functions to update the webpage state
function handleAddButton(params) {
    const { url, text = "New Button", color = "#3498db" } = params;
    const button = { url, text, color };
    webpageState.buttons.push(button);
    return { action: 'addButton', message: `Added button linking to ${url} with color ${color}` };
}

function handleUpdateText(params) {
    const { text } = params;
    webpageState.textContent = `<p>${text}</p>`;
    return { action: 'updateText', message: 'Text content updated' };
}

function handleUpdateLogo(params) {
    const { url } = params;
    webpageState.logoUrl = url;
    return { action: 'updateLogo', message: 'Logo updated' };
}

function handleUpdateBanner(params) {
    const { url } = params;
    webpageState.bannerUrl = url;
    return { action: 'updateBanner', message: 'Banner updated' };
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to see your webpage`);
});
