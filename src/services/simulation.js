/**
 * AI & Town Planning Simulation Engine
 * Executes 3 real-time calculations:
 * 1. Traffic Stress Index (TSI) - Units/GFA vs Access Roads, PCU Weighted Trips & Heavy Vehicles
 * 2. Transit-Oriented Development (TOD) Score (0 - 100)
 * 3. Zoning & Heritage Law Compliance Check (Akta 172, Akta 645, Akta 127 JAS, MAS)
 */

import { SIMULATION_THRESHOLDS, MALAYSIAN_STATUTORY_LAWS } from '../config/simulation-rules.js';
import { DEVELOPMENT_TYPES } from '../config/pbt-presets.js';

/**
 * Main simulation runner
 * @param {object} params
 * @param {string} params.siteName
 * @param {number} params.units
 * @param {string} params.developmentTypeId
 * @param {number} params.floors
 * @param {number} params.siteAreaAcres
 * @param {object} params.spatialData Overpass extracted infrastructure
 */
export function runSimulation({
  siteName = 'Tapak Cadangan',
  units = 350,
  developmentTypeId = 'high_rise_residential',
  floors = 24,
  siteAreaAcres = 3.5,
  spatialData = {}
}) {
  const devType = DEVELOPMENT_TYPES.find((d) => d.id === developmentTypeId) || DEVELOPMENT_TYPES[0];

  // 1. Calculate Traffic Stress Index (with PCU & Heavy Vehicle weighting)
  const trafficStressResult = calculateTrafficStress(units, devType, spatialData.accessRoads || []);

  // 2. Calculate TOD Score
  const todScoreResult = calculateTODScore(
    spatialData.railStations || [],
    spatialData.busStops || [],
    spatialData.schools || [],
    devType
  );

  // 3. Calculate Zoning, Environmental (JAS) & Heritage Compliance
  const zoningComplianceResult = evaluateZoningAndHeritage(
    siteName,
    units,
    siteAreaAcres,
    floors,
    devType,
    spatialData.heritageSites || [],
    spatialData.schools || []
  );

  // 4. Generate Overall Planning Approval Recommendation
  const overallAssessment = determineOverallApproval(trafficStressResult, todScoreResult, zoningComplianceResult);

  return {
    timestamp: new Date().toISOString(),
    input: {
      siteName,
      units,
      developmentType: devType.name,
      category: devType.category,
      categoryLabel: devType.categoryLabel,
      unitLabel: devType.unitLabel,
      tripRate: devType.tripRate,
      floors,
      siteAreaAcres
    },
    results: {
      trafficStress: trafficStressResult,
      todScore: todScoreResult,
      zoningCompliance: zoningComplianceResult,
      overallAssessment
    },
    spatialSummary: {
      railStationsCount: (spatialData.railStations || []).length,
      nearestRail: (spatialData.railStations || [])[0] || null,
      busStopsCount: (spatialData.busStops || []).length,
      schoolsCount: (spatialData.schools || []).length,
      nearestSchool: (spatialData.schools || [])[0] || null,
      heritageSitesCount: (spatialData.heritageSites || []).length,
      nearestHeritage: (spatialData.heritageSites || [])[0] || null,
      accessRoadsCount: (spatialData.accessRoads || []).length
    }
  };
}

/**
 * 1. Traffic Stress Index Calculation (PLANMalaysia & JKR/HPU Manual)
 * Incorporates PCU (Passenger Car Unit) multiplier for Heavy Vehicles (HV).
 */
