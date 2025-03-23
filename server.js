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
  buttons: [],
  textContent: "<p>This is a sample text box. Content can be added or modified here.</p>",
  logoUrl: "https://placehold.co/200x80?text=Your+Logo",
  bannerUrl: "https://placehold.co/800x200?text=Your+Banner"
};

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

// 🧠 **Process user instructions using Gemini AI**
async function processInstruction(instruction) {
    console.log('Processing instruction:', instruction);

    if (!instruction) {
        return { action: 'unknown', message: 'No instruction provided' };
    }

    const prompt = `
    You are an AI that translates user instructions into structured JSON commands.
    Ensure colors are converted to HEX codes (e.g., "redish blue" -> "#4E5ABA").
    
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const response = await model.generateContentStream({ contents: [{ parts: [{ text: prompt }] }] });

        let fullResponse = "";
        for await (const chunk of response.stream) {
            fullResponse += chunk.text();
        }

        // ✅ **Fix: Remove backticks & clean AI response**
        const cleanResponse = fullResponse.replace(/```json|```/g, "").trim();
        console.log("Cleaned AI response:", cleanResponse);

        // ✅ **Fix: Parse JSON correctly & ensure a valid response**
        const parsedResponse = JSON.parse(cleanResponse);
        if (!parsedResponse.message) {
            if (parsedResponse.action === "addButton") {
                parsedResponse.message = `Added button: ${parsedResponse.parameters.text} (${parsedResponse.parameters.url}) - ${parsedResponse.parameters.color}`;
            } else if (parsedResponse.action === "addButtons" && parsedResponse.parameters?.buttons?.length > 0) {
                parsedResponse.message = parsedResponse.parameters.buttons.map(
                    btn => `🔹 ${btn.text} (${btn.url}) - ${btn.color}`
                ).join("\n");
            } else {
                parsedResponse.message = "✅ Successfully processed your request.";
            }
        }

        return parsedResponse;
    } catch (error) {
        console.error("Error processing instruction with Gemini:", error);
        return { action: "error", message: "AI processing failed." };
    }
}

// 📌 **API endpoint for direct updates**
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

// 📌 **WhatsApp Webhook for Handling AI Responses**
app.post('/api/whatsapp-webhook', async (req, res) => {
    console.log('Received WhatsApp message:', req.body);
    const messageBody = req.body.Body;
    const result = await processInstruction(messageBody);

    const twiml = new twilio.twiml.MessagingResponse();

    if (!result || result.action === 'unknown') {
        twiml.message("❌ I couldn't understand that instruction. Try something like 'Add a link to instagram.com in pink'.");
    } else if (result.action === "addButton" && result.parameters) {
        twiml.message(`✅ Added button: ${result.parameters.text} (${result.parameters.url}) - ${result.parameters.color}`);
    } else if (result.action === "addButtons" && result.parameters?.buttons?.length > 0) {
        let buttonList = result.parameters.buttons.map(btn => `🔹 ${btn.text} (${btn.url}) - ${btn.color}`).join("\n");
        twiml.message(`✅ Added the following buttons:\n${buttonList}`);
    } else {
        twiml.message("✅ Successfully processed your request.");
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

// 📌 **Functions to Update Webpage State**
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

// 📌 **Start the Server**
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 Visit http://localhost:${port} to see your webpage`);
});
