require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

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
  console.log('Sending current state:', JSON.stringify(webpageState));
  res.json(webpageState);
});

// Endpoint for direct updates (for testing)
app.get('/api/test-update', (req, res) => {
  const { command } = req.query;
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }
  
  const result = processInstruction(command);
  return res.json({ success: true, result });
});

// Endpoint for WhatsApp bot to send instructions
app.post('/api/update', (req, res) => {
  const { instruction } = req.body;
  
  if (!instruction) {
    return res.status(400).json({ error: 'No instruction provided' });
  }
  
  // Process the instruction
  const result = processInstruction(instruction);
  
  res.json({ 
    success: true, 
    message: 'Instruction processed', 
    result 
  });
});

// WhatsApp webhook endpoint
app.post('/api/whatsapp-webhook', (req, res) => {
  console.log('WhatsApp webhook received:', JSON.stringify(req.body));
  
  // Get the message body from WhatsApp
  const messageBody = req.body.Body;
  
  console.log('Processing WhatsApp message:', messageBody);
  
  // Process the instruction
  const result = processInstruction(messageBody);
  
  console.log('Processing result:', JSON.stringify(result));
  
  // Create a response to send back to WhatsApp
  const twiml = new twilio.twiml.MessagingResponse();
  
  if (result.action === 'unknown') {
    twiml.message('I couldn\'t understand that instruction. Try something like "Add a link to google.com in red color" or "Update text to "Welcome to my website""');
  } else {
    twiml.message(`✅ ${result.message}`);
  }
  
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

// Function to process instructions from WhatsApp
// function processInstruction(instruction) {
//   console.log('Processing instruction:', instruction);
  
//   if (!instruction) {
//     return {
//       action: 'unknown',
//       message: 'No instruction provided'
//     };
//   }

//   instruction = instruction.toLowerCase();
  
//   // Add a link
//   if (instruction.includes('add a link') || instruction.includes('add link')) {
//     const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
//     const url = urlMatch ? urlMatch[0] : '#';
    
//     // Extract color if specified
//     const colorMatch = instruction.match(/\b(red|blue|green|yellow|purple|black|orange|pink)\b/);
//     const color = getColorCode(colorMatch ? colorMatch[0] : 'blue');
    
//     // Extract button text if specified
//     let buttonText = 'Link';
//     if (instruction.includes('text') && instruction.includes('"')) {
//       const textMatch = instruction.match(/"([^"]*)"/);
//       if (textMatch) buttonText = textMatch[1];
//     }
    
//     // Add the button to our state
//     const newButton = {
//       url: url.startsWith('www') ? 'https://' + url : url,
//       color: color,
//       text: buttonText
//     };
    
//     webpageState.buttons.push(newButton);
//     console.log('Added new button:', JSON.stringify(newButton));
//     console.log('Updated state:', JSON.stringify(webpageState));
    
//     return {
//       action: 'addButton',
//       button: newButton,
//       message: `Added a ${colorMatch ? colorMatch[0] : 'blue'} button linking to ${url}`
//     };
//   }
  
//   // Update text content
//   if (instruction.includes('update text') || instruction.includes('change text')) {
//     let newText = instruction;
    
//     if (instruction.includes('to "')) {
//       const textMatch = instruction.match(/to "([^"]*)"/);
//       if (textMatch) newText = textMatch[1];
//     } else if (instruction.includes('with "')) {
//       const textMatch = instruction.match(/with "([^"]*)"/);
//       if (textMatch) newText = textMatch[1];
//     }
    
//     webpageState.textContent = `<p>${newText}</p>`;
//     console.log('Updated text content to:', newText);
    
//     return {
//       action: 'updateText',
//       text: newText,
//       message: 'Text content updated'
//     };
//   }
  
//   // Change logo
//   if (instruction.includes('change logo') || instruction.includes('update logo')) {
//     const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
//     const logoUrl = urlMatch ? urlMatch[0] : webpageState.logoUrl;
    
//     webpageState.logoUrl = logoUrl;
//     console.log('Updated logo URL to:', logoUrl);
    
//     return {
//       action: 'updateLogo',
//       url: logoUrl,
//       message: 'Logo updated'
//     };
//   }
  
//   // Change banner
//   if (instruction.includes('change banner') || instruction.includes('update banner')) {
//     const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
//     const bannerUrl = urlMatch ? urlMatch[0] : webpageState.bannerUrl;
    
//     webpageState.bannerUrl = bannerUrl;
//     console.log('Updated banner URL to:', bannerUrl);
    
//     return {
//       action: 'updateBanner',
//       url: bannerUrl,
//       message: 'Banner updated'
//     };
//   }
  
//   console.log('Could not understand instruction');
//   return {
//     action: 'unknown',
//     message: 'Could not understand instruction'
//   };
// }

async function processInstruction(instruction) {
    console.log('Processing instruction:', instruction);

    if (!instruction) {
        return { action: 'unknown', message: 'No instruction provided' };
    }

    // Define a structured prompt for Gemini AI
    const prompt = `
    You are an intelligent assistant that translates user instructions into structured JSON commands.
    Given an instruction, return a JSON response specifying the action and necessary parameters.
    
    Example Inputs & Outputs:
    
    - **User Input:** "Add a link to google.com in red color"
      **Output JSON:**
      {
        "action": "addButton",
        "parameters": {
          "url": "https://google.com",
          "text": "Google",
          "color": "red"
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
    
    - **User Input:** "Change logo to https://example.com/logo.png"
      **Output JSON:**
      {
        "action": "updateLogo",
        "parameters": {
          "url": "https://example.com/logo.png"
        }
      }
    
    - **User Input:** "Change banner to https://example.com/banner.jpg"
      **Output JSON:**
      {
        "action": "updateBanner",
        "parameters": {
          "url": "https://example.com/banner.jpg"
        }
      }
    
    ---
    User Instruction: "${instruction}"
    Return JSON only, no explanation.
    `;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const response = await model.generateContent(prompt);
        const jsonResponse = response.response.text(); // Get raw response

        console.log('Gemini AI raw response:', jsonResponse);

        // Parse the JSON response
        const parsedResponse = JSON.parse(jsonResponse);
        return parsedResponse;
    } catch (error) {
        console.error('Error processing instruction with Gemini:', error);
        return { action: 'error', message: 'AI processing failed' };
    }
}

function handleAddLink(responseText) {
    const urlMatch = responseText.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : '#';

    const colorMatch = responseText.match(/\b(red|blue|green|yellow|purple|black|orange|pink)\b/);
    const color = getColorCode(colorMatch ? colorMatch[0] : 'blue');

    let buttonText = 'Link';
    const textMatch = responseText.match(/"([^"]*)"/);
    if (textMatch) buttonText = textMatch[1];

    const newButton = { url, color, text: buttonText };
    webpageState.buttons.push(newButton);

    return { action: 'addButton', message: `Added a ${color} button linking to ${url}` };
}

