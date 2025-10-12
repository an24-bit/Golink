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

const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- Serve the main page ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 Visitor opened Transi Autopilot");
});

// --- Core Assistant Logic ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";
  console.log(`💬 User asked: ${question}`);

  if (!question || question.trim() === "") {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your friendly transport assistant. You can ask me things like 'When’s the next 43 from Royal Parade?', 'How much is a single ticket?', or 'Where can I get the 28 from?'.",
    });
  }

  try {
    // --- Live Buses ---
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
          answer: `Hmm... I can’t see any live buses for ${stopName} at the moment. It could just mean there aren’t any due right now.`,
        });
      }

      const routeKeys = Object.keys(data.departures);
      let allRoutes = [];

      for (const route of routeKeys) {
        const departures = data.departures[route].slice(0, 3);
        departures.forEach((bus) => {
          allRoutes.push(`${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`);
        });
      }

      const answer = `Alright, here’s what I found — the next few buses from ${stopName}: ${allRoutes.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Journey Planning ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      const answer = `Let me think... Normally I’d check live journey data for you, but this feature is still being upgraded. For now, you can plan routes on Traveline South West — and soon you’ll be able to do it directly here.`;
      return res.json({ question, answer });
    }

    // --- Fare / Ticket Prices ---
    if (question.includes("fare") || question.includes("price") || question.includes("ticket")) {
      const fareURL = `https://transportapi.com/v3/uk/public/fares/from/plymouth/to/exeter.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(fareURL);
      const data = await response.json();

      if (data && data.fares && data.fares.length > 0) {
        const cheapest = data.fares[0];
        const answer = `The lowest fare from Plymouth to Exeter I could find is around £${cheapest.price}, using a ${cheapest.ticket_type}.`;
        return res.json({ question, answer });
      } else {
        return res.json({
          answer: "I couldn’t get any fare data just now — it might be temporarily unavailable.",
        });
      }
    }

    // --- AI fallback (OpenAI answers) ---
    if (OPENAI_API_KEY) {
      const aiPrompt = `
You are Transi Autopilot, a friendly UK transport assistant from Plymouth.
Answer naturally, as if chatting to a bus passenger. Be concise, polite, and warm.
If they ask about lost items, timetables, tickets, or local travel, respond like a real assistant would — not robotic.
If it’s something you can’t check live, give helpful guidance instead.
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
      const aiAnswer = aiData.choices?.[0]?.message?.content || "Sorry, I didn’t quite catch that.";
      return res.json({ question, answer: aiAnswer });
    }

    // --- Default fallback ---
    res.json({
      answer:
        "I’m here to help with live buses, fares, and travel info around Plymouth. Try asking me something like ‘Next 43 from Royal Parade A4?’ or ‘How much is a single to Devonport?’",
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