function calculateTrafficStress(units, devType, accessRoads) {
  const baseTripRate = devType.tripRate || 0.8;
  const hvRatio = devType.heavyVehicleRatio || 0.02;

  // Heavy vehicles count as 2.5 PCU (Passenger Car Units)
  const pcuFactor = (1 - hvRatio) * 1.0 + hvRatio * 2.5;
  const rawTrips = Math.round(units * baseTripRate);
  const peakHourGeneratedTrips = Math.round(rawTrips * pcuFactor);

  // Estimate total access road capacity
  let totalLaneCount = 0;
  let primaryRoadsCount = 0;

  if (accessRoads && accessRoads.length > 0) {
    accessRoads.forEach((r) => {
      const lanes = r.lanes || (r.highwayType === 'primary' ? 4 : r.highwayType === 'secondary' ? 2 : 1);
      totalLaneCount += lanes;
      if (r.highwayType === 'primary' || r.highwayType === 'trunk') primaryRoadsCount++;
    });
  } else {
    // Default baseline 2-lane local road
    totalLaneCount = 4;
  }

  // Base capacity per lane per peak hour: 750 PCU
  const baseLaneCapacity = 750;
  const totalRoadCapacity = Math.max(totalLaneCount * baseLaneCapacity, 1500);

  // Baseline ambient background traffic (55% of capacity utilized)
  const ambientTraffic = totalRoadCapacity * 0.55;
  const totalPostDevTraffic = ambientTraffic + peakHourGeneratedTrips;
  const stressRatio = Math.min(Math.round((totalPostDevTraffic / totalRoadCapacity) * 100), 100);

  let hazard = 'GREEN';
  let label = 'Terkawal (Selesa)';
  let color = '#10b981';
  let levelOfService = 'LOS A / B';
  let recommendations = [];

  if (stressRatio > 80) {
    hazard = 'RED';
    label = 'Kesesakan Kritikal (Tinggi)';
    color = '#ef4444';
    levelOfService = 'LOS E / F';

    if (devType.category === 'industrial' || devType.category === 'logistics') {
      recommendations = [
        'Laporan Penilaian Impak Trafik (TIA) Terperinci dan Analisis Bebanan Gandar Jalan (Axle Load) DIWAJIBKAN sebelum kelulusan KM.',
        `Peratusan kenderaan berat tinggi (~${Math.round(hvRatio * 100)}% treler/lori kontena) memerlukan jejari pusingan minima 15 meter di semua persimpangan.`,
        'Pelebaran jalan akses perindustrian kepada 4 lorong berturap piawaian JKR U5/R5 dengan lorong pecutan/nyahpecutan (acceleration/deceleration lanes).',
        'Penyediaan kawasan menunggu lori (holding bay) dalam kawasan tapak bagi mengelak halangan di jalan awam.'
      ];
    } else if (devType.category === 'commercial') {
      recommendations = [
        'Laporan TIA Komprehensif dan Pelan Pengurusan Trafik Waktu Puncak (Peak Hour Traffic Management Plan) DIWAJIBKAN.',
        'Sistem tanjakan keluar-masuk bertingkat (grade-separated ingress/egress ramp) atau simpang berlampu isyarat pintar berpusat (SCATS).',
        'Penyediaan laluan khas e-hailing, teksi, dan kawasan punggah barang (loading bay) bawah tanah.'
      ];
    } else {
      recommendations = [
        'Penyediaan Laporan Penilaian Impak Trafik (TIA) Terperinci adalah DIWAJIBKAN sebelum kelulusan Kebenaran Merancang (KM).',
        'Pelebaran jalan masuk utama kepada minimum 4 lorong (2 hala) dan pembinaan lorong membelok khas (dedicated turning lane).',
        'Pemasangan lampu isyarat pintar di simpang keluar-masuk tapak pemajuan.',
        'Kajian semula jumlah unit pemajuan atau penambahan akses keluar-masuk sekunder.'
      ];
    }
  } else if (stressRatio >= 50) {
    hazard = 'YELLOW';
    label = 'Sederhana Padat (Perlu Mitigasi)';
    color = '#f59e0b';
    levelOfService = 'LOS C / D';

    if (devType.category === 'industrial' || devType.category === 'logistics') {
      recommendations = [
        'Kajian Trafik Ringkas (Traffic Study Note) memfokuskan pergerakan kenderaan berat perlu dikemukakan.',
        'Sistem Keluar Masuk Kiri Sahaja (Left-in / Left-out) di jalan utama untuk mengurangkan konflik lintasan treler.',
        'Penetapan anjakan bangunan (setback) rezab jalan perindustrian minimum 66 kaki (20 meter).'
      ];
    } else {
      recommendations = [
        'Kajian Trafik Ringkas (Traffic Study Note) perlu dikemukakan oleh Jurutera Perunding Berdaftar.',
        'Sistem Keluar Masuk Kiri Sahaja (Left-in / Left-out) disyorkan di jalan utama.',
        'Penetapan anjakan bangunan (setback) sekurang-kurangnya 12 meter bagi tujuan pelebaran rezab jalan masa hadapan.'
      ];
    }
  } else {
    hazard = 'GREEN';
    label = 'Terkawal (Kapasiti Memuaskan)';
    color = '#10b981';
    levelOfService = 'LOS A / B';
    recommendations = [
      'Kapasiti jalan sedia ada mencukupi untuk menampung penjanaan trafik baharu.',
      `Patuhi garis panduan piawaian rezab jalan PBT (minima ${devType.category === 'industrial' ? '66 kaki bagi zon industri' : '40 kaki bagi jalan tempatan'}).`
    ];
  }

  return {
    indexScore: stressRatio,
    hazard,
    label,
    color,
    levelOfService,
    peakHourGeneratedTrips,
    rawTrips,
    heavyVehicleRatioPercent: Math.round(hvRatio * 100),
    totalRoadCapacity,
    availableLanes: totalLaneCount,
    primaryRoadsCount,
    recommendations
  };
}

