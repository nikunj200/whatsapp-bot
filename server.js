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

        return JSON.parse(cleanResponse);
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

    let updateResult;
    switch (result.action) {
        case "addButton":
            updateResult = handleAddButton(result.parameters);
            break;
        case "updateText":
            updateResult = handleUpdateText(result.parameters);
            break;
        case "updateLogo":
            updateResult = handleUpdateLogo(result.parameters);
            break;
        case "updateBanner":
            updateResult = handleUpdateBanner(result.parameters);
            break;
        default:
            return res.json({ action: 'unknown', message: 'Could not understand instruction' });
    }

    res.json({ success: true, updatedState: webpageState });
});

// 📌 **Functions to Update Webpage State**
function handleAddButton(params) {
    const { url, text = "New Button", color = "#3498db" } = params;
    const button = { url, text, color };
    webpageState.buttons.push(button);
    console.log("Updated webpageState:", webpageState);
    return { action: 'addButton', message: `Added button: ${text} (${url}) - ${color}` };
}

// 📌 **Start the Server**
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
