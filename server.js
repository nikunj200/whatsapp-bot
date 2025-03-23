require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const twilio = require("twilio");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const whatsappNumber = "whatsapp:+YOUR_TWILIO_NUMBER";

// Webhook for WhatsApp messages
app.post("/webhook", (req, res) => {
    const message = req.body.Body.toLowerCase();
    const sender = req.body.From;

    if (message.includes("add link")) {
        const link = "https://google.com";
        const color = "red";

        io.emit("update", { action: "add_button", text: "Google", link, color });

        twilioClient.messages.create({
            from: whatsappNumber,
            to: sender,
            body: "✅ A red Google link has been added to your webpage!",
        });
    } else if (message.includes("change text")) {
        const newText = "Updated Banner Text";

        io.emit("update", { action: "update_text", newText });

        twilioClient.messages.create({
            from: whatsappNumber,
            to: sender,
            body: "✅ Banner text updated!",
        });
    } else {
        twilioClient.messages.create({
            from: whatsappNumber,
            to: sender,
            body: "❌ I didn't understand. Try 'Add link' or 'Change text'",
        });
    }

    res.sendStatus(200);
});

// Start server
server.listen(5000, () => console.log("Server running on port 5000"));
