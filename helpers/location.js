// helpers/location.js
// Handles converting coordinates or place names into readable addresses or stop data

import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";

/**
 * Convert lat/lon into a readable location name.
 * @param {Number} lat 
 * @param {Number} lon 
 * @returns {Promise<String>}
 */
export async function getLocationName(lat, lon) {
  try {
    const url = `${NOMINATIM_BASE}?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Transi-Autopilot/1.0" },
    });
    const data = await res.json();
    return data?.display_name || "your current location";
  } catch (err) {
    console.error("📍 Reverse-geo lookup failed:", err);
    return "your location";
  }
}

/**
 * Convert a free-typed place (e.g. postcode or area) to coordinates.
 * @param {String} query 
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
export async function geocodePlace(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Transi-Autopilot/1.0" },
    });
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error("🗺️ Geocoding failed:", err);
    return null;
  }
}
