import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

const APP_ID = process.env.TRANSPORT_API_ID;
const APP_KEY = process.env.TRANSPORT_API_KEY;

// Base route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Unified question handler
app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";

  try {
    // --- Handle “next bus” or “live times” ---
    if (question.includes("bus") || question.includes("next")) {
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
        return res.json({ answer: `No live departures available right now for ${stopName}.` });
      }

      const firstRoute = Object.keys(data.departures)[0];
      const firstBus = data.departures[firstRoute][0];
      const answer = `The next ${firstBus.line} to ${firstBus.direction} leaves ${stopName} at ${firstBus.expected_departure_time}.`;
      return res.json({ question, answer });
    }

    // --- Handle “timetable” ---
    if (question.includes("timetable") || question.includes("schedule")) {
      const timetableURL = `https://transportapi.com/v3/uk/bus/service/bus-1-royal-parade.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(timetableURL);
      const data = await response.json();

      if (data && data.service) {
        const answer = `The ${data.service.name} service runs on ${data.service.operating_days.join(", ")} with first bus at ${data.service.first_bus_time} and last at ${data.service.last_bus_time}.`;
        return res.json({ question, answer });
      } else {
        return res.json({ answer: "No timetable data found for that service." });
      }
    }

    // --- Handle “fare” ---
    if (question.includes("fare") || question.includes("price") || question.includes("ticket")) {
      const fareURL = `https://transportapi.com/v3/uk/public/fares/from/plymouth/to/exeter.json?app_id=${APP_ID}&app_key=${APP_KEY}`;
      const response = await fetch(fareURL);
      const data = await response.json();

      if (data && data.fares && data.fares.length > 0) {
        const cheapest = data.fares[0];
        const answer = `The cheapest fare from Plymouth to Exeter is about £${cheapest.price} (${cheapest.ticket_type}).`;
        return res.json({ question, answer });
      } else {
        return res.json({ answer: "Fare data not available for that route." });
      }
    }

    // --- Default fallback ---
    res.json({
      answer:
        "I can help with live buses, timetables, fares, or nearby stops. Try asking something like 'When’s the next 43 from Royal Parade A4?'",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong while fetching transport data." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Transi AI running on port ${PORT}`));
