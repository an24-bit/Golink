// =====================================
//  GoLink — Live Bus Assistant (Refined)
//  Version 3.3
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
let nearbyStops = [];

// --- Detect user location and initialise map ---
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation.lat = pos.coords.latitude.toFixed(6);
      userLocation.lon = pos.coords.longitude.toFixed(6);
      console.log("📍 Location:", userLocation);
      initMap(userLocation.lat, userLocation.lon);
    },
    (err) => {
      console.warn("⚠️ Geolocation denied:", err.message);
      // fallback to Plymouth centre
      userLocation.lat = 50.3755;
      userLocation.lon = -4.1427;
      initMap(userLocation.lat, userLocation.lon);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
} else {
  console.warn("❌ Geolocation unsupported");
  userLocation.lat = 50.3755;
  userLocation.lon = -4.1427;
  initMap(userLocation.lat, userLocation.lon);
}

// --- Initialise map with Leaflet ---
async function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // user marker
  const marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup("📍 You are here").openPopup();

  // fetch stops and buses
  await loadNearbyStops(lat, lon);
  await updateLiveBuses(lat, lon);

  // schedule periodic updates
  setInterval(() => updateLiveBuses(lat, lon), 5000);
}

// --- Fetch and display nearby stops ---
async function loadNearbyStops(lat, lon) {
  try {
    const res = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.member) return;

    nearbyStops = data.member;

    nearbyStops.slice(0, 5).forEach((stop) => {
      const m = L.marker([stop.latitude, stop.longitude]).addTo(map);
      m.bindPopup(
        `<strong>${stop.name}</strong><br>${stop.locality || ""}<br>
        <button onclick="getDepartures('${stop.atcocode}')">🕒 Next Buses</button>`
      );
    });
  } catch (err) {
    console.error("❌ loadNearbyStops error:", err);
  }
}

// --- Get live departures for a stop ---
async function getDepartures(atcocode) {
  if (!atcocode) {
    responseBox.textContent = "No stop code provided.";
    return;
  }
  responseBox.textContent = "⏳ Loading departures...";
  try {
    const res = await fetch(`/api/departures/${atcocode}`);
    const data = await res.json();

    if (!data.departures) {
      responseBox.textContent = "No live data for this stop.";
      return;
    }

    let html = `🚏 <strong>Next buses:</strong><br>`;
    for (const route in data.departures) {
      data.departures[route].forEach((bus) => {
        html += `${bus.line_name} → ${bus.direction} — ${bus.expected_departure_time}<br>`;
      });
    }
    responseBox.innerHTML = html;
    speakText("Here are the next buses at that stop.");
  } catch (err) {
    console.error("❌ getDepartures error:", err);
    responseBox.textContent = "Could not fetch departures.";
  }
}

// --- Fetch and plot live buses ---
async function updateLiveBuses(lat, lon) {
  try {
    const res = await fetch(`/api/livebuses?lat=${lat}&lon=${lon}`);
    const data = await res.json();

    // remove old markers
    busMarkers.forEach((m) => map.removeLayer(m));
    busMarkers = [];

    if (!data.buses || data.buses.length === 0) {
      // nothing to show
      return;
    }

    data.buses.slice(0, 10).forEach((bus) => {
      const icon = L.divIcon({
        className: "live-bus",
        html: `🚌<div class="bus-label">${bus.line}</div>`,
        iconSize: [25, 25],
      });
      const m = L.marker([bus.lat, bus.lon], { icon }).addTo(map);
      m.bindPopup(
        `<strong>${bus.line}</strong><br>${bus.distance.toFixed(2)} km away`
      );
      busMarkers.push(m);
    });

    if (window.pulseLiveIndicator) window.pulseLiveIndicator();
  } catch (err) {
    console.warn("❌ updateLiveBuses error:", err);
  }
}

// --- Ask (AI) request ---
async function getAnswer(question) {
  responseBox.textContent = "⏳ Thinking…";
  try {
    const params = new URLSearchParams({
      q: question,
      lat: userLocation.lat || "",
      lon: userLocation.lon || "",
    });
    const res = await fetch(`/ask?${params.toString()}`);
    const data = await res.json();
    setTimeout(() => {
      responseBox.innerHTML = data.answer || "No reply.";
      speakText(data.answer);
    }, 2000);
  } catch (err) {
    console.error("❌ getAnswer error:", err);
    responseBox.textContent =
      "Something went wrong. Please try again.";
  }
}

// --- Button events ---
askBtn.addEventListener("click", () => {
  const q = questionBox.value.trim();
  if (q) getAnswer(q);
});
questionBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getAnswer(questionBox.value.trim());
});
voiceBtn.addEventListener("click", () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech recognition not supported.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-GB";
  recognition.start();
  recognition.onresult = (ev) => {
    const t = ev.results[0][0].transcript;
    questionBox.value = t;
    getAnswer(t);
  };
});
speakBtn.addEventListener("click", () => {
  speakText(responseBox.textContent);
});

// --- Speech output ---
function speakText(text) {
  if (!text) return;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-GB";
  speech.rate = 1;
  speech.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(speech);
}

// --- Auto Greeting ---
window.addEventListener("load", () => {
  const greeting =
    "Welcome to GoLink — your live bus assistant for Plymouth and beyond. Ask me anything about your bus.";
  speakText(greeting);
});
