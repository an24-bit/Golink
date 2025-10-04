import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// =========================
// ROOT
// =========================
app.get("/", (req, res) => {
  res.send("🚌 Citybus AI Webhook is running");
});

// =========================
// STOPS (open endpoint)
// =========================
app.get("/stops", async (req, res) => {
  try {
    const response = await fetch(
      "https://www.plymouthbus.co.uk/_ajax/network/stops.geojson"
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.json({ error: "⚠️ Could not fetch stops" });
  }
});

// =========================
// LIVE VEHICLES (needs cookies + headers)
// =========================
app.get("/live-vehicles", async (req, res) => {
  try {
    const response = await fetch(
      "https://www.plymouthbus.co.uk/_ajax/hirevehicles/vehicles",
      {
        headers: {
          "accept": "*/*",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,fa;q=0.7",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
          "cookie": `cf_clearance=jbREmAvcmrWcQ1nCyOb8_cDjbkNTh6wHaimd__U4dWE-1759311801-1.2.1.1-Qila3q9TfrG0uT9IqOYCOKEiGxLDbseH_a44tPRSEhRlTIk5hfX6V3tGzuoR.ToMjrgtl5NDLYzjbIHj6DbKUpFu5lLWsDknT9UshQRXpnGtpqIckBvrdNFQFDvEByaI827qGFqU6ucnvSukaZpPVKTgBvWEfy6j2uqmwQzulII0yKQhVxIT6huZ45oYCf9Wd1GBD2uGcEuaUaPWYiD4ixc6.tI_2klWcy7BRzRu9Hg; lb_session_coookie="ChIxMC4xMzEuMTMyLjE5Mzo0NDMQ14reGQ=="; stripe_mid=311406f7-f6cd-471a-b072-b31a0a482becaa14ff; __stripe_sid=9829aeea-ce3a-4f90-9fa2-c0051378260ad10475`
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.json({ error: "⚠️ Could not fetch live vehicles" });
  }
});

// =========================
// TIMETABLES
// (example: you might need stop IDs here)
// =========================
app.get("/timetables/:stopId", async (req, res) => {
  const stopId = req.params.stopId; // e.g. 118000021
  try {
    const response = await fetch(
      `https://www.plymouthbus.co.uk/_ajax/stops/${stopId}/vehicles`,
      {
        headers: {
          "accept": "*/*",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
          "cookie": `cf_clearance=jbREmAvcmrWcQ1nCyOb8_cDjbkNTh6wHaimd__U4dWE-1759311801-1.2.1.1-Qila3q9TfrG0uT9IqOYCOKEiGxLDbseH_a44tPRSEhRlTIk5hfX6V3tGzuoR.ToMjrgtl5NDLYzjbIHj6DbKUpFu5lLWsDknT9UshQRXpnGtpqIckBvrdNFQFDvEByaI827qGFqU6ucnvSukaZpPVKTgBvWEfy6j2uqmwQzulII0yKQhVxIT6huZ45oYCf9Wd1GBD2uGcEuaUaPWYiD4ixc6.tI_2klWcy7BRzRu9Hg; lb_session_coookie="ChIxMC4xMzEuMTMyLjE5Mzo0NDMQ14reGQ=="; stripe_mid=311406f7-f6cd-471a-b072-b31a0a482becaa14ff; __stripe_sid=9829aeea-ce3a-4f90-9fa2-c0051378260ad10475`
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.json({ error: "⚠️ Could not fetch timetable" });
  }
});

// =========================
// TICKET PRICES
// (this page is HTML, we’d need to scrape or parse properly later)
// =========================
app.get("/ticket-prices", async (req, res) => {
  try {
    const response = await fetch("https://www.plymouthbus.co.uk/fares-tickets");
    const html = await response.text();
    res.send(html); // for now, just return raw HTML
  } catch (error) {
    console.error(error);
    res.json({ error: "⚠️ Could not fetch ticket prices" });
  }
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
