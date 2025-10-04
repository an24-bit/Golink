const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ---- Ticket Prices ----
app.post("/ticket-prices", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/fares-and-tickets");
    res.json({ reply: "✅ Ticket prices page: https://www.plymouthbus.co.uk/fares-and-tickets" });
  } catch (err) {
    console.error(err);
    res.json({ reply: "⚠️ Could not fetch ticket prices" });
  }
});

// ---- Timetables ----
app.post("/timetable", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/timetables");
    res.json({ reply: "✅ Timetables page: https://www.plymouthbus.co.uk/timetables" });
  } catch (err) {
    console.error(err);
    res.json({ reply: "⚠️ Could not fetch timetable info" });
  }
});

// ---- Live Vehicles ----
app.get("/live-vehicles", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles", {
      headers: {
        "User-Agent": "Mozilla/5.0",      // copy from your headers
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    res.json(response.data); // returns live bus JSON
  } catch (err) {
    console.error("Live vehicles fetch failed:", err.message);
    res.json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// ---- Stops ----
app.get("/stops", async (req, res) => {
  try {
    const response = await axios.get("https://plymouthbus.arcticapi.com/network/stops.geojson");
    res.json(response.data);
  } catch (err) {
    console.error("Stops fetch failed:", err.message);
    res.json({ error: "⚠️ Could not fetch bus stops" });
  }
});

// ---- Health Check ----
app.get("/", (req, res) => {
  res.send("✅ Citybus AI Webhook is running");
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚍 Server running on port ${PORT}`));
