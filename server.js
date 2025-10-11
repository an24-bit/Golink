import express from "express";
import fetch from "node-fetch";
import { Configuration, OpenAIApi } from "openai";

const app = express();
const PORT = process.env.PORT || 3000;
const BING_KEY = process.env.BING_KEY;       // Bing Search or SerpAPI key
const OPENAI_KEY = process.env.OPENAI_KEY;

const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }));

app.get("/", (_, res) => res.send("🤖 Live Travel Assistant running"));

// ------------------------------------------------------------------
app.get("/ask", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "missing ?q=question" });

  try {
    // 1️⃣ search the web safely
    const bingUrl =
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(bingUrl, { headers: { "Ocp-Apim-Subscription-Key": BING_KEY }});
    const data = await r.json();

    // 2️⃣ collect top few snippets
    const snippets = data.webPages?.value?.slice(0, 3)
      .map(p => `${p.name}: ${p.snippet}`).join("\n");

    // 3️⃣ summarise using OpenAI
    const gptPrompt = `Question: ${q}
Below are short snippets from web search results. 
Create a short spoken-style answer based only on these snippets.
Snippets:\n${snippets}`;

    const gpt = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: gptPrompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const answer = gpt.data.choices[0].message.content.trim();
    res.json({ answer });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "search or summary failed" });
  }
});
// ------------------------------------------------------------------

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
