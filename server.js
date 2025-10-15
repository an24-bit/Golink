// =====================================
//  GoLink — Main Server
//  Version 3.3 (AI + Voice + Live Tracking + Journeys)
//  Author: Ali
// =====================================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import * as gtfs from "gtfs-realtime-bindings"; // for BODS live data

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
const BODS_API_KEY = process.env.BODS_API_KEY || "";

const VoiceResponse = twilio.twiml.VoiceResponse;

// =====================================
//   1️⃣ Nearby Stops
// =====================================
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Missing lat/lon" });

    const url = `https://transportapi.com/v3/uk/places.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&lat=${lat}&lon=${lon}&type=bus_stop,train_station&limit=20`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Nearby error:", err);
    res.status(500).json({ error: "Could not fetch nearby stops" });
  }
});

// =====================================
//   2️⃣ Live Departures
// =====================================
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

// =====================================
//   3️⃣ Journey Planning
// =====================================
app.get("/api/journey", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "Missing from/to" });

    const url = `https://transportapi.com/v3/uk/public/journey/from/${encodeURIComponent(
      from
    )}/to/${encodeURIComponent(
      to
    )}.json?region=southwest&app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&modes=bus,train`;

    const r = await fetch(url);
    const data = await r.json();

    if (!data.routes || data.routes.length === 0)
      return res.json({
        answer: `No public transport routes found from ${from} to ${to}.`,
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

// =====================================
//   4️⃣ Live Buses (TransportAPI fallback)
// =====================================
app.get("/api/livebuses", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing lat/lon" });

    const stopsUrl = `https://transportapi.com/v3/uk/bus/stops/near.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&lat=${lat}&lon=${lon}&group=route&limit=10`;
    const stopsRes = await fetch(stopsUrl);
    const stopsData = await stopsRes.json();

    if (!stopsData.stops || stopsData.stops.length === 0) {
      return res.json({ count: 0, buses: [] });
    }

    const buses = [];
    for (const stop of stopsData.stops.slice(0, 5)) {
      const depUrl = `https://transportapi.com/v3/uk/bus/stop/${stop.atcocode}/live.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&group=route&limit=3&nextbuses=yes`;
      const depRes = await fetch(depUrl);
      const depData = await depRes.json();
      if (depData.departures) {
        for (const route in depData.departures) {
          depData.departures[route].forEach((bus) => {
            buses.push({
              stop: stop.name,
              line: bus.line_name,
              direction: bus.direction,
              expected: bus.expected_departure_time,
              lat: stop.latitude,
              lon: stop.longitude,
            });
          });
        }
      }
    }

    res.json({ count: buses.length, buses });
  } catch (err) {
    console.error("❌ Live buses error:", err);
    res.status(500).json({ error: err.message });
  }
});
// =====================================
//   5️⃣ AI Assistant
// =====================================
app.get("/ask", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter" });

    const context = `
You are GoLink — a smart UK travel assistant that helps users in Plymouth and the South West find buses, routes, fares, and live transport updates.
You can use /api/livebuses for tracking and /api/journey for planning routes.
Always answer clearly and naturally.
`;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: context },
        { role: "user", content: q },
      ],
      max_tokens: 250,
      temperature: 0.6,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
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

// =====================================
//   6️⃣ Twilio Voice Endpoint
// =====================================
app.post("/voice", async (req, res) => {
  const twiml = new VoiceResponse();
  const userSpeech = req.body.SpeechResult || "";

  if (!userSpeech) {
    twiml.say(
      { voice: "Polly.Amy", language: "en-GB" },
      "Hi there, this is GoLink. Please ask about a bus, train, or destination after the beep."
    );
    twiml.gather({ input: "speech", action: "/voice", method: "POST" });
  } else {
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: userSpeech }],
          max_tokens: 200,
        }),
      });

      const data = await aiRes.json();
      const answer =
        data?.choices?.[0]?.message?.content ||
        "Sorry, I couldn’t find that information right now.";

      twiml.say({ voice: "Polly.Amy", language: "en-GB" }, answer);
      twiml.pause({ length: 1 });
      twiml.say(
        { voice: "Polly.Amy", language: "en-GB" },
        "You can ask another question after the beep."
      );
      twiml.gather({ input: "speech", action: "/voice", method: "POST" });
    } catch (err) {
      console.error("❌ Voice error:", err);
      twiml.say(
        { voice: "Polly.Amy", language: "en-GB" },
        "Sorry, my connection failed. Please try again later."
      );
    }
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// =====================================
//   7️⃣ Health + Static
// =====================================
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "GoLink", version: "3.3" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🛰️  GoLink v3.3 is live on port ${PORT}`);
});
