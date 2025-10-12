import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// --- Environment Variables ---
const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX_ID = process.env.GOOGLE_CX_ID;
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;

// --- Homepage ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 Visitor opened Transi Autopilot");
});

// --- Debug Route ---
app.get("/debug", (req, res) => {
  res.json({
    status: "✅ Transi Autopilot Diagnostic",
    environment: process.env.NODE_ENV || "production",
    connected: {
      OPENAI_API_KEY: !!OPENAI_API_KEY,
      TRANSPORT_API_ID: !!APP_ID,
      TRANSPORT_API_KEY: !!APP_KEY,
      GOOGLE_API_KEY: !!GOOGLE_API_KEY,
      GOOGLE_CX_ID: !!GOOGLE_CX_ID,
      OPENWEATHER_KEY: !!OPENWEATHER_KEY,
    },
    timestamp: new Date().toISOString(),
  });
});

// --- Location + Travel Assistant ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";
  const lat = req.query.lat;
  const lon = req.query.lon;

  console.log(`💬 User asked: ${question}`);

  if (!question.trim()) {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your travel assistant for buses, weather, and routes. Try asking: ‘Next 43 from Royal Parade?’ or ‘How do I get to city centre?’",
    });
  }

  try {
    // --- Weather request ---
    if (question.includes("weather") || question.includes("temperature")) {
      if (!lat || !lon || !OPENWEATHER_KEY)
        return res.json({
          answer: "Please allow location access for live weather updates.",
        });

      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`;
      const w = await fetch(url).then((r) => r.json());
      const answer = `Currently in ${w.name}, it's ${w.main.temp.toFixed(
        1
      )}°C with ${w.weather[0].description}.`;
      return res.json({ question, answer });
    }

    // --- Live Bus Info ---
    if (
      question.includes("bus") ||
      question.includes("depart") ||
      question.includes("leaves") ||
      question.match(/\b\d{1,3}\b/)
    ) {
      let stopCode = "plymouth-royal-parade";
      let stopName = "Royal Parade";

      const liveURL = `https://transportapi.com/v3/uk/bus/stop/${stopCode}/live.json?app_id=${APP_ID}&app_key=${APP_KEY}&group=route&nextbuses=yes`;
      console.log("🔗 Fetching live data:", liveURL);

      const response = await fetch(liveURL);
      const data = await response.json();

      if (!data?.departures) {
        console.log("⚠️ No live bus data — switching to Google...");
        return await handleWebSearch(question, res);
      }

      const routes = Object.keys(data.departures);
      const allBuses = routes.flatMap((r) =>
        data.departures[r].slice(0, 3).map(
          (bus) =>
            `${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`
        )
      );

      const answer = `Upcoming buses from ${stopName}: ${allBuses.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Routes or “how to get to” ---
    if (
      question.includes("how do i") ||
      question.includes("get to") ||
      question.includes("go to") ||
      question.includes("travel to")
    ) {
      return await handleWebSearch(question, res);
    }

    // --- Fallback AI ---
    return await handleAIResponse(question, res);
  } catch (err) {
    console.error("❌ General Error:", err);
    return res.status(500).json({
      answer: "Sorry — something went wrong while checking that.",
    });
  }
});

// --- OpenAI Response ---
async function handleAIResponse(question, res) {
  if (!OPENAI_API_KEY)
    return res.json({ answer: "AI access not configured yet." });

  try {
    const aiPrompt = `
You are Transi Autopilot — a friendly UK travel assistant. 
Help users find buses, stops, and advice for travelling around Plymouth and South West UK.
If possible, give live or practical instructions based on the question.
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: aiPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const aiAnswer =
      aiData.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t find that information.";
    return res.json({ question, answer: aiAnswer });
  } catch (err) {
    console.error("🧠 AI Error:", err);
    return res.json({
      answer: "AI service currently unavailable.",
    });
  }
}

// --- Google Custom Search ---
async function handleWebSearch(query, res) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX_ID) {
    return res.json({
      answer:
        "I tried searching the web but Google access isn’t configured yet.",
    });
  }

  try {
    console.log("🌐 Google Search for:", query);

    const googleUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query + " site:plymouthbus.co.uk OR site:traveline.info"
    )}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX_ID}&num=2`;

    const searchRes = await fetch(googleUrl);
    const data = await searchRes.json();

    if (!data.items?.length) {
      return res.json({
        answer: "I searched online but couldn’t find a clear answer.",
      });
    }

    const top = data.items[0];
    const html = await fetch(top.link).then((r) => r.text());
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").slice(0, 1200);

    return res.json({
      question: query,
      answer: `${text.slice(0, 250)}... (Source: ${top.link})`,
    });
  } catch (err) {
    console.error("🌐 Google Search Error:", err);
    return res.json({
      answer:
        "I tried searching online but couldn’t retrieve a clear answer right now.",
    });
  }
}

// --- Start Server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Transi Autopilot live and listening on port ${PORT}`);
});
