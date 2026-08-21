/**
 * Comprehensive Test Suite for MyPBTSim Core Modules, Caching, Jurisdiction & Statutory Policies
 */

import * as turf from '@turf/turf';
import { CacheService } from '../src/services/cache.js';
import { JurisdictionEngine } from '../src/services/jurisdiction.js';
import { geocodeLocation } from '../src/services/geocoding.js';
import { generateSimulatedSpatialData } from '../src/services/overpass.js';
import { runSimulation } from '../src/services/simulation.js';
import { generateReportHtml } from '../src/ui/report-generator.js';
import { PBT_ALL_DATABASE } from '../src/config/pbt-database.js';
import { classifyMalaysianSlope, fetchTerrainElevation } from '../src/services/elevation.js';

async function runTests() {
  console.log('🧪 Starting MyPBTSim Complete Architecture Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test 156 PBT Database Structure & Verification
  console.log('🏛️ 1. Testing 156 PBT Database & Regional Acts:');
  assert(PBT_ALL_DATABASE.length === 156, `Loaded verified Malaysian PBTs (Total mapped: ${PBT_ALL_DATABASE.length} PBTs)`);
  
  const dbkl = PBT_ALL_DATABASE.find(p => p.id === 'dbkl');
  assert(dbkl && dbkl.act.includes('Akta 267'), 'DBKL correctly assigned Akta (Perancangan) Wilayah Persekutuan 1982 (Akta 267)');
  
  const mbpj = PBT_ALL_DATABASE.find(p => p.id === 'mbpj');
  assert(mbpj && mbpj.act.includes('Akta 172'), 'MBPJ correctly assigned Akta Perancangan Bandar dan Desa 1976 (Akta 172)');

  const dbkk = PBT_ALL_DATABASE.find(p => p.id === 'dbkk');
  assert(dbkk && dbkk.act.includes('Cap. 141') && dbkk.act.includes('Local Government Ordinance 1961'), 'DBKK correctly assigned Sabah Local Government Ordinance 1961 & Cap. 141');

  const dbku = PBT_ALL_DATABASE.find(p => p.id === 'dbku');
  assert(dbku && dbku.act.includes('Local Authorities Ordinance 1996') && dbku.act.includes('Sarawak Land Code'), 'DBKU correctly assigned Sarawak Local Authorities Ordinance 1996 & Sarawak Land Code (Cap. 81)');

  // 2. Test Disabled Caching Engine (Live Query Mode)
  console.log('\n🌐 2. Testing Live Query Mode (Cache Disabled):');
  assert(CacheService.enabled === false, 'Cache is disabled by default');
  CacheService.set('test_ns', 'kampung_baru', { lat: 3.1612, lng: 101.7088 }, 10000);
  const cacheHitDisabled = CacheService.get('test_ns', 'kampung_baru');
  assert(cacheHitDisabled === null, 'Cache get returns null when disabled, enforcing direct live queries');

  // 3. Test Jurisdiction & Spatial Boundary Anti-Mismatch Validation
  console.log('\n🛡️ 3. Testing Jurisdiction Boundary Matching & Anti-Mismatch Engine:');
  
  // Scenario A: Correct match (DBKL + Kampung Baru)
  const matchResult = JurisdictionEngine.validateJurisdiction('dbkl', 3.1612, 101.7088, 'Kampung Baru, Kuala Lumpur', { city: 'Kuala Lumpur', state: 'Wilayah Persekutuan Kuala Lumpur' });
  assert(matchResult.isValid === true && matchResult.status === 'MATCHED', 'Validates legitimate match for Kampung Baru under DBKL');

  // Scenario B: Council Mismatch within Same State (DBKL selected, but site is in Petaling Jaya)
  const mismatchCouncil = JurisdictionEngine.validateJurisdiction('dbkl', 3.1073, 101.6441, 'Seksyen 13, Petaling Jaya, Selangor', { city: 'Petaling Jaya', state: 'Selangor' });
  assert(mismatchCouncil.isValid === false, 'Detects mismatch when site is outside selected PBT');
  assert(mismatchCouncil.suggestedPbt.id === 'mbpj', 'Correctly suggests MBPJ for Petaling Jaya site');
  assert(mismatchCouncil.canAutoSync === true, 'Flags auto-sync availability');

  // Scenario C: State Mismatch (MBPP Penang selected, but site is in Johor Bahru)
  const mismatchState = JurisdictionEngine.validateJurisdiction('mbpp', 1.4927, 103.7414, 'Bukit Chagar, Johor Bahru', { city: 'Johor Bahru', state: 'Johor' });
  assert(mismatchState.status === 'MISMATCH_STATE', 'Detects cross-state jurisdiction mismatch');
  assert(mismatchState.suggestedPbt.id === 'mbjb', 'Correctly suggests MBJB for Johor Bahru site');

  // Scenario D: Auto-detect MPAG for Alor Gajah & Flag warning when DBKL is manually chosen
  const detectedAlorGajah = JurisdictionEngine.detectPBTFromLocation(2.3831, 102.2089, 'Alor Gajah, Melaka', { city: 'Alor Gajah', state: 'Melaka' });
  assert(detectedAlorGajah.id === 'mpag', 'Auto-detects MPAG for Alor Gajah site seamlessly');
  const manualMismatchAlorGajah = JurisdictionEngine.validateJurisdiction('dbkl', 2.3831, 102.2089, 'Alor Gajah, Melaka', { city: 'Alor Gajah', state: 'Melaka' });
  assert(manualMismatchAlorGajah.isValid === false, 'Flags invalid warning when DBKL is manually selected for Alor Gajah site');
  assert(manualMismatchAlorGajah.suggestedPbt.id === 'mpag', 'Suggests MPAG in warning banner');

  // 4. Test Statutory Simulation Engine with Jurisdiction Guards & Council Policies
  console.log('\n⚙️ 4. Testing Statutory Simulation Engine & Policy Guards:');
  const spatialData = generateSimulatedSpatialData(3.1612, 101.7088, 1000);

  // Scenario A: Unsynced Mismatch Proposal is FATALLY Blocked under Seksyen 19
  const blockedSim = runSimulation({
    pbtId: 'dbkl',
    siteName: 'Seksyen 13, Petaling Jaya',
    units: 400,
    siteAreaAcres: 4.0,
    spatialData,
    jurisdictionResult: mismatchCouncil
  });
  assert(blockedSim.results.overallAssessment.status === 'BATAL_LUAR_BIDANG_KUASA', 'Fatally blocks proposal under Seksyen 19 if submitted to wrong PBT');

  // Scenario B: Penang Hillside Strict Review (> 25 deg slope) & Height Ceiling (> 76m)
  const penangSim = runSimulation({
    pbtId: 'mbpp',
    siteName: 'Batu Ferringhi Hillside, Pulau Pinang',
    units: 120,
    developmentTypeId: 'landed_residential',
    siteAreaAcres: 5.0,
    spatialData,
    jurisdictionResult: { isValid: true },
    policyOptions: { slopeClass: 'kelas_3', elevationMeters: 85 }
  });
  assert(penangSim.results.zoningCompliance.issues.some(i => i.clause.includes('Sekatan Pembangunan Tanah Bukit Melebihi Aras 76 Meter')), 'Enforces Penang Hillside 76m height ceiling restriction');
  assert(penangSim.results.zoningCompliance.issues.some(i => i.clause.includes('Cerun Kelas III')), 'Enforces Penang Hillside Guidelines strict technical procedure for Class 3 slopes');
  assert(penangSim.results.zoningCompliance.hazard === 'RED', 'Flags RED hazard for Penang Hillside development exceeding 76m elevation');

  // Scenario C: Selangor Rumah Selangorku 3.0 Quota Check (>= 5 acres)
  const selangorSim = runSimulation({
    pbtId: 'mbpj',
    siteName: 'Kelana Jaya, Petaling Jaya',
    units: 500,
    developmentTypeId: 'high_rise_residential',
    siteAreaAcres: 6.0,
    spatialData,
    jurisdictionResult: { isValid: true },
    policyOptions: { affordableHousingPercent: 10 } // Less than 20%
  });
  assert(selangorSim.results.zoningCompliance.issues.some(i => i.clause.includes('Rumah Selangorku 3.0')), 'Enforces mandatory 20%-40% Rumah Selangorku 3.0 quota for Selangor sites >= 5 acres');

  // Scenario D: High-Tech Data Center PUE Check
  const dataCenterSim = runSimulation({
    pbtId: 'mpsepang',
    siteName: 'Cyberjaya Data Center Park',
    units: 60,
    developmentTypeId: 'data_center_tech',
    siteAreaAcres: 12.0,
    spatialData,
    jurisdictionResult: { isValid: true },
    policyOptions: { pue: 1.55 } // Above 1.4
  });
  assert(dataCenterSim.results.zoningCompliance.issues.some(i => i.clause.includes('PUE Siling < 1.4')), 'Enforces PLANMalaysia PUE < 1.4 limit for Data Centers');

  // 5. Test Spatial Categorization & Worship Places Separation
  console.log('\n🕌 5. Testing Separation of Places of Worship & Authentic Heritage Monuments:');
  assert(spatialData.worshipPlaces && spatialData.worshipPlaces.length > 0, 'Extracts Places of Worship into dedicated array');
  assert(spatialData.heritageSites && spatialData.heritageSites.length > 0, 'Maintains Heritage Sites as dedicated historic array');
  assert(!spatialData.heritageSites.some(h => h.name && h.name.includes('Kariah')), 'Places of worship are not conflated as tourist heritage monuments');
  assert(spatialData.heritageSites.some(h => h.name && (h.name.includes('Sultan Abdul Samad') || h.name.includes('Warisan'))), 'Uses authentic Malaysian heritage landmark names instead of generic text');

  // 6. Test Geocoding & Report Generation
  console.log('\n📄 6. Testing Official Report Generation with PBT Acts:');
  const reportHtml = generateReportHtml(selangorSim, mbpj);
  assert(reportHtml.includes('Majlis Bandaraya Petaling Jaya'), 'Report contains PBT name');
  assert(reportHtml.includes('Akta Perancangan Bandar dan Desa 1976'), 'Report contains governing statutory Act');
  assert(reportHtml.includes('Rumah Ibadat & Keagamaan'), 'Report contains dedicated Places of Worship section');
  assert(reportHtml.includes('DISEDIAKAN OLEH:'), 'Report contains formal sign-off block');

  // 7. Test DEM Satellite Elevation & Slope Gradient Engine
  console.log('\n🏔️ 7. Testing DEM Satellite Elevation & Slope Gradient Engine:');
  const flatClass = classifyMalaysianSlope(4.5);
  assert(flatClass.slopeClass === 'kelas_1', 'Correctly classifies < 15 deg as Kelas I (Rendah)');

  const boundaryClass2 = classifyMalaysianSlope(15.0);
  assert(boundaryClass2.slopeClass === 'kelas_2', 'Correctly classifies exact 15.0 deg boundary as Kelas II (Sederhana)');

  const steepClass = classifyMalaysianSlope(28.0);
  assert(steepClass.slopeClass === 'kelas_3' && steepClass.description.includes('CDLR'), 'Correctly classifies 28 deg as Kelas III (Curam - SSA/CDLR)');

  const ksasClass = classifyMalaysianSlope(38.5);
  assert(ksasClass.slopeClass === 'kelas_4' && ksasClass.description.includes('KSAS Tahap 1'), 'Correctly classifies > 35 deg as Kelas IV (KSAS Tahap 1)');

  const terrainLive = await fetchTerrainElevation(3.1612, 101.7088); // Kampung Baru
  assert(terrainLive && typeof terrainLive.elevation === 'number' && terrainLive.elevation > 0, `Fetches valid satellite elevation (${terrainLive.elevation}m for KL)`);
  assert(terrainLive.slopeDegrees >= 0 && terrainLive.slopeClass, `Computes valid ground slope gradient (${terrainLive.slopeDegrees} deg, ${terrainLive.slopeClassLabel})`);

  console.log(`\n========================================`);
  console.log(`Total Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
