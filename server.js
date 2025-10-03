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

    // Grab the page title and first heading (guaranteed to exist)
    const pageTitle = $("title").text();
    const heading = $("h1").first().text() || "No heading found";

    res.json({
      reply: `Page: ${pageTitle} | First Heading: ${heading}`,
    });
  } catch (err) {
    console.error(err.message);
    res.json({ reply: "⚠️ Sorry, I couldn’t fetch ticket prices right now." });
  }
});

// ---- Timetable Intent ----
app.post("/timetable", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/timetables");
    const $ = cheerio.load(response.data);

    const pageTitle = $("title").text();
    const heading = $("h1").first().text() || "No heading found";

    res.json({
      reply: `Page: ${pageTitle} | First Heading: ${heading}`,
    });
  } catch (err) {
    console.error(err.message);
    res.json({ reply: "⚠️ Sorry, I couldn’t fetch timetable info right now." });
  }
});

// ---- Live Tracking Intent ----
app.post("/live-tracking", async (req, res) => {
  try {
    res.json({
      reply: "Live tracking placeholder ✅ (API not connected yet).",
    });
  } catch (err) {
    console.error(err.message);
    res.json({ reply: "⚠️ Sorry, I couldn’t fetch live tracking info right now." });
  }
});

// ---- Health Check Route ----
app.get("/", (req, res) => {
  res.send("✅ Citybus AI Webhook is running");
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
