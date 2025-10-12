import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cheerio from "cheerio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX_ID = process.env.GOOGLE_CX_ID;

// --- Serve page ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 Visitor opened Transi Autopilot");
});

// --- Core Logic ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";
  console.log(`💬 User asked: ${question}`);

  if (!question.trim()) {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your friendly travel assistant. You can ask about buses, fares, lost property, or live routes around Plymouth.",
    });
  }

  try {
    // Lost item → AI fallback
    if (
      question.includes("lost") ||
      question.includes("found") ||
      question.includes("wallet") ||
      question.includes("phone") ||
      question.includes("contact")
    ) {
      return await handleAIResponse(question, res);
    }

    // --- Live Buses ---
    if (
      question.includes("bus") ||
      question.includes("depart") ||
      question.includes("leave") ||
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

      if (!data.departures) {
        console.log("⚠️ No live bus data, moving to web search...");
        return await handleWebSearch(question, res);
      }

      const routeKeys = Object.keys(data.departures);
      const allRoutes = routeKeys.flatMap((route) =>
        data.departures[route].slice(0, 3).map(
          (bus) => `${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`
        )
      );

      const answer = `Here’s what I found — upcoming buses from ${stopName}: ${allRoutes.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Journey Planning ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      return await handleWebSearch(question, res);
    }

    // --- Fare Info ---
    if (question.includes("fare") || question.includes("price") || question.includes("ticket")) {
      const fareURL = `https://transportapi.com/v3/uk/public/fares/from/plymouth/to/exeter.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(fareURL);
      const data = await response.json();

      if (data?.fares?.length) {
        const cheapest = data.fares[0];
        return res.json({
          question,
          answer: `The lowest fare from Plymouth to Exeter I found is around £${cheapest.price} (${cheapest.ticket_type}).`,
        });
      }
      return await handleWebSearch(question, res);
    }

    // --- Otherwise, try AI or web search ---
    return await handleAIResponse(question, res);
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      answer: "Something went wrong while fetching live data.",
    });
  }
});

// --- AI Fallback ---
async function handleAIResponse(question, res) {
  if (!OPENAI_API_KEY) return res.json({ answer: "AI service not configured yet." });

  const aiPrompt = `
You are Transi Autopilot — a British travel assistant.
Speak conversationally, like a real person helping a passenger.
If a direct answer isn’t available, give a helpful explanation.
If question is about Plymouth or South West travel, use realistic context.
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
    "Sorry, I couldn’t find an answer just now.";
  return res.json({ question, answer: aiAnswer });
}

// --- Web Search Fallback ---
async function handleWebSearch(query, res) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX_ID)
    return res.json({
      answer:
        "I tried searching the web, but my search access isn’t set up yet.",
    });

  try {
    const customsearch = google.customsearch("v1");
    const result = await customsearch.cse.list({
      cx: GOOGLE_CX_ID,
      q: `site:traveline.info OR site:plymouthbus.co.uk ${query}`,
      auth: GOOGLE_API_KEY,
      num: 3,
    });

    const topResult = result.data.items?.[0];
    if (!topResult)
      return res.json({
        answer: "I searched the web but couldn’t find anything useful right now.",
      });

    // Fetch & summarise the top result
    const html = await fetch(topResult.link).then((r) => r.text());
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1500);

    // Summarise using OpenAI
    const aiSummary = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content:
              "Summarise this travel info in 2-3 friendly sentences suitable for a bus passenger:",
          },
          { role: "user", content: text },
        ],
      }),
    }).then((r) => r.json());

    const summary =
      aiSummary.choices?.[0]?.message?.content ||
      "I found something online, but couldn’t summarise it.";
    return res.json({ question: query, answer: summary });
  } catch (err) {
    console.error("🌐 Web search error:", err);
    return res.json({
      answer: "I tried searching online but couldn’t get a clear answer just now.",
    });
  }
}

// --- Start ---
app.listen(PORT, () => console.log(`✅ Transi Autopilot live on port ${PORT}`));
