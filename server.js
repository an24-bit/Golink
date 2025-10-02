const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// --- Tickets Intent ---
app.post("/ticket-prices", async (req, res) => {
  try {
    // Example: scrape fares page
    const response = await axios.get("https://www.plymouthbus.co.uk/fares-and-tickets");
    const $ = cheerio.load(response.data);

    // Just a placeholder – you'd target exact selectors later
    const prices = $("p").first().text();

    res.json({
      reply: `Here’s the latest info on ticket prices: ${prices}`
    });
  } catch (err) {
    console.error(err);
    res.json({ reply: "Sorry, I couldn’t fetch ticket prices right now." });
  }
});

// --- Timetable Intent ---
app.post("/timetable", async (req, res) => {
  const { route } = req.body; // Example: { "route": "21" }
  try {
    // Example stub: Replace with actual bus timetable fetch logic
    res.json({
      reply: `Timetable for route ${route}: (this will be fetched live from the site later).`
    });
  } catch (err) {
    res.json({ reply: "Could not fetch timetable at the moment." });
  }
});

// --- Live Tracking Intent ---
app.post("/live-tracker", async (req, res) => {
  const { route, stop } = req.body; // Example: { "route": "21", "stop": "A1" }
  try {
    // Example stub: Replace with CityBus live tracker integration
    res.json({
      reply: `Bus ${route} at stop ${stop} is arriving in 5 minutes (sample response).`
    });
  } catch (err) {
    res.json({ reply: "Could not fetch live bus info right now." });
  }
});

app.get("/", (req, res) => {
  res.send("CityBus AI Webhook is running 🚍");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
