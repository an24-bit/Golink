// =====================================
//  GoLink — Main Server (v4.0 BODS Edition)
//  Author: Ali
//  Features: AI + Voice + Live Bus Tracking + Journey Planner (Free APIs)
// =====================================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import { parseString } from "xml2js";

dotenv.config();

// --------------------------------------------------
//  Core Setup
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_SID = process.env.TWILIO_SID || "";

const VoiceResponse = twilio.twiml.VoiceResponse;

// --------------------------------------------------
//  1️⃣ Nearby Stops (Overpass API — free)
// --------------------------------------------------
app.get("/api/nearby", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res.status(400).json({ error: "Missing lat/lon" });

    const radius = 600; // metres
    const query = `
      [out:json];
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      out;`;
    const r = await fetch(
      "https://overpass-api.de/api/interpreter?data=" +
        encodeURIComponent(query)
    );
    const data = await r.json();
    res.json({ member: data.elements });
  } catch (err) {
    console.error("❌ Nearby (OSM) error:", err);
    res.status(500).json({ error: "Could not fetch nearby stops" });
  }
});

// --------------------------------------------------
//  2️⃣ Live Departures (BODS SIRI-SM feed — free)
// --------------------------------------------------
app.get("/api/departures/:stopId", async (req, res) => {
  const stopId = req.params.stopId;
  try {
    const url = `https://data.bus-data.dft.gov.uk/api/siri-sm?stop_id=${stopId}`;
    const bodsRes = await fetch(url);
    const xml = await bodsRes.text();

    parseString(xml, (err, result) => {
      if (err) {
        console.error("❌ XML parse error:", err);
        return res.status(500).json({ error: "Parse error" });
      }

      const visits =
        result?.Siri?.ServiceDelivery?.[0]?.StopMonitoringDelivery?.[0]
          ?.MonitoredStopVisit || [];

      const departures = visits.map((v) => {
        const j = v.MonitoredVehicleJourney?.[0];
        return {
          line_name: j?.LineRef?.[0],
          direction: j?.DirectionRef?.[0],
          destination: j?.DestinationName?.[0],
          expected_departure_time:
            j?.MonitoredCall?.[0]?.ExpectedDepartureTime?.[0] || "",
        };
      });

      res.json({ departures: { all: departures.slice(0, 10) } });
    });
  } catch (err) {
    console.error("❌ BODS departures error:", err);
    res.status(500).json({ error: "Could not fetch BODS departures" });
  }
});

// --------------------------------------------------
//  3️⃣ Live Buses (BODS SIRI-VM feed — free)
// --------------------------------------------------
app.get("/api/livebuses", async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const url = "https://data.bus-data.dft.gov.uk/api/siri-vehicle-monitoring";
    const bodsRes = await fetch(url);
    const xml = await bodsRes.text();

    parseString(xml, (err, result) => {
      if (err) {
        console.error("❌ XML parse error:", err);
        return res.status(500).json({ error: "Parse error" });
      }

      const vehicles =
        result?.Siri?.ServiceDelivery?.[0]?.VehicleMonitoringDelivery?.[0]
          ?.VehicleActivity || [];

      const buses = vehicles
        .map((v) => {
          const mvj = v?.MonitoredVehicleJourney?.[0];
          return {
            id: mvj?.VehicleRef?.[0],
            line: mvj?.LineRef?.[0],
            bearing: mvj?.Bearing?.[0] || 0,
            lat: parseFloat(mvj?.VehicleLocation?.[0]?.Latitude?.[0] || 0),
            lon: parseFloat(mvj?.VehicleLocation?.[0]?.Longitude?.[0] || 0),
            direction: mvj?.DestinationName?.[0] || "",
          };
        })
        .filter((b) => b.lat && b.lon);

      // Filter to ~5km radius of user
      const filtered = buses.filter((b) => {
        const dx = (b.lat - lat) * 111;
        const dy = (b.lon - lon) * 85;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 5;
      });

      res.json({ buses: filtered.slice(0, 40) });
    });
  } catch (err) {
    console.error("❌ BODS livebus error:", err);
    res.status(500).json({ error: "Could not fetch BODS live data" });
  }
});

// --------------------------------------------------
//  4️⃣ Journey Planner (still uses TransportAPI if available)
// --------------------------------------------------
app.get("/api/journey", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "Missing from/to" });

    // simple placeholder until BODS journey endpoint is added
    res.json({
      answer: `Public journey planning is temporarily simplified. Please use your nearest stop to find bus routes from ${from} to ${to}.`,
    });
  } catch (err) {
    console.error("❌ Journey error:", err);
    res.status(500).json({ error: "Could not fetch journey details" });
  }
});

// --------------------------------------------------
//  5️⃣ AI Assistant (Chat Endpoint)
// --------------------------------------------------
app.get("/ask", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter" });

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are GoLink — a helpful UK transport assistant for Plymouth & the South West. 
Provide short, clear answers about buses, stops, or journeys.`,
        },
        { role: "user", content: q },
      ],
      max_tokens: 200,
      temperature: 0.7,
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

// --------------------------------------------------
//  6️⃣ Twilio Voice Assistant
// --------------------------------------------------
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
          max_tokens: 150,
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

// --------------------------------------------------
//  7️⃣ Health + Static Routes
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "GoLink", version: "4.0-BODS" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
//  8️⃣ Start Server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🛰️ GoLink v4.0 (BODS Edition) is live on port ${PORT}`);
});