/**
 * 2. Transit-Oriented Development (TOD) Score Calculation (0 - 100)
 */
function calculateTODScore(railStations, busStops, schools, devType) {
  let score = 0;
  let breakdown = {
    railPoints: 0,
    busPoints: 0,
    walkabilityPoints: 0
  };

  const nearestRail = railStations[0] || null;
  const nearestRailDist = nearestRail ? nearestRail.distanceMeters : Infinity;

  // Rail Transit Catchment Score (Max 45 pts)
  if (nearestRailDist <= 400) {
    breakdown.railPoints = 45; // Core Walking Catchment
  } else if (nearestRailDist <= 800) {
    breakdown.railPoints = 32; // Secondary TOD Catchment
  } else if (nearestRailDist <= 1000) {
    breakdown.railPoints = 18; // Marginal Transit Zone
  } else {
    breakdown.railPoints = 5;
  }

  // Bus Network Density (Max 30 pts)
  const busStops500m = busStops.filter((b) => b.distanceMeters <= 500).length;
  if (busStops500m >= 5) {
    breakdown.busPoints = 30;
  } else if (busStops500m >= 3) {
    breakdown.busPoints = 22;
  } else if (busStops500m >= 1) {
    breakdown.busPoints = 14;
  } else if (busStops.length > 0) {
    breakdown.busPoints = 8;
  } else {
    breakdown.busPoints = 0;
  }

  // Active Mobility & Community Walkability (Max 25 pts)
  const schoolsNear = schools.filter((s) => s.distanceMeters <= 600).length;
  if (schoolsNear >= 2) {
    breakdown.walkabilityPoints += 15;
  } else if (schoolsNear >= 1) {
    breakdown.walkabilityPoints += 10;
  } else {
    breakdown.walkabilityPoints += 4;
  }

  // Bus stop within 300m walking
  const busStop300m = busStops.some((b) => b.distanceMeters <= 300);
  if (busStop300m) breakdown.walkabilityPoints += 10;
  else breakdown.walkabilityPoints += 4;

  score = Math.min(breakdown.railPoints + breakdown.busPoints + breakdown.walkabilityPoints, 100);

  // For industrial / logistics zones, TOD expectations are adjusted
  if (devType.category === 'industrial' || devType.category === 'logistics') {
    // Industrial priority is logistics access, not pedestrian TOD
    score = Math.min(score + 15, 100);
  }

  let hazard = 'GREEN';
  let label = 'Cemerlang (Zon TOD Utama)';
  let color = '#10b981';
  let recommendations = [];

  if (score >= 70) {
    hazard = 'GREEN';
    label = 'Cemerlang (Zon TOD Tinggi)';
    color = '#10b981';
    recommendations = [
      'Layak menerima insentif Pelepasan Kuota Tempat Letak Kereta sehingga 30% di bawah Garis Panduan TOD PLANMalaysia.',
      'Layak memohon Peningkatan Nisbah Plot (Plot Ratio Bonus) sehingga 1:8 atau 1:10.',
      'Wajib menyediakan laluan pejalan kaki berbumbung bersepadu terus ke stesen transit.',
      'Sediakan kemudahan mobiliti mikro (parkir e-skuter & basikal berbumbung).'
    ];
  } else if (score >= 45) {
    hazard = 'YELLOW';
    label = 'Sederhana (Akses Transit Asas)';
    color = '#f59e0b';
    recommendations = [
      'Penyediaan laluan pejalan kaki selamat ke hentian bas terdekat dalam jarak 400m.',
      'Pengurangan tempat letak kereta terhad kepada maksima 15%.',
      'Cadangkan penyediaan perkhidmatan bas pengantara (Feeder Bus Hub) di dalam kawasan pemajuan.'
    ];
  } else {
    hazard = 'RED';
    label = 'Rendah (Bergantung Kenderaan Persendirian)';
    color = '#ef4444';
    recommendations = [
      'Kawasan berkepadatan transit rendah; kuota penuh tempat letak kenderaan diwajibkan mengikut piawaian PBT.',
      'Tiada insentif nisbah plot TOD dibenarkan.',
      'Pemaju disyorkan membina hentian bas berbumbung baharu sebagai sebahagian daripada sumbangan infrastruktur (ISF).'
    ];
  }

  return {
    score,
    hazard,
    label,
    color,
    nearestRailDistance: nearestRailDist === Infinity ? 'Tiada dalam 1km' : `${nearestRailDist} m`,
    nearestRailName: nearestRail ? nearestRail.name : 'Tiada stesen rel',
    busStopsCount: busStops.length,
    breakdown,
    recommendations
  };
}

