import express from "express";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

// environment keys
const BING_KEY = process.env.BING_KEY;       // Bing Search or SerpAPI key
const OPENAI_KEY = process.env.OPENAI_KEY;   // OpenAI API key

// initialise OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_KEY
});

// root route
app.get("/", (_, res) => {
  res.send("🤖 Live Travel Assistant running");
});

// ------------------------------------------------------------------
// main endpoint
app.get("/ask", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "missing ?q=question" });

  console.log(`🟢 New request received: "${q}"`);

  try {
    // 1️⃣ search Bing for context
    const bingUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(bingUrl, {
      headers: { "Ocp-Apim-Subscription-Key": BING_KEY }
    });
    const data = await r.json();

    // 2️⃣ extract top snippets
    const snippets = data.webPages?.value?.slice(0, 3)
      ?.map(p => `${p.name}: ${p.snippet}`)
      .join("\n") || "No snippets found.";

    // 3️⃣ summarise with OpenAI
    const gptPrompt = `Question: ${q}
Below are short snippets from web search results.
Create a short, natural spoken-style answer based only on these snippets.

Snippets:
${snippets}`;

    const gpt = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: gptPrompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const answer = gpt.choices[0].message.content.trim();

    // log both question and answer
    console.log("------------------------------------------------");
    console.log(`❓ Question: ${q}`);
    console.log(`💬 Answer: ${answer}`);
    console.log("------------------------------------------------");

    res.json({ question: q, answer });

  } catch (err) {
    console.error("🚨 Error:", err);
    res.status(500).json({ error: "search or summary failed", details: err.message });
  }
});
// ------------------------------------------------------------------

// start server
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
