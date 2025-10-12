app.get("/ask", async (req, res) => {
  const question = req.query.q?.toLowerCase() || "";

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
        return res.json({ answer: `No live departures available right now for ${stopName}.` });
      }

      const routeKeys = Object.keys(data.departures);
      let allRoutes = [];
      for (const route of routeKeys) {
        const departures = data.departures[route].slice(0, 3);
        departures.forEach((bus) =>
          allRoutes.push(`${bus.line} to ${bus.direction} at ${bus.expected_departure_time}`)
        );
      }

      const answer = `Upcoming buses from ${stopName}: ${allRoutes.join(", ")}.`;
      return res.json({ question, answer });
    }

    // --- Handle “journey planning” ---
    if (
      question.includes("go to") ||
      question.includes("get to") ||
      question.includes("travel to") ||
      question.includes("how do i")
    ) {
      const answer = `For journeys like "${question}", please check the TransportAPI route planner or Traveline South West — the system will soon include full journey planning.`;
      return res.json({ question, answer });
    }

    // --- Handle “fare” or “price” ---
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

    // --- AI fallback (OpenAI for general questions) ---
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
                "You are Transi AI, a helpful UK public transport assistant. Provide clear answers about buses, travel, and lost property in the Plymouth and South West area.",
            },
            { role: "user", content: question },
          ],
        }),
      });

      const aiData = await aiRes.json();
      const aiAnswer = aiData.choices?.[0]?.message?.content || "Sorry, I’m not sure about that.";
      return res.json({ question, answer: aiAnswer });
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
