/**
 * AI & Town Planning Simulation Engine
 * Executes 3 real-time calculations + Jurisdiction & Specific Council Policy Audits:
 * 1. Traffic Stress Index (TSI) - Units/GFA vs Access Roads & PCU Heavy Vehicles
 * 2. Transit-Oriented Development (TOD) Score (0 - 100)
 * 3. Statutory Zoning, Council-Specific By-Laws (Akta 172/267, RSKU 3.0, Hillside, UNESCO 18m, JAS Buffer, JS-SEZ)
 */

import { SIMULATION_THRESHOLDS, MALAYSIAN_STATUTORY_LAWS } from '../config/simulation-rules.js';
import { DEVELOPMENT_TYPES } from '../config/pbt-presets.js';
import { PBT_ALL_DATABASE } from '../config/pbt-database.js';

/**
 * Main simulation runner
 */
export function runSimulation({
  pbtId = 'dbkl',
  siteName = 'Tapak Cadangan',
  units = 350,
  developmentTypeId = 'high_rise_residential',
  floors = 24,
  siteAreaAcres = 3.5,
  spatialData = {},
  jurisdictionResult = null,
  policyOptions = {}
}) {
  const pbt = PBT_ALL_DATABASE.find((p) => p.id === pbtId) || PBT_ALL_DATABASE[0];
  const devType = DEVELOPMENT_TYPES.find((d) => d.id === developmentTypeId) || DEVELOPMENT_TYPES[0];

  // 1. Calculate Traffic Stress Index
  const trafficStressResult = calculateTrafficStress(units, devType, spatialData.accessRoads || []);

  // 2. Calculate TOD Score
  const todScoreResult = calculateTODScore(
    spatialData.railStations || [],
    spatialData.busStops || [],
    spatialData.schools || [],
    devType,
    pbt
  );

  // 3. Calculate Statutory, Jurisdiction & Specific Council Policy Compliance
  const zoningComplianceResult = evaluateZoningAndCouncilPolicies(
    pbt,
    siteName,
    units,
    siteAreaAcres,
    floors,
    devType,
    spatialData.heritageSites || [],
    spatialData.schools || [],
    jurisdictionResult,
    policyOptions
  );

  // 4. Generate Overall Planning Approval Recommendation
  const overallAssessment = determineOverallApproval(
    trafficStressResult,
    todScoreResult,
    zoningComplianceResult,
    jurisdictionResult
  );

  return {
    timestamp: new Date().toISOString(),
    pbt,
    jurisdictionResult,
    input: {
      siteName,
      units,
      developmentType: devType.name,
      category: devType.category,
      categoryLabel: devType.categoryLabel,
      unitLabel: devType.unitLabel,
      tripRate: devType.tripRate,
      floors,
      siteAreaAcres,
      policyOptions
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
      worshipPlacesCount: (spatialData.worshipPlaces || []).length,
      nearestWorship: (spatialData.worshipPlaces || [])[0] || null,
      heritageSitesCount: (spatialData.heritageSites || []).length,
      nearestHeritage: (spatialData.heritageSites || [])[0] || null,
      accessRoadsCount: (spatialData.accessRoads || []).length
    }
  };
}

/**
 * 1. Traffic Stress Index Calculation (PLANMalaysia & JKR/HPU Manual)
 */
