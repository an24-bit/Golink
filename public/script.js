const input = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const responseBox = document.getElementById("responseBox");
const speakBtn = document.getElementById("speakBtn");

// --- Speak function (slow, natural UK English) ---
function speakText(text, rate = 0.9) {
  const synth = window.speechSynthesis;
  synth.cancel(); // stop any previous speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  utterance.pitch = 1;
  synth.speak(utterance);
}

// --- Ask question ---
async function askQuestion() {
  const question = input.value.trim();
  if (!question) {
    responseBox.textContent = "Please type or say a question first 🙂";
    speakText("Please type or say a question first.");
    return;
  }

  responseBox.textContent = "Alright, give me a moment while I check that for you...";
  speakText("Alright, give me a moment while I check that for you...", 0.92);

  try {
    const res = await fetch(`/ask?q=${encodeURIComponent(question)}`);
    const data = await res.json();

    if (data.answer) {
      responseBox.textContent = data.answer;
      speakText(data.answer, 0.88);
    } else {
      responseBox.textContent = "Sorry, I couldn’t find an answer right now.";
      speakText("Sorry, I couldn’t find an answer right now.", 0.88);
    }
  } catch (err) {
    console.error(err);
    responseBox.textContent = "Error: couldn't connect to Transi Autopilot.";
    speakText("Sorry, there was a connection problem with Transi Autopilot.", 0.9);
  }
}

// --- Voice input via microphone ---
voiceBtn.addEventListener("click", () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    responseBox.textContent = "Speech recognition isn’t supported on this browser.";
    speakText("Sorry, speech recognition isn’t supported on this browser.", 0.9);
    return;
  }

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-GB";
  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    responseBox.textContent = `You said: "${transcript}"`;
    speakText("Got it. Let me check that for you...", 0.9);
    askQuestion();
  };

  recognition.onerror = (event) => {
    responseBox.textContent = "Sorry, I couldn’t hear you clearly. Please try again.";
    speakText("Sorry, I couldn’t hear you clearly. Please try again.", 0.9);
  };
});

// --- Buttons & key events ---
askBtn.addEventListener("click", askQuestion);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") askQuestion();
});

speakBtn.addEventListener("click", () => {
  const text = responseBox.textContent.trim();
  if (text) speakText(text, 0.9);
});
