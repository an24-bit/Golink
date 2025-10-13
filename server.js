import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// --- Environment Variables ---
const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- Nearby Stops ---
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Missing lat/lon" });

    const url = `https://transportapi.com/v3/uk/places.json?app_id=${APP_ID}&app_key=${APP_KEY}&lat=${lat}&lon=${lon}&type=bus_stop,train_station&limit=20`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Live Departures for a Stop ---
app.get("/api/departures/:atcocode", async (req, res) => {
  try {
    const code = req.params.atcocode;
    const url = `https://transportapi.com/v3/uk/bus/stop/${code}/live.json?app_id=${APP_ID}&app_key=${APP_KEY}&group=route&limit=5&nextbuses=yes`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch live departures" });
  }
});

// --- AI Assistant endpoint ---
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const prompt = `You are Transi Autopilot, a helpful UK transport assistant for Plymouth and the South West. Be concise and accurate.\nUser: ${question}\nAssistant:`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Sorry, I didn’t catch that.";
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.listen(PORT, () => console.log(`🚍 Transi Autopilot running on port ${PORT}`));
