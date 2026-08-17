/**
 * Malaysian Town Planning Simulation Standards & Legal Frameworks
 * References:
 * - Garis Panduan Perancangan PLANMalaysia (Kediaman, Komersial, Perindustrian & TOD)
 * - Highway Planning Unit (HPU) / JKR Trip Generation Manual
 * - Akta Perancangan Bandar dan Desa 1976 (Akta 172)
 * - Akta Warisan Kebangsaan 2005 (Akta 645)
 * - Akta Kualiti Alam Sekeliling 1974 (Akta 127) & Garis Panduan Zon Penampan JAS
 */

export const SIMULATION_THRESHOLDS = {
  trafficStress: {
    low: { max: 50, status: 'GREEN', label: 'Terkawal (Selesa)', color: '#10b981', code: 'rendah' },
    moderate: { max: 80, status: 'YELLOW', label: 'Sederhana Padat (Perlu Mitigasi)', color: '#f59e0b', code: 'sederhana' },
    high: { max: Infinity, status: 'RED', label: 'Kesesakan Kritikal (TIA Diwajibkan)', color: '#ef4444', code: 'kritikal' }
  },
  todScore: {
    high: { min: 70, status: 'GREEN', label: 'Cemerlang (Zon TOD Tinggi)', color: '#10b981', code: 'tinggi' },
    moderate: { min: 45, status: 'YELLOW', label: 'Sederhana (Akses Transit Asas)', color: '#f59e0b', code: 'sederhana' },
    low: { min: 0, status: 'RED', label: 'Rendah (Bergantung Kenderaan Persendirian)', color: '#ef4444', code: 'rendah' }
  },
  zoningCompliance: {
    compliant: { status: 'GREEN', label: 'Mematuhi Rancangan Tempatan (RTD)', color: '#10b981', code: 'lulus' },
    conditional: { status: 'YELLOW', label: 'Kelulusan Bersyarat / Pelan Khas', color: '#f59e0b', code: 'bersyarat' },
    violation: { status: 'RED', label: 'Berisiko / Tidak Mematuhi Enakmen', color: '#ef4444', code: 'tidak_lulus' }
  }
};

export const MALAYSIAN_STATUTORY_LAWS = [
  {
    act: 'Akta Perancangan Bandar dan Desa 1976 (Akta 172)',
    section: 'Seksyen 21A & 21B - Laporan Cadangan Pemajuan (LCP) & Kebenaran Merancang (KM)',
    description: 'Menilai kesesuaian guna tanah, nisbah plot, ketumpatan unit per ekar dan penyediaan kemudahan awam asas.'
  },
  {
    act: 'Akta Kualiti Alam Sekeliling 1974 (Akta 127)',
    section: 'Garis Panduan Zon Penampan Aktiviti Perindustrian Jabatan Alam Sekitar (JAS)',
    description: 'Menetapkan zon penampan fizikal hijau (50m bagi industri ringan, 250m bagi industri sederhana/berat) dari kawasan kediaman dan institusi pendidikan.'
  },
  {
    act: 'Akta Warisan Kebangsaan 2005 (Akta 645)',
    section: 'Zon Penampan Warisan (Heritage Buffer Zone)',
    description: 'Sebarang pemajuan dalam lingkungan 200m dari tapak warisan berwarta tertakluk kepada kawalan ketinggian maksima dan garis panduan fasad Jabatan Warisan Negara.'
  },
  {
    act: 'Garis Panduan Perancangan Kawasan Berorientasikan Transit (TOD) PLANMalaysia',
    section: 'Inisiatif Rendah Karbon & Pengurangan Tempat Letak Kereta',
    description: 'Pelepasan kuota tempat letak kereta sehingga 30% dan insentif bonus nisbah plot bagi pemajuan dalam radius 400m dari stesen rel utama.'
  },
  {
    act: 'Manual Garis Panduan Penjanaan Perjalanan HPU / JKR Malaysia',
    section: 'Kapasiti Jalan Masuk, Bebanan Kenderaan Berat & Aras Perkhidmatan (LOS)',
    description: 'Menetapkan had muatan trafik waktu puncak bagi jalan masuk utama serta faktor kenderaan berat (PCU multiplier).'
  }
];
