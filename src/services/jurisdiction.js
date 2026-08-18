/**
 * PBT Jurisdiction & Boundary Matching Engine
 * Validates that the selected Local Council matches the physical spatial location of the proposed site.
 * Prevents invalid KM submissions to wrong local authorities under Seksyen 19 Akta 172 / Akta 267.
 */

import * as turf from '@turf/turf';
import { PBT_ALL_DATABASE } from '../config/pbt-database.js';

export class JurisdictionEngine {
  /**
   * Identifies the exact PBT governing the specified coordinates and address
   * @param {number} lat
   * @param {number} lng
   * @param {string} addressString
   * @param {object} rawAddressDetails Nominatim address components
   * @returns {object} Matching PBT object from database
   */
  static detectPBTFromLocation(lat, lng, addressString = '', rawAddressDetails = {}) {
    const cleanAddress = addressString.toLowerCase();
    const sitePoint = turf.point([lng, lat]);

    // 1. Keyword / Municipal name matching from Nominatim details
    const textToMatch = [
      rawAddressDetails.city || '',
      rawAddressDetails.municipality || '',
      rawAddressDetails.county || '',
      rawAddressDetails.state_district || '',
      rawAddressDetails.town || '',
      rawAddressDetails.suburb || '',
      rawAddressDetails.state || '',
      cleanAddress
    ].join(' ').toLowerCase();

    // 1. Keyword / Municipal name matching from Nominatim details
    let bestKeywordMatch = null;
    let maxKeywordHits = 0;

    for (const pbt of PBT_ALL_DATABASE) {
      let hits = 0;
      for (const kw of pbt.keywords) {
        if (textToMatch.includes(kw.toLowerCase())) {
          hits += kw.length; // weight by keyword specificity
        }
      }
      if (textToMatch.includes(pbt.shortName.toLowerCase())) {
        hits += 10;
      }
      if (hits > maxKeywordHits) {
        maxKeywordHits = hits;
        bestKeywordMatch = pbt;
      }
    }

    // If strong keyword match found, return immediately
    if (bestKeywordMatch && maxKeywordHits > 0) {
      return bestKeywordMatch;
    }

    // 2. Geodesic distance calculation to PBT centers
    // Filter by state first if state is present in address text
    const matchedStatePbts = PBT_ALL_DATABASE.filter((p) =>
      textToMatch.includes(p.stateName.toLowerCase()) || textToMatch.includes(p.stateId.toLowerCase())
    );

    const candidates = matchedStatePbts.length > 0 ? matchedStatePbts : PBT_ALL_DATABASE;

    let nearestPbt = null;
    let minDistanceKm = Infinity;

    for (const pbt of candidates) {
      const pbtPoint = turf.point([pbt.lng, pbt.lat]);
      const distKm = turf.distance(sitePoint, pbtPoint, { units: 'kilometers' });

      if (distKm < minDistanceKm) {
        minDistanceKm = distKm;
        nearestPbt = pbt;
      }
    }

    return nearestPbt || PBT_ALL_DATABASE[0];
  }

  /**
   * Helper alias to find matching PBT wrapper
   */
  static findMatchingPbt(lat, lng, addressString = '', rawAddressDetails = {}) {
    const pbt = this.detectPBTFromLocation(lat, lng, addressString, rawAddressDetails);
    return { pbt, matched: !!pbt };
  }

  /**
   * Validates if the selected PBT matches the detected site location
   * @param {string} selectedPbtId
   * @param {number} lat
   * @param {number} lng
   * @param {string} addressString
   * @param {object} rawAddressDetails
   * @returns {object} Validation status & auto-sync recommendation
   */
  static validateJurisdiction(selectedPbtId, lat, lng, addressString = '', rawAddressDetails = {}) {
    const selectedPbt = PBT_ALL_DATABASE.find((p) => p.id === selectedPbtId) || PBT_ALL_DATABASE[0];
    const detectedPbt = this.detectPBTFromLocation(lat, lng, addressString, rawAddressDetails);

    const isExactMatch = selectedPbt.id === detectedPbt.id;
    const isSameState = selectedPbt.stateId === detectedPbt.stateId;

    if (isExactMatch) {
      return {
        isValid: true,
        status: 'MATCHED',
        badgeColor: '#10b981',
        selectedPbt,
        detectedPbt,
        title: 'Bidang Kuasa Sah',
        message: `Tapak cadangan berada di bawah bidang kuasa rasmi ${selectedPbt.name}.`,
        statutoryAct: selectedPbt.act,
        localPlan: selectedPbt.localPlan,
        canAutoSync: false
      };
    }

    if (isSameState) {
      return {
        isValid: false,
        status: 'MISMATCH_COUNCIL',
        badgeColor: '#f59e0b',
        selectedPbt,
        detectedPbt,
        title: 'Amaran: PBT Tempatan Tidak Sepadan',
        message: `Lokasi dikesan berada di bawah pentadbiran ${detectedPbt.shortName} (${detectedPbt.stateName}), bukan ${selectedPbt.shortName}.`,
        statutoryAct: detectedPbt.act,
        localPlan: detectedPbt.localPlan,
        canAutoSync: true,
        suggestedPbt: detectedPbt
      };
    }

    return {
      isValid: false,
      status: 'MISMATCH_STATE',
      badgeColor: '#ef4444',
      selectedPbt,
      detectedPbt,
      title: 'Ralat Kritikal: Bidang Kuasa Negeri Berlainan',
      message: `Lokasi dikesan berada di negeri ${detectedPbt.stateName} (${detectedPbt.name}), bukan dalam bidang kuasa ${selectedPbt.name} (${selectedPbt.stateName}).`,
      statutoryAct: detectedPbt.act,
      localPlan: detectedPbt.localPlan,
      canAutoSync: true,
      suggestedPbt: detectedPbt
    };
  }
}
