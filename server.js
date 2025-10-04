const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ============================
// LIVE VEHICLES (Real-time buses)
// ============================
app.get("/live-vehicles", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles");
    res.json(response.data);
  } catch (err) {
    console.error("Live vehicles error:", err.message);
    res.json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// ============================
// BUS STOPS (GeoJSON data)
// ============================
app.get("/stops", async (req, res) => {
  try {
    const response = await axios.get("https://plymouthbus.arcticapi.com/network/stops.geojson");
    res.json(response.data);
  } catch (err) {
    console.error("Stops error:", err.message);
    res.json({ error: "⚠️ Could not fetch bus stops" });
  }
});

// ============================
// TICKET PRICES (scrape fares page)
// ============================
app.get("/ticket-prices", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/fares-and-tickets");
    const $ = cheerio.load(response.data);

    const fares = $(".content-page p, .content-page li")
      .map((i, el) => $(el).text().trim())
      .get()
      .filter(txt => txt.length > 0)
      .join("\n");

    res.json({
      reply: fares || "⚠️ No fare info found.",
    });
  } catch (err) {
    console.error("Ticket prices error:", err.message);
    res.json({ error: "⚠️ Could not fetch ticket prices" });
  }
});

// ============================
// TIMETABLES (scrape timetable page)
// ============================
app.get("/timetables", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/timetables");
    const $ = cheerio.load(response.data);

    const timetables = $(".content-page h2, .content-page h3")
      .map((i, el) => $(el).text().trim())
      .get()
      .filter(txt => txt.length > 0)
      .join("\n");

    res.json({
      reply: timetables || "⚠️ No timetable info found.",
    });
  } catch (err) {
    console.error("Timetables error:", err.message);
    res.json({ error: "⚠️ Could not fetch timetables" });
  }
});

// ============================
// Health Check
// ============================
app.get("/", (req, res) => {
  res.send("✅ Citybus AI Webhook is running with LIVE APIs for vehicles, stops, tickets, and timetables");
});

// ============================
// Start Server
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
