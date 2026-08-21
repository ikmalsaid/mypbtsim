/**
 * Laporan Impak Perancangan PBT Generator
 * Generates an official, bilingual government planning impact assessment report.
 * Compact 1-Page Executive Format by default; gracefully flows to consecutive pages only when necessary.
 */

export function generateReportHtml(simulationData, pbtInfo) {
  const { input, results, spatialSummary, timestamp } = simulationData;
  const { trafficStress, todScore, zoningCompliance, overallAssessment } = results;

  const dateFormatted = new Date(timestamp).toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
    <div class="pbt-report-container" id="printable-pbt-report">
      
      <!-- Official Letterhead Header -->
      <div class="report-header">
        <div class="report-crest-section">
          <div class="report-header-titles">
            <h2>${pbtInfo ? pbtInfo.name : 'Pihak Berkuasa Tempatan'}</h2>
            <h3>Jabatan Perancangan Bandar dan Desa</h3>
            <p>Sistem Simulasi Penilaian Impak Kebenaran Merancang (MyPBTSim)</p>
          </div>
        </div>
        <div class="report-meta-box">
          <div><strong>Tarikh:</strong> ${dateFormatted}</div>
          <div><strong>Status KM:</strong> <span style="color:${overallAssessment.color}; font-weight:800;">${overallAssessment.status.replace(/_/g, ' ')}</span></div>
        </div>
      </div>

      <!-- Document Title -->
      <div class="report-title-banner">
        <h2>Laporan Penilaian Awal Impak Perancangan</h2>
        <p>Disediakan di bawah Peruntukan Seksyen 21A & 21B, ${pbtInfo ? pbtInfo.act : 'Akta Perancangan Bandar dan Desa 1976'}</p>
      </div>

      <!-- Section 1: Site & Development Details -->
      <div class="report-section">
        <div class="report-section-title">1. Butiran Cadangan Pemajuan (Proposed Site Information)</div>
        <table class="report-table">
          <tr>
            <th style="width: 24%;">Lokasi / Tapak</th>
            <td style="width: 76%; font-weight: 700;">${input.siteName}</td>
          </tr>
          <tr>
            <th>Kategori Projek</th>
            <td><strong>${input.categoryLabel || 'Pembangunan Perbandaran'}</strong> — ${input.developmentType}</td>
          </tr>
          <tr>
            <th>Skala & Saiz Tapak</th>
            <td><strong>${input.units} ${input.unitLabel || 'Unit'}</strong> (~${input.floors} Tingkat) | Keluasan: ${input.siteAreaAcres} Ekar (Ketumpatan: ${zoningCompliance.densityPerAcre} ${input.unitLabel || 'unit'}/ekar)</td>
          </tr>
          <tr>
            <th>Penjanaan Trafik</th>
            <td>Kadar: ${input.tripRate} trip/unit (~${trafficStress.peakHourGeneratedTrips} PCU kend/jam puncak, ${trafficStress.heavyVehicleRatioPercent || 2}% kenderaan berat)</td>
          </tr>
          <tr>
            <th>Topografi & Cerun</th>
            <td>Aras Tanah: <strong>${input.policyOptions && input.policyOptions.elevationMeters !== undefined ? input.policyOptions.elevationMeters : 25}m</strong> dari aras laut | Kelas Cerun: <strong>${(input.policyOptions && input.policyOptions.slopeClass ? input.policyOptions.slopeClass.replace('_', ' ').toUpperCase() : 'KELAS 1')}</strong> (Kajian Cerun PLANMalaysia/JKR)</td>
          </tr>
        </table>
      </div>

      <!-- Section 2: Metric Hazard Matrix -->
      <div class="report-section">
        <div class="report-section-title">2. Matriks Penilaian Impak 3-Dimensi (Simulation Hazard Matrix)</div>
        <div class="report-matrix-grid">
          
          <!-- Box 1 -->
          <div class="report-matrix-card ${trafficStress.hazard.toLowerCase()}">
            <h4>1. Traffic Stress Index</h4>
            <div class="report-matrix-score" style="color: ${trafficStress.color};">${trafficStress.indexScore}%</div>
            <div class="report-matrix-status">${trafficStress.label} (${trafficStress.levelOfService})</div>
            <div class="report-matrix-desc">
              Kapasiti jalan: ~${trafficStress.totalRoadCapacity} kend/jam (${trafficStress.availableLanes} lorong).
            </div>
          </div>

          <!-- Box 2 -->
          <div class="report-matrix-card ${todScore.hazard.toLowerCase()}">
            <h4>2. Transit TOD Score</h4>
            <div class="report-matrix-score" style="color: ${todScore.color};">${todScore.score}/100</div>
            <div class="report-matrix-status">${todScore.label}</div>
            <div class="report-matrix-desc">
              Rel: ${todScore.nearestRailName} (${todScore.nearestRailDistance}).
            </div>
          </div>

          <!-- Box 3 -->
          <div class="report-matrix-card ${zoningCompliance.hazard.toLowerCase()}">
            <h4>3. Zoning & Statutori</h4>
            <div class="report-matrix-score" style="color: ${zoningCompliance.color}; font-size: 0.95rem;">
              ${zoningCompliance.hazard === 'GREEN' ? 'MEMATUHI' : zoningCompliance.hazard === 'YELLOW' ? 'BERSYARAT' : 'BERISIKO'}
            </div>
            <div class="report-matrix-status">${zoningCompliance.label}</div>
            <div class="report-matrix-desc">
              Pematuhan zon ${pbtInfo ? pbtInfo.shortName : 'PBT'} & JAS.
            </div>
          </div>

        </div>
      </div>

        <!-- Section 3: Spatial Infrastructure Inventory (1km Buffer) -->
        <div class="report-section" style="margin-bottom: 0.4rem;">
          <div class="report-section-title">3. Inventori Infrastruktur Radius 1,000m (OpenStreetMap GIS)</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 32%;">Kategori Infrastruktur</th>
                <th style="width: 18%;">Kuantiti (1km)</th>
                <th style="width: 50%;">Status Aksesibiliti & Jarak Terdekat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>🚆 Stesen Rel (LRT/MRT/KTM)</td>
                <td><strong>${spatialSummary.railStationsCount} stesen</strong></td>
                <td>${todScore.nearestRailName} (${todScore.nearestRailDistance})</td>
              </tr>
              <tr>
                <td>🚌 Hentian Bas Awam</td>
                <td><strong>${spatialSummary.busStopsCount} hentian</strong></td>
                <td>Akses berjalan kaki dalam lingkungan pemajuan</td>
              </tr>
              <tr>
                <td>🏫 Institusi Pendidikan</td>
                <td><strong>${spatialSummary.schoolsCount} premis</strong></td>
                <td>${spatialSummary.nearestSchool ? spatialSummary.nearestSchool.name + ' (' + spatialSummary.nearestSchool.distanceMeters + 'm)' : 'Tiada dalam 1km'}</td>
              </tr>
              <tr>
                <td>🕌 Rumah Ibadat & Keagamaan</td>
                <td><strong>${spatialSummary.worshipPlacesCount || 0} premis</strong></td>
                <td>${spatialSummary.nearestWorship ? spatialSummary.nearestWorship.name + ' (' + spatialSummary.nearestWorship.distanceMeters + 'm)' : 'Kemudahan keagamaan dalam lingkungan komuniti'}</td>
              </tr>
              <tr>
                <td>🏛️ Tapak Warisan Bersejarah</td>
                <td><strong>${spatialSummary.heritageSitesCount} tapak</strong></td>
                <td>${spatialSummary.nearestHeritage ? spatialSummary.nearestHeritage.name + ' (' + spatialSummary.nearestHeritage.distanceMeters + 'm)' : 'Tiada zon penampan berwarta'}</td>
              </tr>
            </tbody>
          </table>
        </div>

      <!-- Section 4: Town Planning Recommendations & Directives -->
      <div class="report-section">
        <div class="report-section-title">4. Syarat-Syarat & Arahan Mitigasi Perancang Bandar</div>
        <div class="report-directives-box">
          <strong class="directive-heading">A. Mitigasi Trafik & Jalan Masuk:</strong>
          <ul class="directive-list">
            ${trafficStress.recommendations.map((r) => `<li>${r}</li>`).join('')}
          </ul>

          <strong class="directive-heading">B. Garis Panduan Transit & Kemudahan TOD:</strong>
          <ul class="directive-list">
            ${todScore.recommendations.map((r) => `<li>${r}</li>`).join('')}
          </ul>

          ${
            zoningCompliance.issues.length > 0
              ? `
            <strong class="directive-heading" style="color: #dc2626;">C. Pematuhan Statutori & Zon Penampan JAS:</strong>
            <ul class="directive-list">
              ${zoningCompliance.issues.map((i) => `<li><strong>${i.law}:</strong> ${i.text}</li>`).join('')}
            </ul>
          `
              : `
            <strong class="directive-heading" style="color: #059669;">C. Status Pematuhan Statutori:</strong>
            <p style="margin-left: 1rem; color: #065f46; margin-bottom: 0;">Cadangan mematuhi ketetapan ${pbtInfo ? pbtInfo.localPlan : 'Rancangan Tempatan'} dan garis panduan alam sekitar JAS.</p>
          `
          }
        </div>
      </div>

      <!-- Section 5: Overall Statutory Decision Summary -->
      <div class="report-section">
        <div class="report-section-title">5. Keputusan Panel Penilaian Kebenaran Merancang (KM)</div>
        <div class="report-decision-box" style="border-left: 3px solid ${overallAssessment.color}; background: ${overallAssessment.color}0f;">
          <div style="font-weight: 800; font-size: 0.8rem; color: ${overallAssessment.color}; margin-bottom: 2px;">
            ${overallAssessment.title}
          </div>
          <p style="font-size: 0.72rem; color: #334155; line-height: 1.35; margin: 0;">
            ${overallAssessment.summary}
          </p>
        </div>
      </div>

      <!-- Section 6: Official Signatures & Seal -->
      <div class="report-signoff-grid">
        <div class="signoff-box">
          <div class="signoff-title">DISEDIAKAN OLEH:</div>
          <div class="signoff-line"></div>
          <div class="signoff-meta">
            <strong>Pegawai Perancang Bandar (APr / TPr)</strong><br>
            Bahagian Kawalan Pembangunan & KM • ${pbtInfo ? pbtInfo.shortName : 'PBT'}<br>
            Tarikh: ${dateFormatted}
          </div>
        </div>

        <div class="signoff-box">
          <div class="signoff-title">PENGESAHAN KETUA JABATAN:</div>
          <div class="signoff-line"></div>
          <div class="signoff-meta">
            <strong>Pengarah Jabatan Perancangan Bandar</strong><br>
            Lembaga Perancang Bandar Malaysia (LPBM)<br>
            Cop Rasmi & Tandatangan Berkanun
          </div>
        </div>
      </div>

      <!-- Footer Disclaimer & Statutory Note -->
      <div class="report-final-disclaimer">
        <strong>PENAFIAN:</strong> Penilaian simulasi ini dijanakan secara digital berasaskan unjuran <em>senario terbaik (best-case scenario)</em> sebagai instrumen sokongan perancangan awal. Pegawai perancang dinasihatkan menyemak sebarang ralat data spatial, tapak fizikal, dan dokumen hakmilik sebelum membuat kelulusan statutori rasmi.
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