function handleUpdateText(responseText) {
    const textMatch = responseText.match(/"([^"]*)"/);
    const newText = textMatch ? textMatch[1] : 'Updated content';

    webpageState.textContent = `<p>${newText}</p>`;
    return { action: 'updateText', message: 'Text content updated' };
}

function handleUpdateLogo(responseText) {
    const urlMatch = responseText.match(/https?:\/\/[^\s]+/);
    const logoUrl = urlMatch ? urlMatch[0] : webpageState.logoUrl;

    webpageState.logoUrl = logoUrl;
    return { action: 'updateLogo', message: 'Logo updated' };
}

function handleUpdateBanner(responseText) {
    const urlMatch = responseText.match(/https?:\/\/[^\s]+/);
    const bannerUrl = urlMatch ? urlMatch[0] : webpageState.bannerUrl;

    webpageState.bannerUrl = bannerUrl;
    return { action: 'updateBanner', message: 'Banner updated' };
}


// Helper function to convert color names to hex codes
function getColorCode(colorName) {
  const colorMap = {
    'red': '#e74c3c',
    'blue': '#3498db',
    'green': '#2ecc71',
    'yellow': '#f1c40f',
    'purple': '#9b59b6',
    'black': '#000000',
    'orange': '#e67e22',
    'pink': '#e84393'
  };
  
  return colorMap[colorName] || '#3498db';
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to see your webpage`);
  console.log(`Use WhatsApp to send commands to your Twilio number`);
  console.log(`For testing, visit http://localhost:${port}/api/test-update?command=add%20a%20link%20to%20google.com%20in%20red%20color`);
});
