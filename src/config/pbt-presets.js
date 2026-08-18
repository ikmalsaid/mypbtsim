/**
 * PBT (Pihak Berkuasa Tempatan) Authorities & Preset Simulation Sites
 * Malaysian Urban Planning Context - Residential, Commercial, Industrial, Logistics & Institutional
 */

export const PBT_AUTHORITIES = [
  { id: 'dbkl', name: 'Dewan Bandaraya Kuala Lumpur (DBKL)', code: 'DBKL', state: 'W.P. Kuala Lumpur' },
  { id: 'mbpj', name: 'Majlis Bandaraya Petaling Jaya (MBPJ)', code: 'MBPJ', state: 'Selangor' },
  { id: 'mbsa', name: 'Majlis Bandaraya Shah Alam (MBSA)', code: 'MBSA', state: 'Selangor' },
  { id: 'mbdk', name: 'Majlis Bandaraya Diraja Klang (MBDK)', code: 'MBDK', state: 'Selangor' },
  { id: 'mpsepang', name: 'Majlis Perbandaran Sepang (Cyberjaya/KLIA)', code: 'MPSp', state: 'Selangor' },
  { id: 'mbpp', name: 'Majlis Bandaraya Pulau Pinang (MBPP)', code: 'MBPP', state: 'Pulau Pinang' },
  { id: 'mbmb', name: 'Majlis Bandaraya Melaka Bersejarah (MBMB)', code: 'MBMB', state: 'Melaka' },
  { id: 'mbjb', name: 'Majlis Bandaraya Johor Bahru (MBJB)', code: 'MBJB', state: 'Johor' },
  { id: 'mbip', name: 'Majlis Bandaraya Iskandar Puteri (MBIP)', code: 'MBIP', state: 'Johor' },
  { id: 'pjaya', name: 'Perbadanan Putrajaya', code: 'PPJ', state: 'W.P. Putrajaya' }
];

