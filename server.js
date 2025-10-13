// ====================================
//  Transi Autopilot — Main Server
//  Version 2.2 (AI + Voice + Journeys)
//  Author: Ali
// ====================================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

// --- ENV keys ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRANSPORT_API_ID = process.env.TRANSPORT_API_ID;
const TRANSPORT_API_KEY = process.env.TRANSPORT_API_KEY;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_SID = process.env.TWILIO_SID || "";
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY || "";

// Twilio setup (for phone calls)
const VoiceResponse = twilio.twiml.VoiceResponse;

// ====================================
//   1️⃣ Nearby Stops
// ====================================
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing lat/lon" });

    const url = `https://transportapi.com/v3/uk/places.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&lat=${lat}&lon=${lon}&type=bus_stop,train_station&limit=20`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Nearby error:", err);
    res.status(500).json({ error: "Could not fetch nearby stops" });
  }
});

// ====================================
//   2️⃣ Live Departures
// ====================================
app.get("/api/departures/:atcocode", async (req, res) => {
  try {
    const code = req.params.atcocode;
    const url = `https://transportapi.com/v3/uk/bus/stop/${code}/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&group=route&limit=5&nextbuses=yes`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Departures error:", err);
    res.status(500).json({ error: "Could not load live departures" });
  }
});

// ====================================
//   3️⃣ Journey Planning
// ====================================
app.get("/api/journey", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "Missing from/to" });

    const url = `https://transportapi.com/v3/uk/public/journey/from/${encodeURIComponent(
      from
    )}/to/${encodeURIComponent(
      to
    )}.json?region=southwest&app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&modes=bus,train`;
    const r = await fetch(url);
    const data = await r.json();

    if (!data.routes || data.routes.length === 0)
      return res.json({
        answer: `No public transport routes found from ${from} to ${to}.`
      });

    const route = data.routes[0];
    const summary = route.route_parts
      .map(
        (p) =>
          `${p.mode} from ${p.from_point_name} to ${p.to_point_name} (${p.duration} mins)`
      )
      .join(" → ");

    res.json({ answer: `Recommended journey: ${summary}.` });
  } catch (err) {
    console.error("❌ Journey error:", err);
    res.status(500).json({ error: "Could not fetch journey details" });
  }
});

// ====================================
//   4️⃣ AI Assistant
// ====================================
app.get("/ask", async (req, res) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter" });

    const context = `
You are Transi Autopilot — a friendly UK public transport assistant.
You help users in Plymouth and the South West find buses, routes, fares, and travel help.
If the query is a journey (like "from X to Y"), call the /api/journey route.
Respond in concise, conversational UK English.
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

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t find that information right now.";
    res.json({ answer });
  } catch (err) {
    console.error("❌ Ask error:", err);
    res.status(500).json({ error: "AI failed to respond" });
  }
});

// ====================================
//   5️⃣ Twilio Voice Endpoint
// ====================================
// People can call your Twilio number; this will talk back using OpenAI’s response.
app.post("/voice", async (req, res) => {
  const twiml = new VoiceResponse();
  const userSpeech = req.body.SpeechResult || "";

  if (!userSpeech) {
    twiml.say(
      { voice: "Polly.Amy", language: "en-GB" },
      "Hi there, this is Transi Autopilot. Please ask about a bus, route, or destination after the beep."
    );
    twiml.gather({ input: "speech", action: "/voice", method: "POST" });
  } else {
    // Get AI answer
    const aiRes = await fetch(
      `https://api.openai.com/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: userSpeech }],
          max_tokens: 200
        })
      }
    );

    const data = await aiRes.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t find that information right now.";

    twiml.say(
      { voice: "Polly.Amy", language: "en-GB" },
      answer
    );
    twiml.pause({ length: 1 });
    twiml.say(
      { voice: "Polly.Amy", language: "en-GB" },
      "You can ask another question after the beep."
    );
    twiml.gather({ input: "speech", action: "/voice", method: "POST" });
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// ====================================
//   6️⃣ Health Check + SPA
// ====================================
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Transi Autopilot", version: "2.2" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚍 Transi Autopilot v2.2 running on port ${PORT}`);
});
