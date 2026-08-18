/**
 * OSM Nominatim Geocoding Service with Dynamic Nearby Location Suggestion
 * Converts location text/address to Latitude & Longitude
 * Auto-suggests top nearby locations based on user input and selected PBT council.
 */

import { PRESET_SITES } from '../config/pbt-presets.js';
import { CacheService } from './cache.js';

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
 */
export async function geocodeLocation(query, signal = null) {
  if (!query || !query.trim()) {
    throw new Error('Sila masukkan nama tapak atau lokasi cadangan.');
  }

  const cleanQuery = query.trim();

  // 1. Check Multi-tier Cache First (if enabled)
  const cached = CacheService.get('geocode', cleanQuery);
  if (cached && cached.data) {
    return { ...cached.data, fromCache: true, cacheSource: cached.source };
  }

  // 2. Check preset site matches
  const presetMatch = PRESET_SITES.find(
    (p) => p.name.toLowerCase().includes(cleanQuery.toLowerCase()) || cleanQuery.toLowerCase().includes(p.name.toLowerCase().split(',')[0].trim())
  );

  // 3. Live Nominatim Search with rate-limiting & abort signal support
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

    const onExternalAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onExternalAbort);

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);

    if (response.status === 429) {
      console.warn('[Nominatim] HTTP 429 Rate Limit encountered. Falling back to local GIS index.');
    } else if (response.ok) {
      const results = await response.json();

      if (results && results.length > 0) {
        const best = results[0];
        const resultPayload = {
          lat: parseFloat(best.lat),
          lng: parseFloat(best.lon),
          displayName: best.display_name,
          type: best.type || best.class || 'location',
          bbox: best.boundingbox ? best.boundingbox.map(Number) : null,
          addressDetails: best.address || {},
          raw: best
        };

        CacheService.set('geocode', cleanQuery, resultPayload);
        return { ...resultPayload, fromCache: false };
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('[Nominatim Geocoding] Live search error/timeout, falling back:', err.message);
  }

  // 4. Fallback to preset or realistic regional coordinates
  if (presetMatch) {
    const presetPayload = {
      lat: presetMatch.lat,
      lng: presetMatch.lng,
      displayName: `${presetMatch.name} (Mod Luar Talian / Preset)`,
      type: 'preset',
      bbox: [presetMatch.lat - 0.01, presetMatch.lat + 0.01, presetMatch.lng - 0.01, presetMatch.lng + 0.01],
      addressDetails: { state: presetMatch.zoneCategory || 'Wilayah Persekutuan Kuala Lumpur' },
      raw: presetMatch
    };
    CacheService.set('geocode', cleanQuery, presetPayload);
    return { ...presetPayload, fromCache: true, cacheSource: 'preset' };
  }

  // Default fallback
  const fallbackPayload = {
    lat: 3.1612,
    lng: 101.7088,
    displayName: `${cleanQuery} (Lokasi Anggaran)`,
    type: 'fallback',
    bbox: [3.15, 3.17, 101.69, 101.72],
    addressDetails: { state: 'W.P. Kuala Lumpur' },
    raw: null
  };
  return { ...fallbackPayload, fromCache: true, cacheSource: 'fallback' };
}

/**
 * Reverse Geocode coordinates to Address
 */
export async function reverseGeocode(lat, lng, signal = null) {
  const coordKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const cached = CacheService.get('reverse', coordKey);
  if (cached && cached.data) {
    return cached.data;
  }

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

    const onExternalAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onExternalAbort);

    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);

    if (response.ok) {
      const data = await response.json();
      const addr = {
        lat,
        lng,
        displayName: data.display_name,
        addressDetails: data.address || {}
      };
      CacheService.set('reverse', coordKey, addr);
      return addr;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('[Reverse Geocode] Failed:', err.message);
  }

  return {
    lat,
    lng,
    displayName: `Tapak Ditanda (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    addressDetails: {}
  };
}

/**
 * Fetches top nearby location suggestions dynamically based on user input or selected PBT
 */
export async function fetchNearbySuggestions(queryText = '', pbtInfo = null) {
  const clean = queryText.trim();
  const suggestions = [];

  // If query is provided, query Nominatim live for top 4 matches
  if (clean.length >= 3) {
    try {
      await throttleRequest();
      const params = new URLSearchParams({
        q: `${clean}, Malaysia`,
        format: 'json',
        addressdetails: '1',
        limit: '4',
        countrycodes: 'my'
      });

      const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
      });

      if (response.ok) {
        const items = await response.json();
        items.forEach((item, i) => {
          const parts = item.display_name.split(',');
          const shortName = parts.slice(0, 2).join(',').trim();
          suggestions.push({
            id: `geo-sug-${i}`,
            name: shortName,
            fullName: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            addressDetails: item.address || {}
          });
        });
      }
    } catch (e) {
      // ignore
    }
  }

  // If no suggestions from query or query is short, generate relevant sub-districts for the current PBT
  if (suggestions.length === 0 && pbtInfo) {
    const pbtKeywords = pbtInfo.keywords || [];
    const pbtPresets = PRESET_SITES.filter(p => p.pbtId === pbtInfo.id);

    pbtPresets.forEach(p => {
      suggestions.push({
        id: p.id,
        name: p.name.split(',')[0].trim(),
        fullName: p.name,
        lat: p.lat,
        lng: p.lng,
        pbtId: p.pbtId,
        defaultUnits: p.defaultUnits,
        developmentType: p.developmentType
      });
    });

    // Add keyword based locations if fewer than 4
    pbtKeywords.forEach((kw, i) => {
      if (suggestions.length < 4 && !suggestions.some(s => s.name.toLowerCase() === kw.toLowerCase())) {
        const offsetLat = pbtInfo.center[0] + (i * 0.008 - 0.012);
        const offsetLng = pbtInfo.center[1] + (i * 0.008 - 0.012);
        suggestions.push({
          id: `pbt-kw-${i}`,
          name: kw.charAt(0).toUpperCase() + kw.slice(1),
          fullName: `${kw.charAt(0).toUpperCase() + kw.slice(1)}, ${pbtInfo.name}`,
          lat: offsetLat,
          lng: offsetLng,
          pbtId: pbtInfo.id
        });
      }
    });
  }

  // Fallback to top national presets if still empty
  if (suggestions.length === 0) {
    return PRESET_SITES.slice(0, 4).map(p => ({
      id: p.id,
      name: p.name.split(',')[0].trim(),
      fullName: p.name,
      lat: p.lat,
      lng: p.lng,
      pbtId: p.pbtId,
      defaultUnits: p.defaultUnits,
      developmentType: p.developmentType
    }));
  }

  return suggestions.slice(0, 4);
}
