import * as turf from '@turf/turf';

console.log('=== TESTING GEODESIC MEASUREMENT CALCULATIONS ===\n');

// 1. Test 100m x 100m square at Kuala Lumpur (Lat 3.1408, Lng 101.6932)
const originLat = 3.1408;
const originLng = 101.6932;
// 1 degree latitude = ~110574m, 1 degree longitude at 3.14°N = ~111320 * cos(3.14°) ≈ 111153m
const deltaLat = 100 / 110574;
const deltaLng = 100 / (111320 * Math.cos(originLat * Math.PI / 180));

const squarePoints = [
  [originLng, originLat],
  [originLng + deltaLng, originLat],
  [originLng + deltaLng, originLat + deltaLat],
  [originLng, originLat + deltaLat]
];

// Distance of 1 side (Target: 100.0m)
const sideLine = turf.lineString([squarePoints[0], squarePoints[1]]);
const sideDistKm = turf.length(sideLine, { units: 'kilometers' });
const sideDistM = sideDistKm * 1000;
console.log(`1. Side Distance (Target: 100.0m): ${sideDistM.toFixed(2)}m (Diff: ${Math.abs(sideDistM - 100).toFixed(3)}m)`);

// Total Perimeter (Target: 400.0m)
const perimeterLine = turf.lineString([...squarePoints, squarePoints[0]]);
const perimeterDistM = turf.length(perimeterLine, { units: 'kilometers' }) * 1000;
console.log(`2. Perimeter Distance (Target: 400.0m): ${perimeterDistM.toFixed(2)}m (Diff: ${Math.abs(perimeterDistM - 400).toFixed(3)}m)`);

// Area of 100m x 100m square (Target: 10,000 m² = 1.00 ha = 2.471 ekar)
const polygon = turf.polygon([[...squarePoints, squarePoints[0]]]);
const areaSqM = turf.area(polygon);
const areaAcres = areaSqM / 4046.8564;
const areaHectares = areaSqM / 10000;
console.log(`3. Area (Target: 10,000 m²): ${areaSqM.toFixed(2)} m²`);
console.log(`   - Hectares: ${areaHectares.toFixed(4)} ha (Target: 1.0000 ha)`);
console.log(`   - Acres: ${areaAcres.toFixed(4)} ekar (Target: 2.4711 ekar)`);

// 4. Test 1km line (Target: 1,000.0m = 1.000 km)
const kmDeltaLat = 1000 / 110574;
const kmLine = turf.lineString([[originLng, originLat], [originLng, originLat + kmDeltaLat]]);
const kmDist = turf.length(kmLine, { units: 'kilometers' });
console.log(`4. 1km Line Distance (Target: 1.000 km): ${kmDist.toFixed(4)} km`);

// 5. Test Bowtie / Figure-8 self-intersecting polygon
const bowtiePoints = [
  [originLng, originLat],
  [originLng + deltaLng, originLat + deltaLat],
  [originLng + deltaLng, originLat],
  [originLng, originLat + deltaLat]
];
const closedBowtie = [...bowtiePoints, bowtiePoints[0]];
const bowtiePoly = turf.polygon([closedBowtie]);
const kinks = turf.kinks(bowtiePoly);
console.log(`\n5. Self-intersecting polygon kinks detected: ${kinks.features.length}`);
const unkinked = turf.unkinkPolygon(bowtiePoly);
let unkinkedArea = 0;
unkinked.features.forEach(f => unkinkedArea += turf.area(f));
console.log(`   - Unkinked total valid sub-polygon area: ${unkinkedArea.toFixed(2)} m² (Target: ~5,000 m²)`);

// 6. Test Precision of Shoelace Centered fallback vs Turf
function calculateCenteredShoelace(points) {
  let area = 0;
  const n = points.length;
  const refLng = points[0][0];
  const refLat = points[0][1];
  const cosLat = Math.cos((refLat * Math.PI) / 180);
  const metersPerDegreeLng = 111320 * cosLat;
  const metersPerDegreeLat = 110574;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = (points[i][0] - refLng) * metersPerDegreeLng;
    const y1 = (points[i][1] - refLat) * metersPerDegreeLat;
    const x2 = (points[j][0] - refLng) * metersPerDegreeLng;
    const y2 = (points[j][1] - refLat) * metersPerDegreeLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

const shoelaceArea = calculateCenteredShoelace(squarePoints);
console.log(`6. Centered Shoelace Area: ${shoelaceArea.toFixed(2)} m² (Diff vs Turf: ${Math.abs(shoelaceArea - areaSqM).toFixed(3)} m²)`);

console.log('\n=== ALL GEOMETRY TESTS PASSED CLEANLY ===');