/**
 * 3. Zoning, Environmental (JAS) & Heritage Law Compliance Check
 */
function evaluateZoningAndHeritage(siteName, units, siteAreaAcres, floors, devType, heritageSites, schools) {
  const densityPerAcre = siteAreaAcres > 0 ? Math.round(units / siteAreaAcres) : 80;
  const isKgBaru = siteName.toLowerCase().includes('kampung baru') || siteName.toLowerCase().includes('kg baru');
  const isHeritagePreset = siteName.toLowerCase().includes('georgetown') || siteName.toLowerCase().includes('melaka') || isKgBaru;

  const nearestHeritage = heritageSites[0] || null;
  const heritageDistance = nearestHeritage ? nearestHeritage.distanceMeters : Infinity;

  const nearestSchool = schools[0] || null;
  const schoolDistance = nearestSchool ? nearestSchool.distanceMeters : Infinity;

  const issues = [];
  const clearances = [];
  let hazard = 'GREEN';
  let label = 'Mematuhi Rancangan Tempatan (RTD)';
  let color = '#10b981';

  // Check 1: Density Limit (Akta 172)
  const maxAllowableDensity = devType.densityLimitPerAcre || (isHeritagePreset ? 40 : 100);
  if (densityPerAcre > maxAllowableDensity) {
    issues.push({
      law: 'Akta Perancangan Bandar dan Desa 1976 (Akta 172)',
      clause: `Seksyen 21 - Had Ketumpatan Siling (${devType.categoryLabel})`,
      severity: 'HIGH',
      text: `Ketumpatan cadangan (${densityPerAcre} ${devType.unitLabel}/ekar) melebihi had siling zon perancangan (${maxAllowableDensity} ${devType.unitLabel}/ekar).`
    });
    hazard = 'YELLOW';
  } else {
    clearances.push(`Ketumpatan ${densityPerAcre} ${devType.unitLabel}/ekar mematuhi had zon (${maxAllowableDensity}/ekar).`);
  }

  // Check 2: Environmental Buffer Zone (Akta Kualiti Alam Sekeliling 1974 - JAS) for Industrial & Logistics
  if (devType.category === 'industrial' || devType.category === 'logistics') {
    const requiredBuffer = devType.doeBufferRequired || 50;
    if (schoolDistance < requiredBuffer) {
      issues.push({
        law: 'Akta Kualiti Alam Sekeliling 1974 (Akta 127) & Garis Panduan JAS',
        clause: 'Zon Penampan Alam Sekitar (DOE Buffer Zone)',
        severity: 'CRITICAL',
        text: `Aktiviti perindustrian berada pada jarak ${schoolDistance}m dari institusi sensitif/sekolah terdekat (Had minima zon penampan JAS: ${requiredBuffer}m). Penampan fizikal hijau dan Laporan EIA diwajibkan.`
      });
      hazard = 'RED';
    } else {
      clearances.push(`Mematuhi zon penampan alam sekitar JAS (${requiredBuffer}m penampan fizikal hijau).`);
    }
  }

  // Check 3: Data Center / High-Tech Utilities Check
  if (devType.id === 'data_center_tech') {
    issues.push({
      law: 'Garis Panduan Perancangan Pusat Data PLANMalaysia 2024',
      clause: 'Bebanan Utiliti (Bekalan Elektrik TNB & Air Pengurusan)',
      severity: 'MODERATE',
      text: 'Pusat Data memerlukan Surat Pengesahan Kapasiti Beban Kuasa Elektrik (TNB MVA Allocation) dan Laporan Kecekapan Penggunaan Tenaga (PUE < 1.4).'
    });
    if (hazard !== 'RED') hazard = 'YELLOW';
  }

  // Check 4: Heritage Buffer Zone (Akta 645)
  if (heritageDistance <= 200 || (isHeritagePreset && devType.category !== 'heritage')) {
    const distText = heritageDistance !== Infinity ? `${heritageDistance}m` : 'Zon Warisan Berwarta';
    issues.push({
      law: 'Akta Warisan Kebangsaan 2005 (Akta 645)',
      clause: 'Zon Penampan Warisan (200m Buffer Zone)',
      severity: isHeritagePreset && floors > 6 ? 'CRITICAL' : 'MODERATE',
      text: `Tapak berada dalam Zon Penampan Warisan (${distText} dari tapak warisan). Kawalan ketinggian maksimum (had ${floors > 6 ? 'melepasi' : 'mematuhi'} garis panduan) dan kelulusan Jawatankuasa Pemuliharaan Warisan PBT diperlukan.`
    });

    if (floors > 6 && isHeritagePreset) {
      hazard = 'RED';
    } else if (hazard !== 'RED') {
      hazard = 'YELLOW';
    }
  } else {
    clearances.push('Tapak berada di luar zon penampan warisan 200m Akta 645.');
  }

  // Check 5: Malay Agricultural Settlement (M.A.S) / Malay Reserve Enactment
  if (isKgBaru) {
    issues.push({
      law: 'Enakmen Penempatan Pertanian Melayu (M.A.S By-Laws 1900 / Perbadanan Kampong Bharu)',
      clause: 'Status Tanah Rizab Tradisional',
      severity: 'MODERATE',
      text: 'Pemilikan dan transaksi unit tertakluk kepada Enakmen M.A.S dan Akta Perbadanan Kampong Bharu 2011 (Akta 733).'
    });
    if (hazard !== 'RED') hazard = 'YELLOW';
  }

  if (hazard === 'RED') {
    label = 'Berisiko / Tidak Mematuhi Enakmen PBT / JAS';
    color = '#ef4444';
  } else if (hazard === 'YELLOW') {
    label = 'Kelulusan Bersyarat (Perlu Semakan Jawatankuasa PBT)';
    color = '#f59e0b';
  } else {
    label = 'Mematuhi Sepenuhnya Rancangan Tempatan (RTD)';
    color = '#10b981';
  }

  return {
    hazard,
    label,
    color,
    densityPerAcre,
    maxAllowableDensity,
    nearestHeritageDistance: heritageDistance === Infinity ? 'Tiada dalam 1km' : `${heritageDistance} m`,
    nearestHeritageName: nearestHeritage ? nearestHeritage.name : 'Tiada monumen warisan dikesan',
    nearestSchoolDistance: schoolDistance === Infinity ? 'Tiada dalam 1km' : `${schoolDistance} m`,
    issues,
    clearances,
    statutoryReferences: MALAYSIAN_STATUTORY_LAWS
  };
}

