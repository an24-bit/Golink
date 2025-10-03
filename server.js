const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ---- Tickets Intent ----
app.post("/ticket-prices", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/fares-and-tickets");
    const $ = cheerio.load(response.data);

    // Example scrape: first paragraph text (placeholder)
    const prices = $("p").first().text();

    res.json({
      reply: `Here’s the latest info on ticket prices: ${prices}`,
    });
  } catch (err) {
    console.error(err);
    res.json({ reply: "Sorry, I couldn’t fetch ticket prices right now." });
  }
});

// ---- Timetable Intent ----
app.post("/timetable", async (req, res) => {
  try {
    // Example: scrape timetables page (placeholder)
    const response = await axios.get("https://www.plymouthbus.co.uk/timetables");
    const $ = cheerio.load(response.data);

    // For demo, just grab the first heading
    const timetable = $("h1").first().text();

    res.json({
      reply: `Here’s some timetable info: ${timetable}`,
    });
  } catch (err) {
    console.error(err);
    res.json({ reply: "Sorry, I couldn’t fetch timetable info right now." });
  }
});

// ---- Live Tracking Intent ----
app.post("/live-tracking", async (req, res) => {
  try {
    // Placeholder (normally you'd hit their live tracker API)
    res.json({
      reply: "Live tracking is not yet connected, but this is where it will respond.",
    });
  } catch (err) {
    console.error(err);
    res.json({ reply: "Sorry, I couldn’t fetch live tracking info right now." });
  }
});

// ---- Health Check Route ----
app.get("/", (req, res) => {
  res.send("✅ Citybus AI Webhook is running");
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