function calculateTrafficStress(units, devType, accessRoads) {
  const baseTripRate = devType.tripRate || 0.8;
  const hvRatio = devType.heavyVehicleRatio || 0.02;

  // Heavy vehicles count as 2.5 PCU (Passenger Car Units)
  const pcuFactor = (1 - hvRatio) * 1.0 + hvRatio * 2.5;
  const rawTrips = Math.round(units * baseTripRate);
  const peakHourGeneratedTrips = Math.round(rawTrips * pcuFactor);

  let totalLaneCount = 0;
  let primaryRoadsCount = 0;

  if (accessRoads && accessRoads.length > 0) {
    accessRoads.forEach((r) => {
      const lanes = r.lanes || (r.highwayType === 'primary' ? 4 : r.highwayType === 'secondary' ? 2 : 1);
      totalLaneCount += lanes;
      if (r.highwayType === 'primary' || r.highwayType === 'trunk') primaryRoadsCount++;
    });
  } else {
    totalLaneCount = 4;
  }

  const baseLaneCapacity = 750;
  const totalRoadCapacity = Math.max(totalLaneCount * baseLaneCapacity, 1500);

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
        'Laporan Penilaian Impak Trafik (TIA) Terperinci dan Analisis Bebanan Gandar Jalan (Axle Load JKR U5/R5) DIWAJIBKAN.',
        `Peratusan kenderaan berat tinggi (~${Math.round(hvRatio * 100)}% treler/lori kontena) memerlukan jejari pusingan minima 15 meter di semua persimpangan.`,
        'Pelebaran jalan akses perindustrian kepada 4 lorong berturap piawaian JKR dengan lorong memotong/nyahpecutan.',
        'Penyediaan kawasan menunggu lori (holding bay) dalam kawasan tapak bagi mengelak halangan di jalan awam.'
      ];
    } else if (devType.category === 'commercial') {
      recommendations = [
        'Laporan TIA Komprehensif dan Pelan Pengurusan Trafik Waktu Puncak (Peak Hour Traffic Plan) DIWAJIBKAN.',
        'Sistem tanjakan keluar-masuk bertingkat (grade-separated ingress/egress ramp) atau simpang lampu isyarat pintar (SCATS).',
        'Penyediaan zon e-hailing, teksi, dan kawasan punggah barang (loading bay) bawah tanah khusus.'
      ];
    } else {
      recommendations = [
        'Penyediaan Laporan Penilaian Impak Trafik (TIA) Terperinci adalah DIWAJIBKAN sebelum kelulusan Kebenaran Merancang (KM).',
        'Pelebaran jalan masuk utama kepada minimum 4 lorong (2 hala) dan pembinaan lorong membelok khas.',
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
function calculateTODScore(railStations, busStops, schools, devType, pbt) {
  let score = 0;
  let breakdown = { railPoints: 0, busPoints: 0, walkabilityPoints: 0 };

  const nearestRail = railStations[0] || null;
  const nearestRailDist = nearestRail ? nearestRail.distanceMeters : Infinity;

  // Rail Transit Catchment Score (Max 45 pts)
  if (nearestRailDist <= 400) {
    breakdown.railPoints = 45;
  } else if (nearestRailDist <= 800) {
    breakdown.railPoints = 32;
  } else if (nearestRailDist <= 1000) {
    breakdown.railPoints = 18;
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
  if (schoolsNear >= 2) breakdown.walkabilityPoints += 15;
  else if (schoolsNear >= 1) breakdown.walkabilityPoints += 10;
  else breakdown.walkabilityPoints += 4;

  const busStop300m = busStops.some((b) => b.distanceMeters <= 300);
  if (busStop300m) breakdown.walkabilityPoints += 10;
  else breakdown.walkabilityPoints += 4;

  score = Math.min(breakdown.railPoints + breakdown.busPoints + breakdown.walkabilityPoints, 100);

  // Council Specific Bonus (e.g. Johor RTS Link / DBKL CBD TOD)
  if (pbt.policyFlags && pbt.policyFlags.hasRTSLink && nearestRailDist <= 800) {
    score = Math.min(score + 10, 100);
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
      `Layak menerima insentif Pelepasan Kuota Tempat Letak Kereta sehingga 30% di bawah ${pbt.localPlan}.`,
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
      `Kawasan berkepadatan transit rendah; kuota penuh tempat letak kenderaan diwajibkan mengikut piawaian ${pbt.shortName}.`,
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
 * 3. Statutory, Jurisdiction & Specific Council Policy Audit
 */
function evaluateZoningAndCouncilPolicies(
  pbt,
  siteName,
  units,
  siteAreaAcres,
  floors,
  devType,
  heritageSites,
  schools,
  jurisdictionResult,
  policyOptions
) {
  const densityPerAcre = siteAreaAcres > 0 ? Math.round(units / siteAreaAcres) : 80;
  const nearestHeritage = heritageSites[0] || null;
  const heritageDistance = nearestHeritage ? nearestHeritage.distanceMeters : Infinity;
  const nearestSchool = schools[0] || null;
  const schoolDistance = nearestSchool ? nearestSchool.distanceMeters : Infinity;

  const issues = [];
  const clearances = [];
  let hazard = 'GREEN';

  // CHECK 0: Spatial Jurisdiction Match
  if (jurisdictionResult && !jurisdictionResult.isValid) {
    issues.push({
      law: pbt.act,
      clause: 'Seksyen 19 - Bidang Kuasa Pihak Berkuasa Perancang Tempatan',
      severity: 'FATAL',
      text: jurisdictionResult.message
    });
    hazard = 'RED';
  } else {
    clearances.push(`Permohonan sah di bawah bidang kuasa pentadbiran ${pbt.name} (${pbt.act}).`);
  }

  // CHECK 1: Density Limit
  const maxAllowableDensity = devType.densityLimitPerAcre || 100;
  if (densityPerAcre > maxAllowableDensity) {
    issues.push({
      law: pbt.act,
      clause: `Seksyen 21 - Had Ketumpatan Kawasan (${pbt.localPlan})`,
      severity: 'HIGH',
      text: `Ketumpatan cadangan (${densityPerAcre} ${devType.unitLabel}/ekar) melebihi had siling zon perancangan ${pbt.shortName} (${maxAllowableDensity} ${devType.unitLabel}/ekar).`
    });
    if (hazard !== 'RED') hazard = 'YELLOW';
  } else {
    clearances.push(`Ketumpatan ${densityPerAcre} ${devType.unitLabel}/ekar mematuhi had zon ${pbt.shortName} (${maxAllowableDensity}/ekar).`);
  }

  // CHECK 2: Selangor Specific Policy (Rumah Selangorku 3.0)
  if (pbt.stateId === 'selangor' && siteAreaAcres >= 5.0 && devType.category === 'residential') {
    const affordablePct = policyOptions.affordableHousingPercent || 30;
    if (affordablePct < 20) {
      issues.push({
        law: 'Garis Panduan dan Piawaian Perancangan Negeri Selangor 2025 (LPHS)',
        clause: 'Dasar Rumah Selangorku 3.0 (Ketetapan MMKN Selangor)',
        severity: 'HIGH',
        text: `Pemajuan kediaman seluas ${siteAreaAcres} ekar (>= 5 ekar) WAJIB memperuntukkan sekurang-kurangnya 20%-40% unit Rumah Selangorku 3.0 (Peruntukan semasa: ${affordablePct}%).`
      });
      if (hazard !== 'RED') hazard = 'YELLOW';
    } else {
      clearances.push(`Mematuhi Dasar Rumah Selangorku 3.0 (${affordablePct}% unit kuota mampu milik disediakan).`);
    }
  }

  // CHECK 3: Hillside Sensitivity & Topography Policies (Penang Hillside Guidelines / PLANMalaysia GP007)
  const slopeClass = policyOptions.slopeClass || 'kelas_1';
  const elevationM = policyOptions.elevationMeters !== undefined ? policyOptions.elevationMeters : 25;

  if (pbt.stateId === 'penang') {
    if (elevationM > 76 && (devType.category === 'residential' || devType.category === 'commercial')) {
      issues.push({
        law: 'Pelan Struktur Negeri Pulau Pinang 2030 & Garis Panduan Kawalan Bukit MBPP',
        clause: 'Sekatan Pembangunan Tanah Bukit Melebihi Aras 76 Meter (250 Kaki)',
        severity: 'CRITICAL',
        text: `Aras tanah cadangan (${elevationM}m) melebihi had siling pemajuan tanah bukit Pulau Pinang (76 meter dari aras laut). Pemajuan kediaman/komersial di atas paras ini adalah disekat.`
      });
      hazard = 'RED';
    }

    if (slopeClass === 'kelas_4') {
      issues.push({
        law: 'Penang Safety Guideline for Hill Site Development (Edisi Kedua 2020)',
        clause: 'Kawalan Ketat Cerun Bukit Kelas IV (> 35°)',
        severity: 'CRITICAL',
        text: 'Kawasan Sensitif Alam Sekitar (KSAS Tahap 1). Pembangunan am tidak dibenarkan kecuali infrastruktur linear berkepentingan awam, kerja pembaikan/penstabilan cerun, atau pertahanan tertakluk kepada kelulusan EIA dan Pemeriksa Bebas Berdaftar (Accredited Checker).'
      });
      hazard = 'RED';
    } else if (slopeClass === 'kelas_3') {
      issues.push({
        law: 'Penang Safety Guideline for Hill Site Development (Edisi Kedua 2020)',
        clause: 'Syarat Ketat Kejuruteraan Cerun Kelas III (> 25° hingga 35°)',
        severity: 'HIGH',
        text: 'Memerlukan Laporan Geoteknikal & Geologi Terperinci, pelantikan Jurutera Geoteknik Bertauliah, semakan Pemeriksa Bebas Berdaftar (Independent Checker - IC), dan kelulusan Jawatankuasa Tanah Berisiko Negeri Pulau Pinang (CDLR).'
      });
      if (hazard !== 'RED') hazard = 'YELLOW';
    } else if (slopeClass === 'kelas_2') {
      clearances.push('Cerun Kelas II (15° - 25°): Laporan Geoteknikal & Analisis Kestabilan Cerun (SSA) tertakluk kepada kelulusan MBPP/MBSP.');
    }

    if (pbt.policyFlags && pbt.policyFlags.hasUNESCOHeritage && floors > 5) {
      issues.push({
        law: 'George Town World Heritage Site Special Area Plan (SAP)',
        clause: 'Kawalan Ketinggian Maksimum UNESCO (Had 18m / ~5 Tingkat)',
        severity: 'CRITICAL',
        text: `Cadangan ${floors} tingkat melebihi had siling 18m Zon Warisan Dunia UNESCO George Town.`
      });
      hazard = 'RED';
    }
  } else {
    // Nationwide Hillside Guidelines (PLANMalaysia GP007)
    if (slopeClass === 'kelas_4') {
      issues.push({
        law: 'Garis Panduan Pembangunan Kawasan Bukit dan Tanah Tinggi (PLANMalaysia GP007) & JKR',
        clause: 'Sekatan Kawasan Sensitif Alam Sekitar (KSAS Tahap 1 - Cerun > 35°)',
        severity: 'CRITICAL',
        text: 'Pembangunan am di atas cerun Kelas IV (> 35°) adalah disekat di bawah dasar KSAS Tahap 1, kecuali bagi projek infrastruktur linear berkepentingan awam/nasional, penstabilan cerun, atau keselamatan tertakluk kepada EIA dan Pemeriksa Bebas Berdaftar (Accredited Checker).'
      });
      hazard = 'RED';
    } else if (slopeClass === 'kelas_3') {
      issues.push({
        law: 'Garis Panduan Pembangunan Kawasan Bukit dan Tanah Tinggi (PLANMalaysia GP007)',
        clause: 'Syarat Kelulusan Cerun Kelas III (> 25° hingga 35°)',
        severity: 'HIGH',
        text: 'Memerlukan Laporan Geoteknikal & Geologi, Analisis Kestabilan Cerun (SSA), perakuan Jurutera Geoteknik Bertauliah, semakan Pemeriksa Bebas Berdaftar (Accredited Checker), dan kelulusan Jawatankuasa Teknikal Negeri (seperti JTPKSAS) atau rujukan MPFN di bawah Seksyen 22(2A)(c) Akta 172.'
      });
      if (hazard !== 'RED') hazard = 'YELLOW';
    } else if (slopeClass === 'kelas_2') {
      clearances.push('Cerun Kelas II (15° - 25°): Laporan Geoteknikal & Geologi serta Analisis Kestabilan Cerun (SSA) perlu dikemukakan mengikut piawaian JKR.');
    }
  }

  // CHECK 4: Industrial Environmental Buffer Zone (Akta 127 JAS)
  if (devType.category === 'industrial' || devType.category === 'logistics') {
    const requiredBuffer = devType.doeBufferRequired || 50;
    const providedBuffer = policyOptions.industrialBufferMeters !== undefined ? policyOptions.industrialBufferMeters : requiredBuffer;

    if (providedBuffer < requiredBuffer || schoolDistance < requiredBuffer) {
      issues.push({
        law: 'Akta Kualiti Alam Sekeliling 1974 (Akta 127) & Garis Panduan JAS',
        clause: 'Zon Penampan Fizikal Hijau Alam Sekitar (DOE Buffer Zone)',
        severity: 'CRITICAL',
        text: `Zon penampan fizikal (${providedBuffer}m disediakan / institusi sensitif pada ${schoolDistance}m) tidak memenuhi syarat minima JAS (${requiredBuffer}m). Laporan EIA diwajibkan.`
      });
      hazard = 'RED';
    } else {
      clearances.push(`Mematuhi zon penampan alam sekitar JAS (${providedBuffer}m penampan fizikal hijau).`);
    }
  }

  // CHECK 5: High-Tech Data Center Guidelines (MP Sepang / PLANMalaysia 2024)
  if (devType.id === 'data_center_tech') {
    const targetPue = policyOptions.pue || 1.35;
    if (targetPue > 1.4) {
      issues.push({
        law: 'Garis Panduan Perancangan Pusat Data PLANMalaysia 2024',
        clause: 'Had Kecekapan Penggunaan Tenaga (PUE Siling < 1.4)',
        severity: 'HIGH',
        text: `Sasaran PUE (${targetPue}) melebihi piawaian kebangsaan (PUE < 1.4). Pengesahan sistem penyejukan hijau diperlukan.`
      });
      if (hazard !== 'RED') hazard = 'YELLOW';
    } else {
      clearances.push(`Mematuhi Garis Panduan Pusat Data PLANMalaysia (PUE sasaran: ${targetPue} < 1.4).`);
    }
  }

  // CHECK 6: Malay Agricultural Settlement (M.A.S. Kampung Baru By-Laws)
  if (siteName.toLowerCase().includes('kampung baru') || siteName.toLowerCase().includes('kg baru')) {
    issues.push({
      law: 'Akta Perbadanan Pembangunan Kampong Bharu 2011 (Akta 733)',
      clause: 'Enakmen Penempatan Pertanian Melayu (M.A.S. By-Laws 1900)',
      severity: 'MODERATE',
      text: 'Pemilikan dan transaksi unit tertakluk kepada Enakmen M.A.S dan sekatan pindah milik bumiputera tradisi.'
    });
    if (hazard !== 'RED') hazard = 'YELLOW';
  }

  let label = 'Mematuhi Rancangan Tempatan (RTD)';
  let color = '#10b981';

  if (hazard === 'RED') {
    label = 'Berisiko / Tidak Mematuhi Enakmen PBT';
    color = '#ef4444';
  } else if (hazard === 'YELLOW') {
    label = 'Kelulusan Bersyarat (Perlu Semakan Jawatankuasa PBT)';
    color = '#f59e0b';
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
    statutoryReferences: [
      { act: pbt.act, section: pbt.localPlan, description: 'Rancangan pemajuan berkanun PBT.' },
      ...MALAYSIAN_STATUTORY_LAWS
    ]
  };
}

/**
 * Determines Overall Planning Recommendation
 */
function determineOverallApproval(traffic, tod, zoning, jurisdictionResult) {
  if (jurisdictionResult && !jurisdictionResult.isValid) {
    return {
      status: 'BATAL_LUAR_BIDANG_KUASA',
      badge: 'RED',
      title: 'PERMOHONAN BATAL / TIDAK SAH (DI LUAR BIDANG KUASA PBT)',
      color: '#ef4444',
      summary: `Tapak cadangan berada di luar kawasan pentadbiran ${jurisdictionResult.selectedPbt.shortName}. Di bawah ${jurisdictionResult.statutoryAct}, Kebenaran Merancang (KM) hanya boleh diproses oleh ${jurisdictionResult.detectedPbt.name}. Sila selaraskan PBT.`
    };
  }

  const redCount = [traffic.hazard, tod.hazard, zoning.hazard].filter((h) => h === 'RED').length;
  const yellowCount = [traffic.hazard, tod.hazard, zoning.hazard].filter((h) => h === 'YELLOW').length;

  if (redCount >= 2 || zoning.hazard === 'RED') {
    return {
      status: 'DIKEMBALIKAN_UNTUK_PINDAAN',
      badge: 'RED',
      title: 'DITOLAK / PERLU PINDAAN PELAN UTAMA (MAJOR REVISION REQUIRED)',
      color: '#ef4444',
      summary: 'Cadangan pemajuan menghadapi halangan ketara berkaitan kesesakan jalan masuk kritikal, pelanggaran zon penampan JAS, atau ketetapan enakmen statutori PBT. Pemaju perlu mengemukakan pelan mitigasi komprehensif.'
    };
  }

  if (redCount === 1 || yellowCount >= 1) {
    return {
      status: 'SOKONGAN_BERSYARAT',
      badge: 'YELLOW',
      title: 'SOKONGAN BERSYARAT (CONDITIONAL APPROVAL)',
      color: '#f59e0b',
      summary: 'Cadangan pemajuan berpotensi untuk dipertimbangkan dengan syarat pemaju melaksanakan pelan mitigasi trafik, pematuhan kuota statutori, dan penyediaan infrastruktur mengikut piawaian PBT.'
    };
  }

  return {
    status: 'DISOKONG_PENUH',
    badge: 'GREEN',
    title: 'DISOKONG UNTUK KELULUSAN KEBENARAN MERANCANG (KM)',
    color: '#10b981',
    summary: 'Cadangan pemajuan mematuhi piawaian perancangan bandar, mempunyai jaringan akses jalan yang mencukupi, dan mematuhi sepenuhnya peruntukan Rancangan Tempatan (RTD).'
  };
}