export const DEVELOPMENT_TYPES = [
  // 1. Projek Kediaman
  {
    id: 'high_rise_residential',
    name: 'Pangsapuri / Kondominium Servis Bertingkat',
    category: 'residential',
    categoryLabel: 'Kediaman Bertingkat',
    unitLabel: 'Unit Kediaman',
    tripRate: 0.8,
    parkingRatio: 1.5,
    heavyVehicleRatio: 0.02,
    doeBufferRequired: 0,
    densityLimitPerAcre: 100
  },
  {
    id: 'affordable_housing',
    name: 'Perumahan Mampu Milik (Residensi Wilayah / Selangorku)',
    category: 'residential',
    categoryLabel: 'Perumahan Awam Mampu Milik',
    unitLabel: 'Unit Kediaman',
    tripRate: 0.55,
    parkingRatio: 1.0,
    heavyVehicleRatio: 0.01,
    doeBufferRequired: 0,
    densityLimitPerAcre: 120
  },
  {
    id: 'landed_residential',
    name: 'Perumahan Bertanah (Teres / Berkembar / Sesebuah)',
    category: 'residential',
    categoryLabel: 'Perumahan Bertanah',
    unitLabel: 'Unit Rumah',
    tripRate: 1.1,
    parkingRatio: 2.0,
    heavyVehicleRatio: 0.02,
    doeBufferRequired: 0,
    densityLimitPerAcre: 24
  },

  // 2. Projek Komersial & Perniagaan
  {
    id: 'retail_mall_commercial',
    name: 'Pusat Beli-Belah & Kompleks Komersial',
    category: 'commercial',
    categoryLabel: 'Komersial & Runcit Utama',
    unitLabel: 'Lot Komersial / Premis',
    tripRate: 2.2,
    parkingRatio: 2.5,
    heavyVehicleRatio: 0.12,
    doeBufferRequired: 20,
    densityLimitPerAcre: 80
  },
  {
    id: 'mixed_commercial',
    name: 'Pembangunan Komersial Bercampur & Suite Servis',
    category: 'commercial',
    categoryLabel: 'Komersial Bercampur',
    unitLabel: 'Unit / Suite',
    tripRate: 1.35,
    parkingRatio: 1.8,
    heavyVehicleRatio: 0.05,
    doeBufferRequired: 10,
    densityLimitPerAcre: 110
  },
  {
    id: 'office_corporate_cbd',
    name: 'Menara Pejabat Korporat & Pusat Perniagaan',
    category: 'commercial',
    categoryLabel: 'Komersial Pejabat',
    unitLabel: 'Unit Pejabat / Suite',
    tripRate: 1.6,
    parkingRatio: 1.5,
    heavyVehicleRatio: 0.04,
    doeBufferRequired: 0,
    densityLimitPerAcre: 90
  },

  // 3. Projek Perindustrian & Logistik
  {
    id: 'light_industrial_sme',
    name: 'Taman Perindustrian Ringan & Perusahaan Kecil Sederhana (PKS)',
    category: 'industrial',
    categoryLabel: 'Perindustrian Ringan',
    unitLabel: 'Lot Kilang / Bengkel',
    tripRate: 1.1,
    parkingRatio: 1.2,
    heavyVehicleRatio: 0.25,
    doeBufferRequired: 50,
    densityLimitPerAcre: 15
  },
  {
    id: 'medium_heavy_industrial',
    name: 'Perindustrian Sederhana & Kilang Pembuatan',
    category: 'industrial',
    categoryLabel: 'Perindustrian Sederhana/Berat',
    unitLabel: 'Lot Kilang Pembuatan',
    tripRate: 1.4,
    parkingRatio: 1.0,
    heavyVehicleRatio: 0.40,
    doeBufferRequired: 250,
    densityLimitPerAcre: 8
  },
  {
    id: 'logistics_warehouse_hub',
    name: 'Hab Logistik, Pergudangan & Pengedaran',
    category: 'logistics',
    categoryLabel: 'Logistik & Pergudangan',
    unitLabel: 'Gudang / Bay Muatan',
    tripRate: 1.8,
    parkingRatio: 0.8,
    heavyVehicleRatio: 0.60,
    doeBufferRequired: 100,
    densityLimitPerAcre: 6
  },
  {
    id: 'data_center_tech',
    name: 'Pusat Data Kecerdasan Buatan (AI) & Fasiliti Awan',
    category: 'industrial',
    categoryLabel: 'Teknologi Tinggi & Data Center',
    unitLabel: 'Modul Server / Fasiliti',
    tripRate: 0.4,
    parkingRatio: 0.6,
    heavyVehicleRatio: 0.08,
    doeBufferRequired: 50,
    densityLimitPerAcre: 10
  },

  // 4. Institusi, Kesihatan & Warisan
  {
    id: 'private_hospital_specialist',
    name: 'Hospital Pakar & Kompleks Kesihatan Swasta',
    category: 'institutional',
    categoryLabel: 'Institusi Kesihatan',
    unitLabel: 'Katil Rawatan / Klinik',
    tripRate: 1.9,
    parkingRatio: 2.2,
    heavyVehicleRatio: 0.08,
    doeBufferRequired: 30,
    densityLimitPerAcre: 50
  },
  {
    id: 'heritage_boutique',
    name: 'Pemuliharaan Warisan & Hotel Butik Pelancongan',
    category: 'heritage',
    categoryLabel: 'Warisan & Pelancongan',
    unitLabel: 'Bilik / Premis Warisan',
    tripRate: 0.7,
    parkingRatio: 0.8,
    heavyVehicleRatio: 0.02,
    doeBufferRequired: 0,
    densityLimitPerAcre: 40
  }
];

