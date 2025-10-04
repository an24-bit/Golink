import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 10000;

// Root endpoint
app.get("/", (req, res) => {
  res.send("🚌 Citybus AI Webhook is running with Puppeteer");
});

// Get live vehicles
app.get("/live-vehicles", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: "new", // latest headless mode
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Go directly to the vehicles API endpoint
    await page.setExtraHTTPHeaders({
      "x-requested-with": "XMLHttpRequest"
    });

    await page.goto("https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles", {
      waitUntil: "networkidle2"
    });

    // Get page content (which should be JSON)
    const content = await page.evaluate(() => document.body.innerText);

    await browser.close();

    try {
      res.json(JSON.parse(content));
    } catch (e) {
      res.send(content);
    }
  } catch (err) {
    console.error("❌ Puppeteer error:", err.message);
    res.status(500).json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// Get stops
app.get("/stops", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "x-requested-with": "XMLHttpRequest"
    });

    await page.goto("https://plymouthbus.arcticapi.com/network/stops.geojson", {
      waitUntil: "networkidle2"
    });

    const content = await page.evaluate(() => document.body.innerText);

    await browser.close();

    try {
      res.json(JSON.parse(content));
    } catch (e) {
      res.send(content);
    }
  } catch (err) {
    console.error("❌ Puppeteer error:", err.message);
    res.status(500).json({ error: "⚠️ Could not fetch stops" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
