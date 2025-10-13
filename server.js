// ================================
//  Transi Autopilot — Main Server
//  Version 2.1
//  Author: Ali
// ================================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// --- Environment Setup ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

// --- API Keys from .env / Render ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRANSPORT_API_ID = process.env.TRANSPORT_API_ID;
const TRANSPORT_API_KEY = process.env.TRANSPORT_API_KEY;
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY || "";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_CX_ID = process.env.GOOGLE_CX_ID || "";
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY || "";

// ================================
//   ROUTES
// ================================

// --- 1️⃣ Nearby Stops ---
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing latitude or longitude" });

    const url = `https://transportapi.com/v3/uk/places.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&lat=${lat}&lon=${lon}&type=bus_stop,train_station&limit=20`;

    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ /api/nearby error:", err);
    res.status(500).json({ error: "Server error loading nearby stops" });
  }
});

// --- 2️⃣ Live Departures ---
app.get("/api/departures/:atcocode", async (req, res) => {
  try {
    const code = req.params.atcocode;
    const url = `https://transportapi.com/v3/uk/bus/stop/${code}/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&group=route&limit=5&nextbuses=yes`;

    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ /api/departures error:", err);
    res.status(500).json({ error: "Could not fetch live departures" });
  }
});

// --- 3️⃣ AI Assistant (Main Ask Endpoint) ---
app.get("/ask", async (req, res) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

    const context = `
You are Transi Autopilot — an intelligent UK travel assistant for Plymouth & the South West.
Provide clear, short, accurate travel help using UK English.
Include useful hints about buses, trains, routes, or general area info.
If location (${lat}, ${lon}) is given, reference local context briefly if possible.
`;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: context },
        { role: "user", content: q }
      ],
      max_tokens: 250,
      temperature: 0.6
    };

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await aiResponse.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t find that information right now.";

    res.json({ answer });
  } catch (err) {
    console.error("❌ /ask error:", err);
    res.status(500).json({ error: "AI response failed" });
  }
});

// --- 4️⃣ Health Check ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Transi Autopilot", version: "2.1" });
});

// --- 5️⃣ Catch-all (Frontend SPA support) ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================================
//   START SERVER
// ================================
app.listen(PORT, () =>
  console.log(`🚍 Transi Autopilot running on port ${PORT}`)
);
