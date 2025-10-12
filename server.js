import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// --- Paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express app setup ---
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// --- Load Environment Variables ---
const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- Root route (serve the frontend page) ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 User opened Transi Autopilot Assistant");
});

// --- Unified intelligent route ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";

  if (!question || question.trim() === "") {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your 24/7 public transport assistant. You can ask me things like ‘Next 43 from Royal Parade A4’, ‘How much is a single to Devonport’, or ‘Where can I get the 28 from?’.",
    });
  }

  console.log(`🧠 Received question: ${question}`);

  try {
    // --- Handle “live buses” ---
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

      if (!data.departures) {
        return res.json({
          answer: `Hmm... I couldn’t see any live departures for ${stopName} right now. Maybe no buses are due this minute.`,
        });
      }

      const routeKeys = Object.keys(data.departures);
      let allRoutes = [];
      for (const route of routeKeys) {
        const departures = data.departures[route].slice(0, 3);
        departures.forEach((bus) =>
          allRoutes.push(`${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`)
        );
      }

      const answer = `Here’s what I found: upcoming buses from ${stopName} — ${allRoutes.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Handle “journey planning” ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      const answer = `Let me check... Normally, I’d use journey planners like Traveline South West. For now, this feature is being upgraded — but I’ll soon guide you with full routes from stop to stop.`;
      return res.json({ question, answer });
    }

    // --- Handle “fare” or “price” ---
    if (question.includes("fare") || question.includes("price") || question.includes("ticket")) {
      const fareURL = `https://transportapi.com/v3/uk/public/fares/from/plymouth/to/exeter.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(fareURL);
      const data = await response.json();

      if (data && data.fares && data.fares.length > 0) {
        const cheapest = data.fares[0];
        const answer = `Okay — the cheapest fare from Plymouth to Exeter is around £${cheapest.price} (${cheapest.ticket_type}).`;
        return res.json({ question, answer });
      } else {
        return res.json({
          answer: "I checked but couldn’t find any fare info right now. Try again shortly.",
        });
      }
    }

    // --- OpenAI fallback for all other transport-related questions ---
    if (OPENAI_API_KEY) {
      const aiPrompt = `
You are Transi Autopilot, a friendly UK transport assistant based in Plymouth.
Answer like a helpful human customer-service agent: natural tone, polite, realistic, short answers.
If question is outside bus data (like lost items or ticket offices), guide clearly and kindly.
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
      const aiAnswer = aiData.choices?.[0]?.message?.content || "Sorry, I didn’t catch that.";
      return res.json({ question, answer: aiAnswer });
    }

    // --- Default fallback ---
    res.json({
      answer:
        "I’m here to help with buses, fares, routes, and stops. Try asking me something like ‘When’s the next 43 from Royal Parade A4?’",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      error: "Something went wrong while fetching transport data.",
    });
  }
});

// --- Start server ---
app.listen(PORT, () => console.log(`✅ Transi Autopilot running on port ${PORT}`));
