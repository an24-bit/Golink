// =====================================
//  GoLink — Live Bus Assistant (v3.9)
//  Includes: Custom Icons + OSM Stops + Inline Timetable
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
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation.lat = pos.coords.latitude.toFixed(6);
        userLocation.lon = pos.coords.longitude.toFixed(6);
        initMap(userLocation.lat, userLocation.lon);
      },
      (err) => {
        console.warn("⚠️ Geolocation denied:", err.message);
        userLocation = { lat: 50.3755, lon: -4.1427 }; // Plymouth fallback
        initMap(userLocation.lat, userLocation.lon);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  } else {
    console.warn("❌ Geolocation not supported");
    userLocation = { lat: 50.3755, lon: -4.1427 };
    initMap(userLocation.lat, userLocation.lon);
  }

  speakText(
    "Welcome to GoLink — your live bus and travel assistant. I can show nearby stops, timetables, and live buses."
  );
});

// --- Initialise map ---
async function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  L.marker([lat, lon], { icon: userIcon })
    .addTo(map)
    .bindPopup("📍 You are here")
    .openPopup();

  await loadNearbyStops(lat, lon); // now uses OSM data
  await updateLiveBuses(lat, lon);
  setInterval(() => updateLiveBuses(lat, lon), 30000);
}

// --- Load nearby bus stops (OSM Overpass API) ---
async function loadNearbyStops(lat, lon) {
  try {
    console.log("🚌 Fetching nearby OSM bus stops...");
    const radius = 600; // metres
    const query = `
      [out:json];
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      out;`;
    const res = await fetch(
      "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query)
    );
    const json = await res.json();

    nearbyStops = json.elements || [];
    console.log(`✅ Found ${nearbyStops.length} nearby stops.`);

    nearbyStops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon })
        .addTo(map)
        .on("click", () =>
          getDeparturesInline(stop.id, stop.tags.name || "Unnamed Stop", marker)
        );
    });
  } catch (err) {
    console.error("❌ loadNearbyStops (OSM) error:", err);
  }
}

// --- Inline Timetable Popup (TransportAPI departures) ---
async function getDeparturesInline(stopId, stopName, marker) {
  try {
    // fallback: if you still have /api/departures using TransportAPI for times
    const res = await fetch(`/api/departures/${stopId}`);
    const data = await res.json();

    if (!data.departures || Object.keys(data.departures).length === 0) {
      marker
        .bindPopup(`<b>${stopName}</b><br>No live data available.`)
        .openPopup();
      return;
    }

    let html = `<div style="min-width:180px">
      <b>🚏 ${stopName}</b><br><hr style="border:0.5px solid #ccc">
      <ul style="list-style:none;padding:0;margin:0;">`;

    let count = 0;
    for (const route in data.departures) {
      for (const bus of data.departures[route]) {
        if (count >= 5) break;
        const time =
          bus.expected_departure_time || bus.aimed_departure_time || "– –";
        const dirArrow =
          bus.direction && /centre|city/i.test(bus.direction) ? "⬅️" : "➡️";
        html += `
          <li style="margin:4px 0;padding:3px 0;border-bottom:1px solid #222;">
            ${dirArrow} <b>${bus.line_name}</b> → ${bus.direction || ""}
            <br><small>🕒 ${time}</small>
          </li>`;
        count++;
      }
      if (count >= 5) break;
    }

    html += `</ul></div>`;
    marker.bindPopup(html).openPopup();
  } catch (err) {
    console.error("❌ getDeparturesInline error:", err);
    marker
      .bindPopup(`<b>${stopName}</b><br>Unable to fetch timetable.`)
      .openPopup();
  }
}

// --- Update live bus positions (still uses TransportAPI) ---
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

// --- AI Q&A ---
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
    responseBox.textContent = "Error contacting assistant.";
  }
}

// --- Controls ---
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
