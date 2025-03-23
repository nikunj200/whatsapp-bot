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
  // Get the message body from WhatsApp
  const messageBody = req.body.Body;
  
  // Process the instruction
  const result = processInstruction(messageBody);
  
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
function processInstruction(instruction) {
  if (!instruction) {
    return {
      action: 'unknown',
      message: 'No instruction provided'
    };
  }

  instruction = instruction.toLowerCase();
  
  // Add a link
  if (instruction.includes('add a link') || instruction.includes('add link')) {
    const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
    const url = urlMatch ? urlMatch[0] : '#';
    
    // Extract color if specified
    const colorMatch = instruction.match(/\b(red|blue|green|yellow|purple|black|orange|pink)\b/);
    const color = getColorCode(colorMatch ? colorMatch[0] : 'blue');
    
    // Extract button text if specified
    let buttonText = 'Link';
    if (instruction.includes('text') && instruction.includes('"')) {
      const textMatch = instruction.match(/"([^"]*)"/);
      if (textMatch) buttonText = textMatch[1];
    }
    
    // Add the button to our state
    const newButton = {
      url: url.startsWith('www') ? 'https://' + url : url,
      color: color,
      text: buttonText
    };
    
    webpageState.buttons.push(newButton);
    
    return {
      action: 'addButton',
      button: newButton,
      message: `Added a ${colorMatch ? colorMatch[0] : 'blue'} button linking to ${url}`
    };
  }
  
  // Update text content
  if (instruction.includes('update text') || instruction.includes('change text')) {
    let newText = instruction;
    
    if (instruction.includes('to "')) {
      const textMatch = instruction.match(/to "([^"]*)"/);
      if (textMatch) newText = textMatch[1];
    } else if (instruction.includes('with "')) {
      const textMatch = instruction.match(/with "([^"]*)"/);
      if (textMatch) newText = textMatch[1];
    }
    
    webpageState.textContent = `<p>${newText}</p>`;
    
    return {
      action: 'updateText',
      text: newText,
      message: 'Text content updated'
    };
  }
  
  // Change logo
  if (instruction.includes('change logo') || instruction.includes('update logo')) {
    const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
    const logoUrl = urlMatch ? urlMatch[0] : webpageState.logoUrl;
    
    webpageState.logoUrl = logoUrl;
    
    return {
      action: 'updateLogo',
      url: logoUrl,
      message: 'Logo updated'
    };
  }
  
  // Change banner
  if (instruction.includes('change banner') || instruction.includes('update banner')) {
    const urlMatch = instruction.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|[^\s]+\.(com|org|net|edu)[^\s]*)\b/);
    const bannerUrl = urlMatch ? urlMatch[0] : webpageState.bannerUrl;
    
    webpageState.bannerUrl = bannerUrl;
    
    return {
      action: 'updateBanner',
      url: bannerUrl,
      message: 'Banner updated'
    };
  }
  
  return {
    action: 'unknown',
    message: 'Could not understand instruction'
  };
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
});