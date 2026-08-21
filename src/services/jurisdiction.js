/**
 * PBT Jurisdiction & Boundary Matching Engine
 * Validates that the selected Local Council matches the physical spatial location of the proposed site.
 * Prevents invalid KM submissions to wrong local authorities under Seksyen 19 Akta 172 / Akta 267.
 */

import * as turf from '@turf/turf';
import { PBT_ALL_DATABASE, MALAYSIA_STATES } from '../config/pbt-database.js';

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
    const cleanAddress = (addressString || '').toLowerCase();
    const hasValidCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    const sitePoint = hasValidCoords ? turf.point([lng, lat]) : null;

    const addressParts = [
      rawAddressDetails.city || '',
      rawAddressDetails.municipality || '',
      rawAddressDetails.county || '',
      rawAddressDetails.state_district || '',
      rawAddressDetails.town || '',
      rawAddressDetails.suburb || '',
      rawAddressDetails.state || '',
      cleanAddress
    ].join(' ').toLowerCase();

    // 1. Detect state from address details or text
    const detectedState = MALAYSIA_STATES.find((s) => {
      const sName = s.name.toLowerCase();
      const sId = s.id.toLowerCase();
      return (
        addressParts.includes(sName) ||
        addressParts.includes(sId) ||
        (rawAddressDetails.state && rawAddressDetails.state.toLowerCase().includes(sName))
      );
    });

    // 2. Score all PBTs using multi-factor evaluation
    let bestPbt = null;
    let highestScore = -Infinity;

    for (const pbt of PBT_ALL_DATABASE) {
      let score = 0;

      // State alignment (+150 if state matches, -100 if conflict when state is known)
      if (detectedState) {
        if (pbt.stateId === detectedState.id) {
          score += 150;
        } else {
          score -= 100;
        }
      }

      // Explicit municipal name in address (+80)
      if (addressParts.includes(pbt.name.toLowerCase())) {
        score += 80;
      }

      // Explicit shortName with word boundary check (+40)
      const shortRegex = new RegExp(`\\b${pbt.shortName.toLowerCase()}\\b`, 'i');
      if (shortRegex.test(addressParts)) {
        score += 40;
      }

      // Keyword hits weighted by keyword length
      if (pbt.keywords && Array.isArray(pbt.keywords)) {
        for (const kw of pbt.keywords) {
          const kwLower = kw.toLowerCase();
          if (kwLower.length >= 3) {
            if (addressParts.includes(kwLower)) {
              score += kwLower.length * 4;
            }
          }
        }
      }

      // Spatial distance penalty (if valid coordinates available)
      if (sitePoint && typeof pbt.lat === 'number' && typeof pbt.lng === 'number') {
        const pbtPoint = turf.point([pbt.lng, pbt.lat]);
        const distKm = turf.distance(sitePoint, pbtPoint, { units: 'kilometers' });
        // Subtract distance: closer PBT gets higher score
        score -= distKm * 1.5;
      }

      if (score > highestScore) {
        highestScore = score;
        bestPbt = pbt;
      }
    }

    return bestPbt || PBT_ALL_DATABASE[0];
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
