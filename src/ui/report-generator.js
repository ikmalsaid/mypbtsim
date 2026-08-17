/**
 * Laporan Impak Perancangan PBT Generator
 * Generates an official, bilingual government planning impact assessment report.
 */

export function generateReportHtml(simulationData, pbtInfo) {
  const { input, results, spatialSummary, timestamp } = simulationData;
  const { trafficStress, todScore, zoningCompliance, overallAssessment } = results;

  const dateFormatted = new Date(timestamp).toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const refNumber = `PBT/KM/2026/SIM-${Math.floor(1000 + Math.random() * 9000)}`;

  return `
    <div class="pbt-report-container" id="printable-pbt-report">
      <!-- Report Header -->
      <div class="report-header">
        <div class="report-crest-section">
          <div class="report-pbt-logo">${pbtInfo ? pbtInfo.code : 'PBT'}</div>
          <div class="report-header-titles">
            <h2>${pbtInfo ? pbtInfo.name : 'Pihak Berkuasa Tempatan'}</h2>
            <h3>Jabatan Perancangan Bandar dan Desa (Town Planning Dept.)</h3>
            <p>Sistem Simulasi Penilaian Impak Kebenaran Merancang (MyPBTSim v1.0)</p>
          </div>
        </div>
        <div class="report-meta-box">
          <div><strong>No. Rujukan:</strong> ${refNumber}</div>
          <div><strong>Tarikh Penilaian:</strong> ${dateFormatted}</div>
          <div><strong>Status KM:</strong> <span style="color:${overallAssessment.color}; font-weight:800;">${overallAssessment.status.replace(/_/g, ' ')}</span></div>
        </div>
      </div>

      <!-- Document Title -->
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <h2 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          Laporan Penilaian Awal Impak Perancangan (Planning Impact Assessment)
        </h2>
        <p style="font-size: 0.8rem; color: #475569; font-style: italic;">
          Disediakan di bawah Peruntukan Seksyen 21A & 21B, Akta Perancangan Bandar dan Desa 1976 (Akta 172)
        </p>
      </div>

      <!-- Section 1: Site & Development Details -->
      <div class="report-section">
        <div class="report-section-title">1. Butiran Cadangan Pemajuan (Proposed Site Information)</div>
        <table class="report-table">
          <tr>
            <th style="width: 28%;">Lokasi / Nama Tapak</th>
            <td style="width: 72%; font-weight: 700;">${input.siteName}</td>
          </tr>
          <tr>
            <th>Kategori & Tipologi Projek</th>
            <td><strong>${input.categoryLabel || 'Pembangunan Perbandaran'}</strong> — ${input.developmentType}</td>
          </tr>
          <tr>
            <th>Skala Cadangan Pemajuan</th>
            <td><strong>${input.units} ${input.unitLabel || 'Unit'}</strong> (~${input.floors} Tingkat)</td>
          </tr>
          <tr>
            <th>Keluasan Anggaran Tapak</th>
            <td>${input.siteAreaAcres} Ekar (Ketumpatan: ${zoningCompliance.densityPerAcre} ${input.unitLabel || 'unit'}/ekar)</td>
          </tr>
          <tr>
            <th>Kadar Penjanaan Trafik (PCU)</th>
            <td>${input.tripRate} perjalanan/unit/jam puncak (~${trafficStress.peakHourGeneratedTrips} PCU kend/jam, ${trafficStress.heavyVehicleRatioPercent || 2}% kenderaan berat)</td>
          </tr>
        </table>
      </div>

      <!-- Section 2: Metric Hazard Matrix -->
      <div class="report-section">
        <div class="report-section-title">2. Matriks Penilaian Impak 3-Dimensi (Simulation Hazard Matrix)</div>
        <div class="report-matrix-grid">
          
          <!-- Box 1 -->
          <div class="report-matrix-card ${trafficStress.hazard.toLowerCase()}">
            <h4>1. Traffic Stress Index (TSI)</h4>
            <div class="report-matrix-score" style="color: ${trafficStress.color};">${trafficStress.indexScore}%</div>
            <div style="font-weight: 700; font-size: 0.78rem; margin-bottom: 4px;">${trafficStress.label} (${trafficStress.levelOfService})</div>
            <div class="report-matrix-desc">
              Kapasiti jalan: ~${trafficStress.totalRoadCapacity} kend/jam (${trafficStress.availableLanes} lorong akses).
            </div>
          </div>

          <!-- Box 2 -->
          <div class="report-matrix-card ${todScore.hazard.toLowerCase()}">
            <h4>2. Transit-Oriented Development (TOD)</h4>
            <div class="report-matrix-score" style="color: ${todScore.color};">${todScore.score}/100</div>
            <div style="font-weight: 700; font-size: 0.78rem; margin-bottom: 4px;">${todScore.label}</div>
            <div class="report-matrix-desc">
              Stesen rel terdekat: ${todScore.nearestRailName} (${todScore.nearestRailDistance}).
            </div>
          </div>

          <!-- Box 3 -->
          <div class="report-matrix-card ${zoningCompliance.hazard.toLowerCase()}">
            <h4>3. Zoning & Heritage Compliance</h4>
            <div class="report-matrix-score" style="color: ${zoningCompliance.color}; font-size: 1.1rem; padding-top: 0.25rem;">
              ${zoningCompliance.hazard === 'GREEN' ? 'MEMATUHI' : zoningCompliance.hazard === 'YELLOW' ? 'BERSYARAT' : 'BERISIKO'}
            </div>
            <div style="font-weight: 700; font-size: 0.78rem; margin-bottom: 4px;">${zoningCompliance.label}</div>
            <div class="report-matrix-desc">
              Had ketumpatan, zon penampan JAS & Akta Warisan 645.
            </div>
          </div>

        </div>
      </div>

      <!-- Section 3: Spatial Infrastructure Inventory (1km Buffer) -->
      <div class="report-section">
        <div class="report-section-title">3. Inventori Infrastruktur Radius 1,000m (OpenStreetMap Live Extraction)</div>
        <table class="report-table">
          <thead>
            <tr>
              <th>Kategori Infrastruktur</th>
              <th>Kuantiti Dikesan (1km)</th>
              <th>Status Aksesibiliti & Jarak Terdekat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>🚆 Stesen Rel / Transit (LRT/MRT/KTM)</td>
              <td><strong>${spatialSummary.railStationsCount} stesen</strong></td>
              <td>${todScore.nearestRailName} (${todScore.nearestRailDistance})</td>
            </tr>
            <tr>
              <td>🚌 Hentian Bas Awam</td>
              <td><strong>${spatialSummary.busStopsCount} hentian</strong></td>
              <td>Liputan dalam jarak berjalan kaki 5-10 minit</td>
            </tr>
            <tr>
              <td>🏫 Institusi Pendidikan / Sekolah</td>
              <td><strong>${spatialSummary.schoolsCount} premis</strong></td>
              <td>${spatialSummary.nearestSchool ? spatialSummary.nearestSchool.name + ' (' + spatialSummary.nearestSchool.distanceMeters + 'm)' : 'Tiada dalam 1km'}</td>
            </tr>
            <tr>
              <td>🏛️ Tapak Warisan & Bersejarah (Akta 645)</td>
              <td><strong>${spatialSummary.heritageSitesCount} tapak</strong></td>
              <td>${spatialSummary.nearestHeritage ? spatialSummary.nearestHeritage.name + ' (' + spatialSummary.nearestHeritage.distanceMeters + 'm)' : 'Tiada zon penampan berwarta'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Section 4: Town Planning Recommendations & Directives -->
      <div class="report-section">
        <div class="report-section-title">4. Syarat-Syarat & Arahan Mitigasi Perancang Bandar</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 1rem; font-size: 0.8rem; line-height: 1.6;">
          <strong style="color: #0f172a;">A. Mitigasi Trafik, Kapasiti Jalan & Kenderaan Berat:</strong>
          <ul style="margin-left: 1.2rem; margin-bottom: 0.6rem;">
            ${trafficStress.recommendations.map((r) => `<li>${r}</li>`).join('')}
          </ul>

          <strong style="color: #0f172a;">B. Garis Panduan TOD, Parkir & Akses Transit:</strong>
          <ul style="margin-left: 1.2rem; margin-bottom: 0.6rem;">
            ${todScore.recommendations.map((r) => `<li>${r}</li>`).join('')}
          </ul>

          ${
            zoningCompliance.issues.length > 0
              ? `
            <strong style="color: #dc2626;">C. Pematuhan Statutori, Zon Penampan JAS & Warisan:</strong>
            <ul style="margin-left: 1.2rem;">
              ${zoningCompliance.issues.map((i) => `<li><strong>${i.law}:</strong> ${i.text}</li>`).join('')}
            </ul>
          `
              : `
            <strong style="color: #059669;">C. Status Pematuhan Statutori:</strong>
            <p style="margin-left: 1.2rem; color: #065f46;">Pelan cadangan mematuhi sepenuhnya ketetapan Rancangan Tempatan Daerah (RTD) dan garis panduan alam sekitar JAS.</p>
          `
          }
        </div>
      </div>

      <!-- Section 5: Official Signatures -->
      <div class="report-signoff-grid">
        <div class="signoff-box">
          <div style="font-size: 0.78rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">
            DISEDIAKAN OLEH:
          </div>
          <div class="signoff-line"></div>
          <div class="signoff-meta">
            <strong>Pegawai Perancang Bandar (APr / TPr)</strong><br>
            Bahagian Kawalan Pembangunan & KM<br>
            Tarikh: ${dateFormatted}
          </div>
        </div>

        <div class="signoff-box">
          <div style="font-size: 0.78rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">
            PENGESAHAN KETUA JABATAN:
          </div>
          <div class="signoff-line"></div>
          <div class="signoff-meta">
            <strong>Pengarah Jabatan Perancangan Bandar</strong><br>
            Lembaga Perancang Bandar Malaysia (LPBM)<br>
            Cop Rasmi & Tandatangan
          </div>
        </div>
      </div>

      <!-- Footer disclaimer -->
      <div style="margin-top: 1.5rem; text-align: center; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.6rem;">
        Dokumen ini dijana secara automatik melalui Platform Simulasi Geospatial MyPBTSim dengan integrasi OpenStreetMap, Overpass API, dan Nominatim.
      </div>
    </div>
  `;
}

/**
 * Opens Report Preview Modal and handles Print/Save
 */
export function openReportModal(simulationData, pbtInfo) {
  const modal = document.getElementById('report-modal');
  const container = document.getElementById('report-modal-body');
  if (!modal || !container) return;

  container.innerHTML = generateReportHtml(simulationData, pbtInfo);
  modal.classList.add('open');
}

export function closeReportModal() {
  const modal = document.getElementById('report-modal');
  if (modal) modal.classList.remove('open');
}

export function printCurrentReport() {
  window.print();
}
