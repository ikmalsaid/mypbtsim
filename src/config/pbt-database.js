/**
 * PBT Database Loader & Indexing Module
 * Loads the standardized uniform JSON dataset from src/data/pbt-database.json.
 * Verified against Kementerian Perumahan dan Kerajaan Tempatan (KPKT) & PLANMalaysia.
 */

import pbtJsonData from '../data/pbt-database.json' with { type: 'json' };

export const MALAYSIA_STATES = pbtJsonData.states;
export const PBT_ALL_DATABASE = pbtJsonData.pbts;

export const PBT_DATABASE_METADATA = {
  version: pbtJsonData.version,
  description: pbtJsonData.description,
  lastUpdated: pbtJsonData.lastUpdated,
  totalStates: pbtJsonData.totalStates,
  totalPbts: pbtJsonData.totalPbts
};

/**
 * Get PBT record by its unique ID
 * @param {string} id 
 * @returns {object|null}
 */
export function getPbtById(id) {
  return PBT_ALL_DATABASE.find((p) => p.id === id) || null;
}

/**
 * Get all PBTs belonging to a specific state ID
 * @param {string} stateId 
 * @returns {Array<object>}
 */
export function getPbtsByState(stateId) {
  if (!stateId || stateId === 'all') return PBT_ALL_DATABASE;
  return PBT_ALL_DATABASE.filter((p) => p.stateId === stateId);
}