export const PRESET_SITES = [
  {
    id: 'kg-baru',
    name: 'Kampung Baru, Kuala Lumpur',
    pbtId: 'dbkl',
    lat: 3.1612,
    lng: 101.7088,
    defaultUnits: 350,
    defaultFloors: 28,
    defaultArea: 3.5,
    developmentType: 'high_rise_residential',
    description: 'Kawasan Perumahan Tradisional MAS dengan koridor transit LRT Kg Baru & MRT Raja Uda.',
    zoneCategory: 'Kawasan Rizab Melayu / Penempatan Pertanian Melayu (M.A.S)',
    densityLimitPerAcre: 80,
    heritageFlag: true
  },
  {
    id: 'bukit-raja-industrial',
    name: 'Kawasan Perindustrian Bukit Raja, Klang',
    pbtId: 'mbdk',
    lat: 3.0768,
    lng: 101.4421,
    defaultUnits: 85,
    defaultFloors: 3,
    defaultArea: 18.0,
    developmentType: 'logistics_warehouse_hub',
    description: 'Zon Perindustrian & Hab Logistik Bersepadu dengan akses Lebuhraya Selat Klang & Pelabuhan Klang.',
    zoneCategory: 'Zon Perindustrian & Pergudangan Moden MBDK',
    densityLimitPerAcre: 10,
    heritageFlag: false
  },
  {
    id: 'sec-13-pj',
    name: 'Seksyen 13, Petaling Jaya',
    pbtId: 'mbpj',
    lat: 3.1189,
    lng: 101.6373,
    defaultUnits: 550,
    defaultFloors: 32,
    defaultArea: 4.8,
    developmentType: 'mixed_commercial',
    description: 'Zon Penukaran Perindustrian Ringan kepada Komersial Berorientasikan Transit (TOD).',
    zoneCategory: 'Komersial / Bercampur (Special Area Plan PJ Seksyen 13)',
    densityLimitPerAcre: 100,
    heritageFlag: false
  },
  {
    id: 'cyberjaya-datacenter',
    name: 'Cyberjaya Tech Hub & Data Center Park, Sepang',
    pbtId: 'mpsepang',
    lat: 2.9213,
    lng: 101.6559,
    defaultUnits: 60,
    defaultFloors: 5,
    defaultArea: 12.5,
    developmentType: 'data_center_tech',
    description: 'Zon Pusat Data Berkapasiti Tinggi & Hab AI Multimedia Super Corridor (MSC).',
    zoneCategory: 'Taman Sains, Teknologi & Pusat Data MP Sepang',
    densityLimitPerAcre: 15,
    heritageFlag: false
  },
  {
    id: 'klcc-commercial',
    name: 'Pusat Bandaraya KLCC (Jalan Ampang/P. Ramlee), KL',
    pbtId: 'dbkl',
    lat: 3.1579,
    lng: 101.7116,
    defaultUnits: 420,
    defaultFloors: 45,
    defaultArea: 2.8,
    developmentType: 'retail_mall_commercial',
    description: 'Komersial Pusat Perniagaan Utama (CBD) dengan stesen MRT Persiaran KLCC & LRT KLCC.',
    zoneCategory: 'Komersial Utama / Nisbah Plot Tinggi DBKL',
    densityLimitPerAcre: 120,
    heritageFlag: false
  },
  {
    id: 'bayan-lepas-fiz',
    name: 'Bayan Lepas Free Industrial Zone, Pulau Pinang',
    pbtId: 'mbpp',
    lat: 5.3012,
    lng: 100.2858,
    defaultUnits: 110,
    defaultFloors: 4,
    defaultArea: 15.0,
    developmentType: 'medium_heavy_industrial',
    description: 'Zon Perindustrian Bebas Elektronik & Pembuatan Berteknologi Tinggi.',
    zoneCategory: 'Zon Perindustrian Utama MBPP / PDC',
    densityLimitPerAcre: 12,
    heritageFlag: false
  },
  {
    id: 'georgetown-heritage',
    name: 'Lebuh Chulia, Georgetown, Pulau Pinang',
    pbtId: 'mbpp',
    lat: 5.4184,
    lng: 100.3364,
    defaultUnits: 120,
    defaultFloors: 4,
    defaultArea: 1.5,
    developmentType: 'heritage_boutique',
    description: 'Zon Penampan Warisan UNESCO (UNESCO World Heritage Buffer Zone). Had ketinggian ketat.',
    zoneCategory: 'Zon Warisan / Pelancongan Warisan Akta 645',
    densityLimitPerAcre: 40,
    heritageFlag: true
  },
  {
    id: 'putrajaya-p1',
    name: 'Presint 1, Putrajaya',
    pbtId: 'pjaya',
    lat: 2.9353,
    lng: 101.6922,
    defaultUnits: 400,
    defaultFloors: 18,
    defaultArea: 6.0,
    developmentType: 'high_rise_residential',
    description: 'Pusat Pentadbiran Kerajaan Persekutuan dengan hierarki jalan protokol & MRT Putrajaya.',
    zoneCategory: 'Institusi & Kediaman Kuarters Kerajaan',
    densityLimitPerAcre: 60,
    heritageFlag: false
  }
];
