import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

// Utility: Launch Puppeteer safely on Render
async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote"
    ]
  });
}

// Root route
app.get("/", (req, res) => {
  res.send("🚍 Citybus AI Webhook is running with Puppeteer");
});

// Fetch live vehicles
app.get("/live-vehicles", async (req, res) => {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://www.plymouthbus.co.uk", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Intercept API requests for vehicles
    const vehiclesData = await page.evaluate(async () => {
      const resp = await fetch("/_ajax/hirevehicles/vehicles");
      return resp.json();
    });

    await browser.close();
    res.json(vehiclesData);
  } catch (err) {
    console.error("❌ Error fetching vehicles:", err);
    res.status(500).json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// Fetch stops
app.get("/stops", async (req, res) => {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://www.plymouthbus.co.uk", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    const stopsData = await page.evaluate(async () => {
      const resp = await fetch("/_ajax/stops/118000021/vehicles"); 
      return resp.json();
    });

    await browser.close();
    res.json(stopsData);
  } catch (err) {
    console.error("❌ Error fetching stops:", err);
    res.status(500).json({ error: "⚠️ Could not fetch stops" });
  }
});

// Fetch timetables
app.get("/timetables", async (req, res) => {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://www.plymouthbus.co.uk", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    const timetableData = await page.evaluate(async () => {
      const resp = await fetch("/_ajax/stops/118000021/vehicles"); 
      return resp.json();
    });

    await browser.close();
    res.json(timetableData);
  } catch (err) {
    console.error("❌ Error fetching timetables:", err);
    res.status(500).json({ error: "⚠️ Could not fetch timetables" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚍 Server running on port ${PORT}`);
});
