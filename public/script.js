// --- Transi Autopilot Frontend Script ---
// Handles input, voice, GPS, fetch requests, and speech output

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const speakBtn = document.getElementById("speakBtn");
const questionBox = document.getElementById("question");
const responseBox = document.getElementById("responseBox");
const audioBox = document.getElementById("audioBox");

let userLocation = { lat: null, lon: null };

// --- Get location automatically ---
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation.lat = pos.coords.latitude.toFixed(6);
      userLocation.lon = pos.coords.longitude.toFixed(6);
      console.log("📍 Location detected:", userLocation);
    },
    (err) => {
      console.warn("⚠️ Location access denied:", err.message);
    }
  );
} else {
  console.warn("❌ Geolocation not supported on this device.");
}

// --- Ask button ---
askBtn.addEventListener("click", () => {
  const question = questionBox.value.trim();
  if (!question) return;
  getAnswer(question);
});

// --- Enter key support ---
questionBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getAnswer(questionBox.value.trim());
});

// --- Speech input (Voice Recognition) ---
voiceBtn.addEventListener("click", () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech recognition not supported on this browser.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-GB";
  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    questionBox.value = transcript;
    getAnswer(transcript);
  };
});

// --- Fetch answer from backend ---
async function getAnswer(question) {
  responseBox.textContent = "⏳ Thinking...";

  try {
    const params = new URLSearchParams({
      q: question,
      lat: userLocation.lat || "",
      lon: userLocation.lon || "",
    });

    const res = await fetch(`/ask?${params}`);
    const data = await res.json();
    responseBox.textContent = data.answer || "Sorry, no reply received.";

    // Auto speak the result
    speakText(data.answer);
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    responseBox.textContent =
      "Something went wrong — please try again in a moment.";
  }
}

// --- Text-to-Speech (Browser-based) ---
function speakText(text) {
  if (!text) return;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-GB";
  speech.pitch = 1;
  speech.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(speech);
}

// --- Manual Read Aloud button ---
speakBtn.addEventListener("click", () => {
  speakText(responseBox.textContent);
});

// --- Auto greeting ---
window.addEventListener("load", () => {
  const greeting =
    "Welcome to Transi Autopilot Assistant. How can I help you today?";
  speakText(greeting);
});
