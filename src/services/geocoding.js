/**
 * OSM Nominatim Geocoding Service with Dynamic Nearby Location Suggestion
 * Converts location text/address to Latitude & Longitude
 * Auto-suggests top nearby locations based on user input and selected PBT council.
 */

import { PRESET_SITES } from '../config/pbt-presets.js';
import { PBT_ALL_DATABASE } from '../config/pbt-database.js';
import { JurisdictionEngine } from './jurisdiction.js';
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
 * Strict validation: Ensures geographic coordinates and address details are located within Malaysia
 */
export function isWithinMalaysia(lat, lng, addressDetails = {}) {
  const cCode = (addressDetails.country_code || '').toLowerCase();
  const country = (addressDetails.country || '').toLowerCase();
  if (cCode && cCode !== 'my') return false;
  if (country && country !== 'malaysia' && !country.includes('malaysia')) return false;

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    // Quick outer bounding box check
    if (lat < 0.5 || lat > 8.0 || lng < 99.0 || lng > 120.0) {
      return false;
    }
  }
  return true;
}

/**
 * Geocodes location text to Lat/Lng (strictly restricted to Malaysia)
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

  // 3. Live Nominatim Search with strict Malaysia countrycodes & bounding box
  try {
    await throttleRequest();

    const params = new URLSearchParams({
      q: cleanQuery,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'my', // Restrict strictly to Malaysia
      viewbox: '99.5,7.6,119.5,0.8', // Malaysia Bounding Box
      bounded: '1' // Force results within Malaysia bounding box
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
        const malaysiaResults = results.filter((item) =>
          isWithinMalaysia(parseFloat(item.lat), parseFloat(item.lon), item.address || {})
        );

        if (malaysiaResults.length > 0) {
          const best = malaysiaResults[0];
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
    }
  } catch (err) {
    if (signal && signal.aborted) throw err;
    console.warn('[Nominatim Geocoding] Live search error/timeout, falling back:', err.message);
  }

  // 4. Fallback to preset site match
  if (presetMatch) {
    const presetPayload = {
      lat: presetMatch.lat,
      lng: presetMatch.lng,
      displayName: `${presetMatch.name}`,
      type: 'preset',
      bbox: [presetMatch.lat - 0.01, presetMatch.lat + 0.01, presetMatch.lng - 0.01, presetMatch.lng + 0.01],
      addressDetails: { state: presetMatch.zoneCategory || 'Wilayah Persekutuan Kuala Lumpur' },
      raw: presetMatch
    };
    CacheService.set('geocode', cleanQuery, presetPayload);
    return { ...presetPayload, fromCache: true, cacheSource: 'preset' };
  }

  // 5. Intelligent Fallback matching 156 Malaysian PBT municipal keywords & regions
  const matchedPbt = JurisdictionEngine.detectPBTFromLocation(0, 0, cleanQuery, {});

  if (matchedPbt) {
    const pbtPayload = {
      lat: matchedPbt.lat,
      lng: matchedPbt.lng,
      displayName: `${cleanQuery}, ${matchedPbt.name}, ${matchedPbt.stateName}`,
      type: 'pbt_fallback',
      bbox: [matchedPbt.lat - 0.02, matchedPbt.lat + 0.02, matchedPbt.lng - 0.02, matchedPbt.lng + 0.02],
      addressDetails: {
        city: matchedPbt.name,
        state: matchedPbt.stateName,
        county: matchedPbt.shortName
      },
      raw: matchedPbt
    };
    CacheService.set('geocode', cleanQuery, pbtPayload);
    return { ...pbtPayload, fromCache: true, cacheSource: 'pbt_database' };
  }

  // 6. Absolute default fallback
  const fallbackPayload = {
    lat: 3.1408,
    lng: 101.6932,
    displayName: `${cleanQuery} (Lokasi Anggaran)`,
    type: 'fallback',
    bbox: [3.13, 3.15, 101.68, 101.70],
    addressDetails: { state: 'Wilayah Persekutuan Kuala Lumpur' },
    raw: null
  };
  return { ...fallbackPayload, fromCache: true, cacheSource: 'fallback' };
}

/**
 * Reverse Geocode coordinates to Address
 */
