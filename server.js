import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
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

// --- Homepage ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 Visitor opened Transi Autopilot");
});

// --- Health / Debug Route ---
app.get("/debug", (req, res) => {
  res.json({
    status: "✅ Transi Autopilot is running",
    environment: process.env.NODE_ENV || "production",
    transportAPI: !!APP_KEY,
    openAI: !!OPENAI_API_KEY,
    googleSearch: !!GOOGLE_API_KEY && !!GOOGLE_CX_ID,
    port: PORT
  });
});

// --- Main Assistant Endpoint ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";
  console.log(`💬 User asked: ${question}`);

  if (!question.trim()) {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your friendly travel assistant for Plymouth & the South West. You can ask things like: 'Next 43 from Royal Parade?', 'Lost wallet on bus 21?', or 'Ticket price to Exeter?'.",
    });
  }

  try {
    // Lost property or contact queries
    if (
      question.includes("lost") ||
      question.includes("found") ||
      question.includes("wallet") ||
      question.includes("phone") ||
      question.includes("contact")
    ) {
      return await handleAIResponse(question, res);
    }

    // --- Live Bus Info ---
    if (
      question.includes("bus") ||
      question.includes("depart") ||
      question.includes("leaves") ||
      question.includes("next") ||
      question.match(/\b\d{1,3}\b/)
    ) {
      const match = question.match(/\b([A-D]\d{1,2})\b/i);
      let stopCode = "plymouth-royal-parade";
      let stopName = "Royal Parade";

      const stops = {
        A4: "1100PZ01901",
        D1: "1100PZ01926",
        C2: "1100PZ01920",
        B3: "1100PZ01915",
      };

      if (match && stops[match[1].toUpperCase()]) {
        stopCode = stops[match[1].toUpperCase()];
        stopName = `Royal Parade Stop ${match[1].toUpperCase()}`;
      }

      const liveURL = `https://transportapi.com/v3/uk/bus/stop/${stopCode}/live.json?app_id=${APP_ID}&app_key=${APP_KEY}&group=route&nextbuses=yes`;
      const response = await fetch(liveURL);
      const data = await response.json();

      if (!data?.departures) {
        console.log("⚠️ No live bus data, switching to web search...");
        return await handleWebSearch(question, res);
      }

      const routes = Object.keys(data.departures);
      const allBuses = routes.flatMap((r) =>
        data.departures[r].slice(0, 3).map(
          (bus) => `${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`
        )
      );

      const answer = `Here’s what I found — upcoming buses from ${stopName}: ${allBuses.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Fares / Tickets ---
    if (question.includes("fare") || question.includes("price") || question.includes("ticket")) {
      const fareURL = `https://transportapi.com/v3/uk/public/fares/from/plymouth/to/exeter.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(fareURL);
      const data = await response.json();

      if (data?.fares?.length) {
        const cheapest = data.fares[0];
        return res.json({
          question,
          answer: `The lowest fare from Plymouth to Exeter is about £${cheapest.price} (${cheapest.ticket_type}).`,
        });
      }
      return await handleWebSearch(question, res);
    }

    // --- Route or Journey planning ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      return await handleWebSearch(question, res);
    }

    // --- Otherwise, AI fallback ---
    return await handleAIResponse(question, res);
  } catch (err) {
    console.error("❌ General Error:", err);
    return res.status(500).json({
      answer: "Sorry — something went wrong while checking that.",
    });
  }
});

// --- OpenAI fallback ---
async function handleAIResponse(question, res) {
  if (!OPENAI_API_KEY)
    return res.json({ answer: "AI access not configured yet." });

  try {
    const aiPrompt = `
You are Transi Autopilot — a calm, polite British travel assistant for buses and transport in the South West.
Speak naturally, like a real person helping passengers.
If no data is found, guide the user on what to try next.
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
      "Sorry, I couldn’t find an answer right now.";
    return res.json({ question, answer: aiAnswer });
  } catch (err) {
    console.error("🧠 AI Error:", err);
    return res.json({
      answer: "AI is currently unavailable — please try again shortly.",
    });
  }
}

// --- Google Custom Search fallback ---
async function handleWebSearch(query, res) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX_ID) {
    return res.json({
      answer: "I tried searching the web, but Google access isn’t configured yet.",
    });
  }

  try {
    const customsearch = google.customsearch("v1");
    const result = await customsearch.cse.list({
      cx: GOOGLE_CX_ID,
      q: `site:traveline.info OR site:plymouthbus.co.uk ${query}`,
      auth: GOOGLE_API_KEY,
      num: 2,
    });

    const top = result.data.items?.[0];
    if (!top) {
      return res.json({
        answer: "I searched online but couldn’t find a reliable answer just now.",
      });
    }

    const html = await fetch(top.link).then((r) => r.text());
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1500);

    const aiSummaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Summarise this information in 2–3 friendly sentences suitable for a bus passenger:",
          },
          { role: "user", content: text },
        ],
      }),
    });

    const aiSummaryData = await aiSummaryRes.json();
    const summary =
      aiSummaryData.choices?.[0]?.message?.content ||
      "I found something online, but couldn’t summarise it clearly.";
    return res.json({ question: query, answer: summary });
  } catch (err) {
    console.error("🌐 Google Search Error:", err);
    return res.json({
      answer: "I tried searching online but couldn’t retrieve a clear answer right now.",
    });
  }
}

// --- Start Server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Transi Autopilot live and listening on port ${PORT}`);
});
