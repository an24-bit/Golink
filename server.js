import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Replace these with your TransportAPI keys
const APP_ID = process.env.TRANSPORT_API_ID;  // your app_id
const APP_KEY = process.env.TRANSPORT_API_KEY; // your app_key

// --- Base route ---
app.get("/", (req, res) => {
  res.send("🚌 Transi AI is connected to TransportAPI!");
});

// --- Main /ask endpoint ---
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase();

  try {
    if (!question) {
      return res.json({ error: "No question provided." });
    }

    // Example: "next bus from crownhill to city centre"
    if (question.includes("bus") || question.includes("next")) {
      // Replace with your nearest stop code (e.g. 1100CRO12345)
      const stopCode = "plym-admiralty-street"; // example
      const url = `https://transportapi.com/v3/uk/bus/stop/${stopCode}/live.json?app_id=${APP_ID}&app_key=${APP_KEY}&group=route&nextbuses=yes`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.departures) {
        return res.json({ answer: "No live bus data found at the moment." });
      }

      const firstRoute = Object.keys(data.departures)[0];
      const firstBus = data.departures[firstRoute][0];

      const answer = `The next ${firstBus.line} to ${firstBus.direction} leaves at ${firstBus.expected_departure_time} from ${data.stop_name}.`;
      return res.json({ question, answer });
    }

    // Example: “plan route from devonport to mutley plain”
    if (question.includes("route") || question.includes("plan")) {
      const url = `https://transportapi.com/v3/uk/public/journey/from/devonport/to/mutley_plain.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const duration = route.duration.text || "unknown time";
        const answer = `Best route from Devonport to Mutley Plain takes about ${duration}.`;
        return res.json({ question, answer });
      } else {
        return res.json({ answer: "No route found for that journey." });
      }
    }

    // Default fallback
    return res.json({
      answer: "I'm here to help with bus times, routes, and transport info — try asking 'next bus from Crownhill to city centre'.",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong while fetching bus info." });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Transi AI running on port ${PORT}`));
