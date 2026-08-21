import elevationRulesData from '../data/elevation-rules.json' with { type: 'json' };

const OPEN_METEO_ELEVATION_ENDPOINT = 'https://api.open-meteo.com/v1/elevation';

export const ELEVATION_RULES_DATABASE = elevationRulesData;
export const SLOPE_CLASSES_DATABASE = elevationRulesData.slopeClasses;
export const ELEVATION_LIMITS_DATABASE = elevationRulesData.elevationLimits;

/**
 * Classifies slope angle into Malaysian Statutory Slope Classes (PLANMalaysia GP007 / JKR / JUPEM)
 * Loads rule definitions dynamically from src/data/elevation-rules.json
 * 
 * @param {number} slopeDeg - Slope angle in degrees
 * @returns {{ slopeClass: string, slopeClassLabel: string, description: string, category: string, severity: string, hazardLevel: string, requiredDocuments: Array<string> }}
 */
export function classifyMalaysianSlope(slopeDeg) {
  // Find matching slope class from JSON database
  for (const rule of SLOPE_CLASSES_DATABASE) {
    if (slopeDeg >= rule.minDegree && slopeDeg <= rule.maxDegree) {
      return {
        slopeClass: rule.id,
        slopeClassLabel: rule.label,
        description: rule.description,
        category: rule.category,
        severity: rule.severity,
        hazardLevel: rule.hazardLevel,
        requiredDocuments: rule.requiredDocuments || []
      };
    }
  }

  // Fallback to lowest slope class (Kelas I)
  const defaultRule = SLOPE_CLASSES_DATABASE[SLOPE_CLASSES_DATABASE.length - 1];
  return {
    slopeClass: defaultRule.id,
    slopeClassLabel: defaultRule.label,
    description: defaultRule.description,
    category: defaultRule.category,
    severity: defaultRule.severity,
    hazardLevel: defaultRule.hazardLevel,
    requiredDocuments: defaultRule.requiredDocuments || []
  };
}

/**
 * Fetches satellite terrain elevation and calculates ground slope gradient
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timeoutMs - Max timeout in milliseconds
 * @returns {Promise<{
 *   elevation: number,
 *   slopeDegrees: number,
 *   slopePercent: number,
 *   slopeClass: string,
 *   slopeClassLabel: string,
 *   slopeDescription: string,
 *   isHillside: boolean,
 *   source: string
 * }>}
 */
export async function fetchTerrainElevation(lat, lng, timeoutMs = 3500) {
  const dOffset = 0.00045; // ~50 meters offset at equator for 5-point cardinal grid
  const lats = [lat, lat + dOffset, lat - dOffset, lat, lat].join(',');
  const lngs = [lng, lng, lng, lng + dOffset, lng - dOffset].join(',');
  const url = `${OPEN_METEO_ELEVATION_ENDPOINT}?latitude=${lats}&longitude=${lngs}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Elevation API returned status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.elevation || data.elevation.length < 5) {
      throw new Error('Incomplete elevation grid data returned.');
    }

    const [centerElev, northElev, southElev, eastElev, westElev] = data.elevation;

    // Baseline distance: ~50 meters per offset (100m total across N-S and E-W)
    const spanMeters = 100;
    const slopeNS = Math.abs(northElev - southElev) / spanMeters;
    const slopeEW = Math.abs(eastElev - westElev) / spanMeters;

    // Vector magnitude of terrain grade
    const slopeGrade = Math.sqrt(slopeNS * slopeNS + slopeEW * slopeEW);
    const slopeDegrees = Math.round(Math.atan(slopeGrade) * (180 / Math.PI) * 10) / 10;
    const slopePercent = Math.round(slopeGrade * 100 * 10) / 10;

    const classification = classifyMalaysianSlope(slopeDegrees);

    return {
      elevation: Math.round(centerElev),
      slopeDegrees,
      slopePercent,
      slopeClass: classification.slopeClass,
      slopeClassLabel: classification.slopeClassLabel,
      slopeDescription: classification.description,
      isHillside: centerElev > 76 || slopeDegrees >= 15,
      source: 'Open-Meteo DEM (Copernicus 30m / SRTM Satellite)'
    };
  } catch (err) {
    console.warn('[Elevation Service] Gagal menarik data DEM, guna unjuran lalai:', err.message);

    // Fallback safe estimate
    const defaultElev = 25;
    const defaultSlope = 2.0;
    const classification = classifyMalaysianSlope(defaultSlope);

    return {
      elevation: defaultElev,
      slopeDegrees: defaultSlope,
      slopePercent: 3.5,
      slopeClass: classification.slopeClass,
      slopeClassLabel: classification.slopeClassLabel,
      slopeDescription: classification.description,
      isHillside: false,
      source: 'Unjuran Topografi Piawai (Fallback)'
    };
  }
}
