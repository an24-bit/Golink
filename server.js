import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// root check
app.get("/", (req, res) => {
  res.send("🚌 Citybus AI Webhook is running");
});

// fetch live vehicle positions
app.get("/live-vehicles", async (req, res) => {
  try {
    const response = await fetch("https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles", {
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vehicles: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Live vehicles fetch error:", err);
    res.status(500).json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// fetch stops data
app.get("/stops", async (req, res) => {
  try {
    const response = await fetch("https://plymouthbus.arcticapi.com/network/stops.geojson", {
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stops: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Stops fetch error:", err);
    res.status(500).json({ error: "⚠️ Could not fetch stops info" });
  }
});

// start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
