import express from "express";
import fetch from "node-fetch";
import fs from "fs-extra";
import { summarise } from "./helpers/summarise.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Root route
app.get("/", (_, res) => res.send("🚍 Transi AI Assistant is running smoothly!"));

// Main route
app.get("/ask", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "missing ?q=question" });

  try {
    // 🔎 Google Custom Search API (replace later with your own engine)
    const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      q
    )}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_CSE_ID}`;

    const r = await fetch(searchUrl);
    const data = await r.json();

    const snippets = data.items
      ?.slice(0, 3)
      .map((p) => `${p.title}: ${p.snippet}`)
      .join("\n");

    // 💬 Generate text summary using OpenAI
    const summary = await summarise(q, snippets);

    // 🔊 Convert to voice (Google TTS)
    const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY;
    const voiceUrl =
      "https://texttospeech.googleapis.com/v1/text:synthesize?key=" +
      GOOGLE_TTS_KEY;

    const ttsResponse = await fetch(voiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: summary },
        voice: { languageCode: "en-GB", name: "en-GB-Neural2-A" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    const ttsData = await ttsResponse.json();
    const audioBase64 = ttsData.audioContent;
    const filename = `tts/transi_${Date.now()}.mp3`;

    await fs.ensureDir("public/tts");
    await fs.writeFile(`public/${filename}`, Buffer.from(audioBase64, "base64"));

    res.json({
      question: q,
      answer: summary,
      audio: `/${filename}`,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "processing failed" });
  }
});

app.use("/tts", express.static("public/tts"));

app.listen(PORT, () => console.log(`✅ Transi server live on port ${PORT}`));
