// =====================================
//  GoLink — Live Bus Assistant (v3.7)
//  Includes: Custom Icons + Nearby Stops + Live Tracking
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

// --- Custom Icons ---
const userIcon = L.divIcon({
  className: "user-marker",
  html: "<div></div>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const stopIcon = L.divIcon({
  className: "stop-marker",
  html: "<div></div>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// --- Wait until page fully loads ---
window.addEventListener("load", () => {
  console.log("✅ Page loaded, starting geolocation...");

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation.lat = pos.coords.latitude.toFixed(6);
        userLocation.lon = pos.coords.longitude.toFixed(6);
        console.log("📍 Location found:", userLocation);
        initMap(userLocation.lat, userLocation.lon);
      },
      (err) => {
        console.warn("⚠️ Geolocation denied:", err.message);
        userLocation.lat = 50.3755;
        userLocation.lon = -4.1427; // Plymouth fallback
        initMap(userLocation.lat, userLocation.lon);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  } else {
    console.warn("❌ Geolocation not supported");
    userLocation.lat = 50.3755;
    userLocation.lon = -4.1427;
    initMap(userLocation.lat, userLocation.lon);
  }

  const greet =
    "Welcome to GoLink — your live bus and travel assistant. I can show nearby stops, timetables, and live buses.";
  speakText(greet);
});

// --- Initialise map ---
async function initMap(lat, lon) {
  console.log("🗺️ Initialising map...");

  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.error("❌ Map container not found.");
    return;
  }

  map = L.map("map").setView([lat, lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // --- Your location marker ---
  const userMarker = L.marker([lat, lon], { icon: userIcon })
    .addTo(map)
    .bindPopup("📍 You are here")
    .openPopup();

  await loadNearbyStops(lat, lon);
  await updateLiveBuses(lat, lon);
  setInterval(() => updateLiveBuses(lat, lon), 30000);
}

// --- Load nearby bus stops ---
async function loadNearbyStops(lat, lon) {
  try {
    console.log("🚌 Fetching nearby stops...");
    const res = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
    const data = await res.json();

    if (!data.member || !data.member.length) {
      console.warn("⚠️ No nearby stops found");
      return;
    }

    nearbyStops = data.member.slice(0, 15);
    console.log(`✅ Found ${nearbyStops.length} nearby stops.`);

    nearbyStops.forEach((stop) => {
      if (!stop.latitude || !stop.longitude || !stop.atcocode) return;

      const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`
          <strong>${stop.name}</strong><br>${stop.locality || ""}<br>
          <button style="margin-top:5px;padding:5px 10px;background:#007bff;color:white;border:none;border-radius:6px;cursor:pointer;" onclick="getDepartures('${stop.atcocode}','${stop.name}')">
            🕒 View Next Buses
          </button>
        `);
    });
  } catch (err) {
    console.error("❌ loadNearbyStops error:", err);
  }
}

// --- Fetch and display timetable for a stop ---
async function getDepartures(atcocode, stopName = "") {
  if (!atcocode) {
    responseBox.textContent = "No stop code provided.";
    return;
  }

  responseBox.innerHTML = `<div class="loading">⏳ Fetching next buses...</div>`;

  try {
    const res = await fetch(`/api/departures/${atcocode}`);
    const data = await res.json();

    if (!data.departures) {
      responseBox.innerHTML = `<p>No live data for ${stopName || "this stop"}.</p>`;
      return;
    }

    let html = `<h3>🚏 ${stopName}</h3><ul class="departure-list">`;

    for (const route in data.departures) {
      data.departures[route].slice(0, 3).forEach((bus) => {
        const time =
          bus.expected_departure_time ||
          bus.aimed_departure_time ||
          "No time available";

        html += `
          <li>
            <b>${bus.line_name}</b> → ${bus.direction}
            <br><small>🕒 ${time}</small>
          </li>`;
      });
    }

    html += `</ul>`;
    responseBox.innerHTML = html;
    speakText(`Here are the next buses from ${stopName}.`);
  } catch (err) {
    console.error("❌ getDepartures error:", err);
    responseBox.textContent = "Could not fetch live departures.";
  }
}

// --- Update live bus positions ---
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
        html: `<div style="transform: rotate(${bus.bearing || 0}deg); font-size:18px;">🚌</div>`,
        iconSize: [24, 24],
      });

      if (busMarkers[bus.id]) {
        busMarkers[bus.id].setLatLng([bus.lat, bus.lon]);
      } else {
        const marker = L.marker([bus.lat, bus.lon], { icon })
          .addTo(map)
          .bindPopup(
            `<b>${bus.line}</b><br>${bus.direction || ""}<br>${
              bus.distance ? bus.distance.toFixed(2) + " km away" : ""
            }`
          );
        busMarkers[bus.id] = marker;
      }
    });

    // remove old markers
    Object.keys(busMarkers).forEach((id) => {
      if (!seen.has(id)) {
        map.removeLayer(busMarkers[id]);
        delete busMarkers[id];
      }
    });
  } catch (err) {
    console.warn("❌ updateLiveBuses error:", err);
  }
}

// --- AI question handler ---
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

// --- UI Controls ---
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

speakBtn.addEventListener("click", () => speakText(responseBox.textContent));

// --- Voice output ---
function speakText(text) {
  if (!text) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-GB";
  msg.rate = 1;
  msg.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}
