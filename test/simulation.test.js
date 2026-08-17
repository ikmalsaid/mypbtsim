/**
 * Comprehensive Test Suite for MyPBTSim Core Modules & Abnormal Geometries
 */

import * as turf from '@turf/turf';
import { geocodeLocation } from '../src/services/geocoding.js';
import { generateSimulatedSpatialData } from '../src/services/overpass.js';
import { runSimulation } from '../src/services/simulation.js';
import { generateReportHtml } from '../src/ui/report-generator.js';
import { PRESET_SITES, PBT_AUTHORITIES } from '../src/config/pbt-presets.js';

async function runTests() {
  console.log('🧪 Starting MyPBTSim Extended Test Suite...\n');
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

  // 1. Test Geocoding
  console.log('📍 1. Testing OSM Nominatim Geocoding Layer:');
  const geoResult = await geocodeLocation('Bukit Raja, Klang');
  assert(geoResult && typeof geoResult.lat === 'number', 'Resolves latitude successfully for Industrial site');
  assert(geoResult && typeof geoResult.lng === 'number', 'Resolves longitude successfully for Industrial site');

  // 2. Test Abnormal Pinpoint Scenarios in Area Measurement
  console.log('\n📐 2. Testing Abnormal Pinpoint Scenarios (Criss-Cross, Bowtie, Collinear, Multi-Vertex):');
  
  // Scenario A: Criss-cross / Bowtie / Figure-8 self-intersecting polygon
  const bowtieCoords = [
    [101.708, 3.161],
    [101.710, 3.159],
    [101.710, 3.161],
    [101.708, 3.159]
  ];
  const closedBowtie = [...bowtieCoords, bowtieCoords[0]];
  const bowtiePoly = turf.polygon([closedBowtie]);
  const kinks = turf.kinks(bowtiePoly);
  assert(kinks.features.length > 0, 'Detects self-intersecting (kinks) in figure-8 polygon');

  const unkinked = turf.unkinkPolygon(bowtiePoly);
  let totalBowtieArea = 0;
  unkinked.features.forEach((f) => { totalBowtieArea += turf.area(f); });
  assert(totalBowtieArea > 0, `Auto-unkinks figure-8 into ${unkinked.features.length} valid sub-polygons with area: ${Math.round(totalBowtieArea)} m²`);

  // Scenario B: 8-point complex irregular polygon (concave & zigzag)
  const starCoords = [
    [101.7080, 3.1610],
    [101.7090, 3.1615],
    [101.7100, 3.1610],
    [101.7095, 3.1620],
    [101.7105, 3.1628],
    [101.7090, 3.1625],
    [101.7080, 3.1630],
    [101.7085, 3.1620],
    [101.7080, 3.1610]
  ];
  const starPoly = turf.polygon([starCoords]);
  const starArea = turf.area(starPoly);
  assert(starArea > 5000, `Calculates 8-point irregular star polygon area accurately: ${Math.round(starArea)} m²`);

  // Scenario C: Collinear points (Straight line)
  const collinear = [
    [101.7080, 3.1610],
    [101.7085, 3.1610],
    [101.7090, 3.1610]
  ];
  const colPoly = turf.polygon([[...collinear, collinear[0]]]);
  const colArea = turf.area(colPoly);
  assert(Math.round(colArea) === 0, 'Correctly identifies zero area for collinear straight-line points');

  // 3. Test Commercial & Industrial Simulation Typologies
  console.log('\n🏭 3. Testing Industrial & Logistics Simulation (Bukit Raja MBDK):');
  const spatialData = generateSimulatedSpatialData(3.0768, 101.4421, 1000);
  const industrialSim = runSimulation({
    siteName: 'Kawasan Perindustrian Bukit Raja, Klang',
    units: 85,
    developmentTypeId: 'logistics_warehouse_hub',
    floors: 3,
    siteAreaAcres: 18.0,
    spatialData
  });

  assert(industrialSim.input.category === 'logistics', 'Correctly assigns logistics category');
  assert(industrialSim.results.trafficStress.heavyVehicleRatioPercent === 60, 'Applies 60% Heavy Vehicle (HV) factor for Logistics hub');
  assert(industrialSim.results.trafficStress.recommendations.some(r => r.includes('treler') || r.includes('Lori') || r.includes('gandar')), 'Generates industrial lorry/trailer traffic recommendations');

  console.log('\n🏢 4. Testing Commercial / Retail Mall Simulation (KLCC DBKL):');
  const commercialSim = runSimulation({
    siteName: 'Pusat Beli-Belah & CBD, KL',
    units: 300,
    developmentTypeId: 'retail_mall_commercial',
    floors: 12,
    siteAreaAcres: 4.5,
    spatialData
  });

  assert(commercialSim.input.category === 'commercial', 'Correctly assigns commercial category');
  assert(commercialSim.results.trafficStress.peakHourGeneratedTrips > 300, 'Calculates high peak trip rate for commercial mall');

  console.log('\n💾 5. Testing High-Tech AI Data Center Simulation (Cyberjaya MP Sepang):');
  const dataCenterSim = runSimulation({
    siteName: 'Cyberjaya Tech & AI Data Center Hub',
    units: 50,
    developmentTypeId: 'data_center_tech',
    floors: 4,
    siteAreaAcres: 10.0,
    spatialData
  });

  assert(dataCenterSim.results.zoningCompliance.issues.some(i => i.text.includes('TNB MVA Allocation') || i.text.includes('PUE')), 'Checks electrical power allocation and PUE for Data Centers');

  // 6. Test Printable Report Generation
  console.log('\n📄 6. Testing Official Printable Report Generation:');
  const reportHtml = generateReportHtml(industrialSim, PBT_AUTHORITIES.find(p => p.id === 'mbdk'));
  assert(reportHtml.includes('Kawasan Perindustrian Bukit Raja'), 'Contains site name');
  assert(reportHtml.includes('Majlis Bandaraya Diraja Klang'), 'Contains PBT authority name');
  assert(reportHtml.includes('kenderaan berat'), 'Report includes heavy vehicle traffic parameters');
  assert(reportHtml.includes('DISEDIAKAN OLEH:'), 'Report includes LPBM sign-off box');

  console.log(`\n========================================`);
  console.log(`Total Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
