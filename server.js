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

// --- Main page ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
  console.log("🟢 Visitor opened Transi Autopilot");
});

// --- Core Logic ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";
  console.log(`💬 User asked: ${question}`);

  // Default greeting
  if (!question.trim()) {
    return res.json({
      answer:
        "Hello there! I’m Transi Autopilot — your friendly public transport assistant. You can ask things like ‘When’s the next 43 from Royal Parade?’, ‘How much is a ticket to Devonport?’, or ‘Where can I get the 28 from?’",
    });
  }

  try {
    // Skip bus logic if user is talking about lost items, contact, or help
    if (
      question.includes("lost") ||
      question.includes("found") ||
      question.includes("wallet") ||
      question.includes("phone") ||
      question.includes("help") ||
      question.includes("contact")
    ) {
      return await handleAIResponse(question, res);
    }

    // --- Live bus data ---
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
        return res.json({
          answer: `Hmm… I couldn’t find any live departures for ${stopName} just now. It may simply mean no buses are due this minute.`,
        });
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

    // --- Journey planning ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      const answer = `Let me think... Normally I’d check live route data, but that feature is being upgraded. For now, the best way is to check Traveline South West — soon I’ll handle that directly here.`;
      return res.json({ question, answer });
    }

    // --- Fares / ticket prices ---
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
      return res.json({
        question,
        answer: "I couldn’t retrieve fare data right now — maybe try again shortly.",
      });
    }

    // --- Anything else ---
    return await handleAIResponse(question, res);
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      answer: "Something went wrong while fetching live data. Please try again in a moment.",
    });
  }
});

// --- Helper: AI fallback ---
async function handleAIResponse(question, res) {
  if (!OPENAI_API_KEY)
    return res.json({ answer: "AI service is not configured yet." });

  const aiPrompt = `
You are Transi Autopilot — a helpful British transport assistant based in Plymouth.
Answer naturally, in a warm conversational tone, as if chatting to a passenger.
If asked about lost items, phone numbers, customer service, or route info, respond helpfully and realistically.
If it’s outside transport, politely redirect to the right topic.
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
}

// --- Start ---
app.listen(PORT, () =>
  console.log(`✅ Transi Autopilot running on port ${PORT}`)
);
