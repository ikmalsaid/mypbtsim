/**
 * OSM Nominatim Geocoding Service
 * Converts location text/address to Latitude & Longitude
 * Includes reverse geocoding and fallback fuzzy matching.
 */

import { PRESET_SITES } from '../config/pbt-presets.js';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'MyPBTSim-TownPlanningSimulation/1.0 (urbanplanning@mypbtsim.gov.my)';

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1050; // Respect OSM Nominatim 1 req/sec policy

async function throttleRequest() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Geocodes location text to Lat/Lng
 * @param {string} query Search text (e.g., "Kampung Baru, Kuala Lumpur")
 * @returns {Promise<{lat: number, lng: number, displayName: string, bbox: number[], raw: object}>}
 */
export async function geocodeLocation(query) {
  if (!query || !query.trim()) {
    throw new Error('Sila masukkan nama tapak atau lokasi cadangan.');
  }

  const cleanQuery = query.trim();

  // 1. Check if matches any preset site directly first for instant zero-latency feedback
  const presetMatch = PRESET_SITES.find(
    (p) => p.name.toLowerCase().includes(cleanQuery.toLowerCase()) || cleanQuery.toLowerCase().includes(p.name.toLowerCase().split(',')[0].trim())
  );

  // 2. Perform live Nominatim search with Malaysia bias
  try {
    await throttleRequest();

    const params = new URLSearchParams({
      q: cleanQuery,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'my' // Biased to Malaysia
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}: ${response.statusText}`);
    }

    const results = await response.json();

    if (results && results.length > 0) {
      const best = results[0];
      return {
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lon),
        displayName: best.display_name,
        type: best.type || best.class || 'location',
        bbox: best.boundingbox ? best.boundingbox.map(Number) : null,
        raw: best
      };
    }
  } catch (err) {
    console.warn('[Nominatim Geocoding] Live search error or timeout, falling back:', err.message);
  }

  // 3. Fallback to preset or fallback coordinates if live API is throttled/offline
  if (presetMatch) {
    return {
      lat: presetMatch.lat,
      lng: presetMatch.lng,
      displayName: `${presetMatch.name} (Mod Luar Talian / Preset)`,
      type: 'preset',
      bbox: [presetMatch.lat - 0.01, presetMatch.lat + 0.01, presetMatch.lng - 0.01, presetMatch.lng + 0.01],
      raw: presetMatch
    };
  }

  // Default fallback to central Kuala Lumpur
  return {
    lat: 3.1612,
    lng: 101.7088,
    displayName: `${cleanQuery} (Lokasi Anggaran / Koordinat Lalai)`,
    type: 'fallback',
    bbox: [3.15, 3.17, 101.69, 101.72],
    raw: null
  };
}

/**
 * Reverse Geocode: Get address string from coordinates
 */
export async function reverseGeocode(lat, lng) {
  try {
    await throttleRequest();

    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      zoom: '18',
      addressdetails: '1'
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    }
  } catch (err) {
    console.warn('[Nominatim Reverse] Error:', err.message);
  }

  return `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
