const askBtn = document.getElementById("askBtn");
const input = document.getElementById("question");
const responseBox = document.getElementById("responseBox");
const speakBtn = document.getElementById("speakBtn");

askBtn.addEventListener("click", askQuestion);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") askQuestion();
});

async function askQuestion() {
  const question = input.value.trim();
  if (!question) {
    responseBox.textContent = "Please type a question first 🙂";
    return;
  }

  responseBox.textContent = "Alright, give me a moment while I check that for you...";
  try {
    const res = await fetch(`/ask?q=${encodeURIComponent(question)}`);
    const data = await res.json();

    if (data.answer) {
      responseBox.textContent = data.answer;
      speakText(data.answer);
    } else {
      responseBox.textContent = "Sorry, I couldn't find an answer.";
    }
  } catch (err) {
    console.error(err);
    responseBox.textContent = "Error: couldn't connect to Transi AI.";
  }
}

function speakText(text) {
  const synth = window.speechSynthesis;
  synth.cancel(); // stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.85; // slower and clearer
  utterance.pitch = 1;
  synth.speak(utterance);
}

speakBtn.addEventListener("click", () => {
  const text = responseBox.textContent.trim();
  if (text) speakText(text);
});
