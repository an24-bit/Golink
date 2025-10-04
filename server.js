// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Root endpoint
app.get("/", (req, res) => {
  res.send("🚍 Citybus AI Webhook is running");
});

// ---- Ticket Prices Intent ----
app.post("/ticket-prices", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/tickets");
    res.json({ reply: response.data });
  } catch (err) {
    console.error("Ticket prices error:", err.message);
    res.json({ reply: "⚠️ Sorry, I couldn’t fetch ticket prices right now." });
  }
});

// ---- Timetable Intent ----
app.post("/timetable", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/timetables");
    res.json({ reply: response.data });
  } catch (err) {
    console.error("Timetable error:", err.message);
    res.json({ reply: "⚠️ Sorry, I couldn’t fetch timetable info right now." });
  }
});

// ---- Stops (list of all bus stops) ----
app.get("/stops", async (req, res) => {
  try {
    const response = await axios.get("https://plymouthbus.arcticapi.com/network/stops.geojson");
    res.json(response.data);
  } catch (err) {
    console.error("Stops error:", err.message);
    res.json({ error: "⚠️ Could not fetch stops" });
  }
});

// ---- Live Vehicles Intent ----
app.get("/live-vehicles", async (req, res) => {
  try {
    const response = await axios.get("https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://www.plymouthbus.co.uk/explore",
        "Cookie": "__stripe_mid=311406f7-f6cd-471a-b072-b31a0a482becaa14ff; __stripe_sid=9829aeea-ce3a-4f90-9fa2-c0051378260ad10475; cf_clearance=jbREmAvcmrWcQ1nCyOb8_cDjbkNTh6wHaimd__U4dWE-1759311801-1.2.1.1-Qila3q9TfrG0uT9IqOYCOKEiGxLDbseH_a44tPRSEhRlTIk5hfX6V3tGzuoR.ToMjrgtl5NDLYzjbIHj6DbKUpFu5lLWsDknT9UshQRXpnGtpqIckBvrdNFQFDvEByaI827qGFqU6ucnvSukaZpPVKTgBvWEfy6j2uqmwQzulII0yKQhVxIT6huZ45oYCf9Wd1GBD2uGcEuaUaPWYiD4ixc6.tI_2klWcy7BRzRu9Hg; CookieConsent={stamp:'hliuH5SPlqrpVkO4q1Ri9WKz323y9t0jS+Krt65AhnK3YBgRe4R2SA==',necessary:true,preferences:false,statistics:false,marketing:false,method:'explicit',ver:3,utc:1759311782684,region:'gb'}; lb_session_coookie=\"ChIxMC4xMzEuMTMyLjE5Mzo0NDMQ14reGQ==\"; passenger-favourites-0=%7B%22device%22%3A%228cd62245855a4ffc95876bcc577fd37a%22%2C%22user%22%3Anull%2C%22lastSync%22%3Anull%2C%22favourites%22%3A%5B%5D%7D"
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Live vehicles error:", err.message);
    res.json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`🚍 Citybus AI Webhook running on port ${PORT}`);
});
