const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// --- Root route ---
app.get("/", (req, res) => {
  res.send("✅ CityBus AI Webhook is live! Use /ticket-prices to test.");
});

// --- Tickets Intent (GET version for browser test) ---
app.get("/ticket-prices", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/fares-and-tickets");
    const $ = cheerio.load(response.data);

    // just grab some visible text as placeholder
    const prices = $("p").first().text();

    res.json({
      reply: `Here’s the latest info on ticket prices: ${prices}`
    });
  } catch (err) {
    console.error(err);
    res.json({ reply: "Sorry, I couldn’t fetch ticket prices right now." });
  }
});

// Start server (Render will use this)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚍 Server running on port ${PORT}`));

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`)); 
