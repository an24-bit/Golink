// =====================================
//  GoLink — Live Bus Assistant (Frontend)
//  Version 3.2
//  Author: Ali
// =====================================

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const speakBtn = document.getElementById("speakBtn");
const questionBox = document.getElementById("question");
const responseBox = document.getElementById("responseBox");

let userLocation = { lat: null, lon: null };
let map;
let busMarkers = [];

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
      initMap(50.3755, -4.1427); // Plymouth fallback
    }
  );
} else {
  console.warn("❌ Geolocation not supported — using Plymouth centre.");
  initMap(50.3755, -4.1427);
}

// --- Initialise Map (Leaflet) ---
async function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const userMarker = L.marker([lat, lon]).addTo(map);
  userMarker.bindPopup("📍 You are here").openPopup();

  await loadNearbyStops(lat, lon);
  await updateLiveBuses(lat, lon);

  // Refresh buses dynamically (2–5 seconds when updates available)
  setInterval(() => updateLiveBuses(lat, lon), 5000);
}

// --- Load Nearby Bus Stops ---
async function loadNearbyStops(lat, lon) {
  try {
    const res = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.member) return;

    data.member.slice(0, 4).forEach((stop) => {
      const marker = L.marker([stop.latitude, stop.longitude]).addTo(map);
      marker.bindPopup(
        `<b>${stop.name}</b><br>${stop.locality || ""}<br>
         <button onclick="getDepartures('${stop.atcocode || ""}')">🕒 Next Buses</button>`
      );
    });
  } catch (err) {
    console.error("❌ Nearby stops error:", err);
  }
}

// --- Get Live Departures for Selected Stop ---
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
    speakText("Here are the next buses for this stop.");
  } catch (err) {
    console.error("❌ Departures error:", err);
    responseBox.textContent = "Could not load bus departures.";
  }
}

// --- Update Live Bus Positions (from BODS feed) ---
async function updateLiveBuses(lat, lon) {
  try {
    const res = await fetch(`/api/livebuses?lat=${lat}&lon=${lon}`);
    const data = await res.json();

    // Remove old markers
    busMarkers.forEach((m) => map.removeLayer(m));
    busMarkers = [];

    if (!data.buses || data.buses.length === 0) return;

    data.buses.slice(0, 10).forEach((bus) => {
      const busIcon = L.divIcon({
        className: "live-bus",
        html: `🚌<div class='bus-label'>${bus.line}</div>`,
        iconSize: [25, 25],
      });

      const marker = L.marker([bus.lat, bus.lon], { icon: busIcon }).addTo(map);
      marker.bindPopup(
        `<b>${bus.line}</b><br>${bus.distance.toFixed(2)} km away`
      );
      busMarkers.push(marker);
    });

    // Pulse the live indicator on new update
    if (window.pulseLiveIndicator) window.pulseLiveIndicator();

  } catch (err) {
    console.warn("❌ Live bus update failed:", err);
  }
}

// --- Ask Button ---
askBtn.addEventListener("click", () => {
  const question = questionBox.value.trim();
  if (question) getAnswer(question);
});

// --- Enter Key Support ---
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

// --- Fetch AI-Generated Answer ---
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

    setTimeout(() => {
      responseBox.innerHTML = data.answer || "Sorry, no reply received.";
      speakText(data.answer);
    }, 3000);
  } catch (err) {
    console.error("❌ AI Fetch Error:", err);
    responseBox.textContent =
      "Something went wrong — please try again in a moment.";
  }
}

// --- Text-to-Speech (Voice Output) ---
function speakText(text) {
  if (!text) return;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-GB";
  speech.pitch = 1;
  speech.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(speech);
}

// --- Manual Read-Aloud Button ---
speakBtn.addEventListener("click", () => {
  speakText(responseBox.textContent);
});

// --- Auto Greeting ---
window.addEventListener("load", () => {
  const greeting =
    "Welcome to GoLink — your live bus assistant for Plymouth and the South West. How can I help you today?";
  speakText(greeting);
});
