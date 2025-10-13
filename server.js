// =====================================
//  Transi Autopilot — Main Server
//  Version 3.1 (AI + Voice + Live Tracking + Journeys)
//  Author: Ali
// =====================================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import GtfsRealtimeBindings from "gtfs-realtime-bindings"; // fixed import

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
const {
  OPENAI_API_KEY,
  TRANSPORT_API_ID,
  TRANSPORT_API_KEY,
  TWILIO_AUTH_TOKEN = "",
  TWILIO_SID = "",
  OPENWEATHER_KEY = "",
  BODS_API_KEY = ""
} = process.env;

const VoiceResponse = twilio.twiml.VoiceResponse;

// =====================================
//  1️⃣ Nearby Stops
// =====================================
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing lat/lon" });

    const url = `https://transportapi.com/v3/uk/places.json?app_id=${TRANSPORT_API_ID}&app_key=${TRANSPORT_API_KEY}&lat=${lat}&lon=${lon}&type=bus_stop&limit=15`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Nearby error:", err);
    res.status(500).json({ error: "Could not fetch nearby stops" });
  }
});

// =====================================
//  2️⃣ Live Departures
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
//  3️⃣ Journey Planning
// =====================================
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

    if (!data.routes?.length)
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

// =====================================
//  4️⃣ Real Live Buses (BODS feed)
// =====================================
app.get("/api/livebuses", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing lat/lon" });

    const feedUrl = `https://data.bus-data.dft.gov.uk/api/v1/datafeed/?api_key=${BODS_API_KEY}`;
    const bodsRes = await fetch(feedUrl);

    if (!bodsRes.ok)
      throw new Error(`BODS fetch failed: ${bodsRes.status}`);

    const buffer = Buffer.from(await bodsRes.arrayBuffer());
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      buffer
    );

    const buses = [];
    feed.entity.forEach((entity) => {
      if (entity.vehicle?.position) {
        const busLat = entity.vehicle.position.latitude;
        const busLon = entity.vehicle.position.longitude;
        const label = entity.vehicle.vehicle?.label || "Bus";
        const bearing = entity.vehicle.position.bearing || 0;

        const dist = distance(lat, lon, busLat, busLon);
        if (dist <= 3) {
          buses.push({
            id: entity.id,
            line: label,
            lat: busLat,
            lon: busLon,
            bearing,
            distance: dist
          });
        }
      }
    });

    buses.sort((a, b) => a.distance - b.distance);
    res.json({ count: buses.length, buses });
  } catch (err) {
    console.error("❌ Live BODS error:", err);
    res.status(500).json({ error: "Failed to load live buses" });
  }
});

// --- Helper: distance (km)
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// =====================================
//  5️⃣ AI Assistant (GPS-Aware)
// =====================================
app.get("/ask", async (req, res) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter" });

    const context = `
You are Transi Autopilot — a friendly real-time UK public transport assistant.
You can access these endpoints:
- /api/livebuses for nearby live buses
- /api/departures/:stop for next bus times
- /api/journey for planning trips
Always use available GPS coordinates (lat:${lat}, lon:${lon}) for local info.
If user asks about routes, find the best nearby stop and journey.
If user asks about live buses, mention active ones within 3km.
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

// =====================================
//  6️⃣ Twilio Voice Endpoint
// =====================================
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
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
//  7️⃣ Health + Static
// =====================================
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Transi Autopilot", version: "3.1" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚍 Transi Autopilot v3.1 running on port ${PORT}`);
});