export async function reverseGeocode(lat, lng, signal = null) {
  if (lat < 0.5 || lat > 8.0 || lng < 99.0 || lng > 120.0) {
    return {
      lat,
      lng,
      displayName: `Tapak Di Luar Wilayah Malaysia (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      addressDetails: { country: 'Luar Negara', country_code: 'foreign' }
    };
  }

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
    if (signal && signal.aborted) throw err;
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
 * Fetches top nearby location suggestions dynamically based on user input or selected PBT (strictly Malaysia)
 */
export async function fetchNearbySuggestions(queryText = '', pbtInfo = null) {
  const clean = queryText.trim();
  const suggestions = [];

  // 1. If query is provided (>= 2 chars), search live Nominatim + local PBT & Presets
  if (clean.length >= 2) {
    const qLower = clean.toLowerCase();

    // Check Preset sites first
    PRESET_SITES.forEach((p) => {
      if (p.name.toLowerCase().includes(qLower) || qLower.includes(p.name.toLowerCase().split(',')[0].trim())) {
        const pbt = PBT_ALL_DATABASE.find((c) => c.id === p.pbtId);
        suggestions.push({
          id: p.id,
          name: p.name.split(',')[0].trim(),
          fullName: p.name,
          subtitle: pbt ? `${pbt.name} • ${pbt.stateName}` : 'Cadangan Tapak Utama',
          lat: p.lat,
          lng: p.lng,
          pbtId: p.pbtId,
          badge: pbt ? pbt.shortName : 'PRESET',
          type: 'preset'
        });
      }
    });

    // Check 156 PBT Database matches
    PBT_ALL_DATABASE.forEach((p) => {
      const matchKeyword = p.keywords && p.keywords.some((kw) => kw.toLowerCase().includes(qLower) || qLower.includes(kw.toLowerCase()));
      const matchName = p.name.toLowerCase().includes(qLower) || p.shortName.toLowerCase() === qLower || p.stateName.toLowerCase().includes(qLower);

      if ((matchKeyword || matchName) && !suggestions.some((s) => s.name.toLowerCase() === p.name.toLowerCase())) {
        suggestions.push({
          id: `pbt-${p.id}`,
          name: p.name,
          fullName: `${p.name}, ${p.stateName}`,
          subtitle: `${p.tierLabel} • ${p.stateName}`,
          lat: p.lat,
          lng: p.lng,
          pbtId: p.id,
          badge: p.shortName,
          type: 'pbt'
        });
      }
    });

    // Query Nominatim Live with strict Malaysia restriction (if suggestions < 5)
    if (suggestions.length < 5) {
      try {
        await throttleRequest();
        const params = new URLSearchParams({
          q: clean,
          format: 'json',
          addressdetails: '1',
          limit: '6',
          countrycodes: 'my', // Restrict strictly to Malaysia
          viewbox: '99.5,7.6,119.5,0.8', // Malaysia Bounding Box
          bounded: '1'
        });

        const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
        });

        if (response.ok) {
          const items = await response.json();
          items.forEach((item, i) => {
            const parts = item.display_name.split(',');
            const shortName = parts.slice(0, 2).join(',').trim();
            const itemLat = parseFloat(item.lat);
            const itemLng = parseFloat(item.lon);

            if (!isWithinMalaysia(itemLat, itemLng, item.address || {})) {
              return; // Skip non-Malaysia results
            }

            const matchedPbt = JurisdictionEngine.detectPBTFromLocation(
              itemLat,
              itemLng,
              item.display_name,
              item.address || {}
            );

            if (!suggestions.some((s) => Math.abs(s.lat - itemLat) < 0.005 && Math.abs(s.lng - itemLng) < 0.005)) {
              suggestions.push({
                id: `geo-sug-${i}`,
                name: shortName,
                fullName: item.display_name,
                subtitle: matchedPbt ? `${matchedPbt.name} • ${matchedPbt.stateName}` : 'Malaysia',
                lat: itemLat,
                lng: itemLng,
                pbtId: matchedPbt ? matchedPbt.id : '',
                badge: matchedPbt ? matchedPbt.shortName : 'PBT',
                type: 'nominatim'
              });
            }
          });
        }
      } catch {
        // Fallback to local matches
      }
    }
  }

  // 2. If query is empty or short, suggest top locations for the current PBT
  if (suggestions.length === 0 && pbtInfo) {
    // Add preset for this PBT
    const pbtPresets = PRESET_SITES.filter((p) => p.pbtId === pbtInfo.id);
    pbtPresets.forEach((p) => {
      suggestions.push({
        id: p.id,
        name: p.name.split(',')[0].trim(),
        fullName: p.name,
        subtitle: `${pbtInfo.name} • ${pbtInfo.stateName}`,
        lat: p.lat,
        lng: p.lng,
        pbtId: p.pbtId,
        badge: pbtInfo.shortName,
        type: 'preset'
      });
    });

    // Add key sub-districts from PBT keywords
    if (pbtInfo.keywords) {
      pbtInfo.keywords.slice(0, 4).forEach((kw, i) => {
        const formattedKw = kw.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (!suggestions.some((s) => s.name.toLowerCase() === formattedKw.toLowerCase())) {
          suggestions.push({
            id: `pbt-kw-${i}`,
            name: formattedKw,
            fullName: `${formattedKw}, ${pbtInfo.name}`,
            subtitle: `${pbtInfo.name} (${pbtInfo.shortName})`,
            lat: pbtInfo.lat,
            lng: pbtInfo.lng,
            pbtId: pbtInfo.id,
            badge: pbtInfo.shortName,
            type: 'pbt'
          });
        }
      });
    }
  }

  // 3. Absolute fallback to national top landmarks
  if (suggestions.length === 0) {
    return PRESET_SITES.slice(0, 4).map((p) => {
      const pbt = PBT_ALL_DATABASE.find((c) => c.id === p.pbtId);
      return {
        id: p.id,
        name: p.name.split(',')[0].trim(),
        fullName: p.name,
        subtitle: pbt ? `${pbt.name} • ${pbt.stateName}` : 'Malaysia',
        lat: p.lat,
        lng: p.lng,
        pbtId: p.pbtId,
        badge: pbt ? pbt.shortName : 'PBT',
        type: 'preset'
      };
    });
  }

  return suggestions.slice(0, 5);
}
