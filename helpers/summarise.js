import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

export async function summarise(question, snippets) {
  const prompt = `You are Transi, a friendly British travel assistant.
Question: ${question}
Below are snippets from UK South West transport websites.
Write a short spoken-style answer in plain English based only on them.
Be concise, accurate, and sound like you're talking to a passenger.

Snippets:
${snippets}`;

  const gpt = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
    temperature: 0.4
  });

  return gpt.choices[0].message.content.trim();
}
