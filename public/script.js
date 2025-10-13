// --- Transi Autopilot Frontend Script ---
// Handles input, voice, GPS, map, API fetch requests, and speech output

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const speakBtn = document.getElementById("speakBtn");
const questionBox = document.getElementById("question");
const responseBox = document.getElementById("responseBox");
const audioBox = document.getElementById("audioBox");

let userLocation = { lat: null, lon: null };
let map;

// --- Detect user location and load map ---
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLocation.lat = pos.coords.latitude.toFixed(6);
      userLocation.lon = pos.coords.longitude.toFixed(6);
      console.log("📍 Location detected:", userLocation);
      initMap(userLocation.lat, userLocation.lon);
    },
    (err) => {
      console.warn("⚠️ Location access denied:", err.message);
      // Default fallback to Plymouth City Centre
      initMap(50.3755, -4.1427);
    }
  );
} else {
  console.warn("❌ Geolocation not supported — using Plymouth centre.");
  initMap(50.3755, -4.1427);
}

// --- Map setup using Leaflet ---
async function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const userMarker = L.marker([lat, lon]).addTo(map);
  userMarker.bindPopup("📍 You are here").openPopup();

  try {
    const res = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (data.member) {
      data.member.forEach((stop) => {
        const sLat = stop.latitude;
        const sLon = stop.longitude;
        const sName = stop.name || "Bus Stop";
        const atcocode = stop.atcocode || "";

        const marker = L.marker([sLat, sLon]).addTo(map);
        marker.bindPopup(
          `<b>${sName}</b><br><button onclick="getDepartures('${atcocode}')">🕒 Next Buses</button>`
        );
      });
    }
  } catch (err) {
    console.error("❌ Error loading nearby stops:", err);
  }
}

// --- Fetch live departures when clicking a stop ---
async function getDepartures(atcocode) {
  if (!atcocode) return;
  responseBox.textContent = "⏳ Loading live departures...";

  try {
    const res = await fetch(`/api/departures/${atcocode}`);
    const data = await res.json();

    if (!data.departures) {
      responseBox.textContent = "No live data available for this stop.";
      return;
    }

    let html = `🚏 <b>Next buses from this stop:</b><br>`;
    for (const route in data.departures) {
      data.departures[route].forEach((bus) => {
        html += `${bus.line_name} → ${bus.direction} — ${bus.expected_departure_time}<br>`;
      });
    }
    responseBox.innerHTML = html;
    speakText(`Here are the next buses for this stop.`);
  } catch (err) {
    console.error("❌ Error fetching departures:", err);
    responseBox.textContent = "Could not load bus departures.";
  }
}

// --- Handle Ask button ---
askBtn.addEventListener("click", () => {
  const question = questionBox.value.trim();
  if (!question) return;
  getAnswer(question);
});

// --- Enter key support ---
questionBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getAnswer(questionBox.value.trim());
});

// --- Voice Recognition (Speech Input) ---
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

// --- Fetch AI-generated answer from backend ---
async function getAnswer(question) {
  responseBox.textContent = "⏳ Thinking...";

  try {
    const params = new URLSearchParams({
      q: question,
      lat: userLocation.lat || "",
      lon: userLocation.lon || "",
    });

    const res = await fetch(`/api/ask?${params}`);
    const data = await res.json();
    responseBox.innerHTML = data.answer || "Sorry, no reply received.";
    speakText(data.answer);
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    responseBox.textContent =
      "Something went wrong — please try again in a moment.";
  }
}

// --- Text-to-Speech (Browser speech output) ---
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

// --- Auto greeting on load ---
window.addEventListener("load", () => {
  const greeting =
    "Welcome to Transi Autopilot Assistant. How can I help you today?";
  speakText(greeting);
});
