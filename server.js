import express from "express";
import fetch from "node-fetch";
import fs from "fs-extra";
import { summarise } from "./helpers/summarise.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Root route
app.use(express.static("public"));

// 🔊 Test route — check if Google TTS is working
app.get("/test-tts", async (_, res) => {
  try {
    const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY;
    if (!GOOGLE_TTS_KEY)
      return res.status(400).send("❌ GOOGLE_TTS_KEY missing in environment.");

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: "Hello! Your Transi AI voice system is working fine." },
          voice: { languageCode: "en-GB", name: "en-GB-Neural2-A" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    const data = await response.json();
    if (data.audioContent) {
      res.send("✅ Google Text-to-Speech is working fine!");
    } else {
      res.status(400).json(data);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error testing TTS: " + err.message);
  }
});

// Main route
app.get("/ask", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "missing ?q=question" });

  try {
    // 🔎 Google Custom Search API
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

    // 🔊 Convert summary to speech (Google TTS)
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

    if (!ttsData.audioContent)
      return res.status(400).json({
        error: "TTS request failed",
        details: ttsData,
      });

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

app.listen(PORT, () =>
  console.log(`✅ Transi server live on port ${PORT}`)
);