/**
 * Determines Overall Planning Recommendation
 */
function determineOverallApproval(traffic, tod, zoning) {
  const redCount = [traffic.hazard, tod.hazard, zoning.hazard].filter((h) => h === 'RED').length;
  const yellowCount = [traffic.hazard, tod.hazard, zoning.hazard].filter((h) => h === 'YELLOW').length;

  if (redCount >= 2 || zoning.hazard === 'RED') {
    return {
      status: 'DIKEMBALIKAN_UNTUK_PINDAAN',
      badge: 'RED',
      title: 'DITOLAK / PERLU PINDAAN PELAN UTAMA (MAJOR REVISION REQUIRED)',
      color: '#ef4444',
      summary: 'Cadangan pemajuan menghadapi halangan ketara berkaitan kesesakan jalan masuk kritikal, pelanggaran zon penampan JAS, atau enakmen warisan. Pemaju perlu mengemukakan Laporan Impak Trafik (TIA) dan Pelan Mitigasi PBT sebelum KM boleh dipertimbangkan.'
    };
  }

  if (redCount === 1 || yellowCount >= 1) {
    return {
      status: 'SOKONGAN_BERSYARAT',
      badge: 'YELLOW',
      title: 'SOKONGAN BERSYARAT (CONDITIONAL APPROVAL)',
      color: '#f59e0b',
      summary: 'Cadangan pemajuan secara amnya berpotensi untuk diluluskan dengan syarat pemaju melaksanakan pelan mitigasi trafik, penyediaan infrastruktur pematuhan zon penampan, dan mematuhi garis panduan PBT.'
    };
  }

  return {
    status: 'DISOKONG_PENUH',
    badge: 'GREEN',
    title: 'DISOKONG UNTUK KELULUSAN KEBENARAN MERANCANG (KM)',
    color: '#10b981',
    summary: 'Cadangan pemajuan mematuhi piawaian perancangan bandar, mempunyai jaringan akses jalan yang mencukupi, dan mematuhi peruntukan Rancangan Tempatan (RTD).'
  };
}
