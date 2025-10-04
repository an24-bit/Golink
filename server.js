import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// Root check
app.get("/", (req, res) => {
  res.send("🚌 Citybus AI Webhook is running with Puppeteer");
});

// Live vehicles
app.get("/live-vehicles", async (req, res) => {
  try {
    const url = "https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles";
    const response = await fetch(url, {
      headers: {
        "accept": "*/*",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0"
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching live vehicles:", err.message);
    res.status(500).json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// Stops
app.get("/stops", async (req, res) => {
  try {
    const url = "https://plymouthbus.arcticapi.com/network/stops.geojson";
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching stops:", err.message);
    res.status(500).json({ error: "⚠️ Could not fetch stops" });
  }
});

// Timetables
app.get("/timetables", async (req, res) => {
  try {
    const url = "https://www.plymouthbus.co.uk/_ajax/timetables"; 
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" }
    });
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error("❌ Error fetching timetables:", err.message);
    res.status(500).json({ error: "⚠️ Could not fetch timetables" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
