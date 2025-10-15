// =====================================
//  GoLink — Live Bus Assistant (Refined)
//  Version 3.4
//  Author: Ali
// =====================================

const askBtn = document.getElementById("askBtn");
const voiceBtn = document.getElementById("voiceBtn");
const speakBtn = document.getElementById("speakBtn");
const questionBox = document.getElementById("question");
const responseBox = document.getElementById("responseBox");

let userLocation = { lat: null, lon: null };
let map;
let busMarkers = {};
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
      // fallback: Plymouth city centre
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

// --- Initialise map ---
async function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup("📍 You are here").openPopup();

  await loadNearbyStops(lat, lon);
  await updateLiveBuses(lat, lon);
  setInterval(() => updateLiveBuses(lat, lon), 5000);
}

// --- Load nearby bus stops ---
async function loadNearbyStops(lat, lon) {
  try {
    const res = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.member) return;

    nearbyStops = data.member;
    nearbyStops.slice(0, 10).forEach((stop) => {
      if (!stop.atcocode) return;
      const m = L.marker([stop.latitude, stop.longitude]).addTo(map);
      m.bindPopup(`
        <strong>${stop.name}</strong><br>${stop.locality || ""}<br>
        <button onclick="getDepartures('${stop.atcocode}','${stop.name}')">🕒 Next Buses</button>
      `);
    });
  } catch (err) {
    console.error("❌ loadNearbyStops error:", err);
  }
}

// --- Show departures for a stop ---
async function getDepartures(atcocode, stopName = "") {
  if (!atcocode) return (responseBox.textContent = "No stop code provided.");
  responseBox.innerHTML = "⏳ Loading departures...";

  try {
    const res = await fetch(`/api/departures/${atcocode}`);
    const data = await res.json();

    if (!data.departures) {
      responseBox.innerHTML = `🚏 No live data for ${stopName || "this stop"}.`;
      return;
    }

    let html = `<h3>🚏 ${stopName}</h3><b>Next buses:</b><br>`;
    for (const route in data.departures) {
      const next = data.departures[route].slice(0, 3);
      html += `<b>${route}</b>: ${next
        .map((b) => `${b.expected_departure_time} → ${b.direction}`)
        .join("<br>")}<br><br>`;
    }

    responseBox.innerHTML = html;
    speakText(`Here are the next buses from ${stopName}.`);
  } catch (err) {
    console.error("❌ getDepartures error:", err);
    responseBox.textContent = "Could not fetch live departures.";
  }
}

// --- Fetch and update live buses (smoothly) ---
async function updateLiveBuses(lat, lon) {
  try {
    const res = await fetch(`/api/livebuses?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.buses) return;

    const seen = new Set();

    data.buses.slice(0, 20).forEach((bus) => {
      seen.add(bus.id);

      const icon = L.divIcon({
        className: "bus-icon",
        html: `<div style="transform: rotate(${bus.bearing}deg); font-size:18px;">🚌</div>`,
        iconSize: [24, 24],
      });

      if (busMarkers[bus.id]) {
        busMarkers[bus.id].setLatLng([bus.lat, bus.lon]);
      } else {
        const marker = L.marker([bus.lat, bus.lon], { icon })
          .addTo(map)
          .bindPopup(`<b>${bus.line}</b><br>${bus.distance.toFixed(2)} km away`);
        busMarkers[bus.id] = marker;
      }
    });

    // remove buses no longer visible
    Object.keys(busMarkers).forEach((id) => {
      if (!seen.has(id)) {
        map.removeLayer(busMarkers[id]);
        delete busMarkers[id];
      }
    });

    if (window.pulseLiveIndicator) window.pulseLiveIndicator();
  } catch (err) {
    console.warn("❌ updateLiveBuses error:", err);
  }
}

// --- AI assistant query ---
async function getAnswer(question) {
  responseBox.innerHTML = "⏳ Thinking...";
  try {
    const params = new URLSearchParams({
      q: question,
      lat: userLocation.lat || "",
      lon: userLocation.lon || "",
    });
    const res = await fetch(`/ask?${params.toString()}`);
    const data = await res.json();

    const answer = data.answer || "No reply available right now.";
    responseBox.innerHTML = `<b>💬 Answer:</b> ${answer}`;
    speakText(answer);
  } catch (err) {
    console.error("❌ getAnswer error:", err);
    responseBox.textContent = "Error contacting assistant.";
  }
}

// --- Button and voice input ---
askBtn.addEventListener("click", () => {
  const q = questionBox.value.trim();
  if (q) getAnswer(q);
});
questionBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getAnswer(questionBox.value.trim());
});
voiceBtn.addEventListener("click", () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech recognition not supported on this browser.");
    return;
  }
  const rec = new webkitSpeechRecognition();
  rec.lang = "en-GB";
  rec.start();
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    questionBox.value = text;
    getAnswer(text);
  };
});

// --- Speech output ---
speakBtn.addEventListener("click", () => speakText(responseBox.textContent));
function speakText(text) {
  if (!text) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-GB";
  msg.rate = 1;
  msg.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}

// --- Auto greeting ---
window.addEventListener("load", () => {
  const greet =
    "Welcome to GoLink — your live bus and travel assistant. I can show live buses near you or help you plan your route.";
  speakText(greet);
});
