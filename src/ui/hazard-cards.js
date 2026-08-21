/**
 * Red / Yellow / Green Metric Hazard Cards UI Renderer
 * Renders the 3 core simulation calculation outputs with animated gauges and mitigation actions.
 */

export function renderHazardCards(containerElement, results) {
  if (!containerElement || !results) return;

  const { trafficStress, todScore, zoningCompliance, overallAssessment } = results;

  // Concise, punchy badge labels
  const overallBadgeText = overallAssessment.badge === 'GREEN'
    ? 'DISOKONG PENUH'
    : overallAssessment.badge === 'YELLOW'
    ? 'SOKONGAN BERSYARAT'
    : 'DITOLAK / PINDAAN';

  const trafficBadgeText = trafficStress.hazard === 'RED'
    ? 'BEBANAN TINGGI'
    : trafficStress.hazard === 'YELLOW'
    ? 'SEDERHANA'
    : 'TERKAWAL';

  const todBadgeText = todScore.hazard === 'GREEN'
    ? 'TOD TINGGI'
    : todScore.hazard === 'YELLOW'
    ? 'TOD SEDERHANA'
    : 'TOD RENDAH';

  const zoningBadgeText = zoningCompliance.hazard === 'GREEN'
    ? 'PATUH RTD'
    : zoningCompliance.hazard === 'YELLOW'
    ? 'BERSYARAT'
    : 'TIDAK PATUH';

  const html = `
    <!-- Overall Assessment Banner -->
    <div class="overall-status-card glass-card status-theme-${overallAssessment.badge.toLowerCase()}">
      <div class="overall-status-header">
        <span class="overall-status-kicker">
          Keputusan Penilaian Pegawai Perancang
        </span>
        <span class="hazard-badge badge-${overallAssessment.badge.toLowerCase()}">
          ${overallBadgeText}
        </span>
      </div>
      <h3 class="overall-status-title">
        ${overallAssessment.title}
      </h3>
      <p class="overall-status-summary">
        ${overallAssessment.summary}
      </p>
    </div>

    <!-- Metric Card 1: Traffic Stress Index -->
    <div class="hazard-card card-${trafficStress.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div class="hazard-category-tag">Kiraan 1: Aras Bebanan Jalan</div>
          <div class="hazard-title">Traffic Stress Index (TSI)</div>
        </div>
        <span class="hazard-badge badge-${trafficStress.hazard.toLowerCase()}">
          ${trafficBadgeText}
        </span>
      </div>

      <div class="hazard-score-display">
        <div class="hazard-score-num" style="color: ${trafficStress.color};">
          ${trafficStress.indexScore}<span class="hazard-score-unit">%</span>
        </div>
        <div class="hazard-score-sub">
          <span class="hazard-sub-title">${trafficStress.label}</span>
          <span class="hazard-sub-detail">Bebanan Waktu Puncak (${trafficStress.levelOfService})</span>
        </div>
      </div>

      <div class="hazard-bar-wrapper">
        <div class="hazard-bar-fill" style="width: ${trafficStress.indexScore}%; background: ${trafficStress.color};"></div>
      </div>

      <div class="hazard-desc-box">
        <div><strong>Penjanaan Trafik:</strong> ~${trafficStress.peakHourGeneratedTrips} kend/jam puncak vs <strong>Kapasiti Jalan Akses:</strong> ~${trafficStress.totalRoadCapacity} kend/jam (${trafficStress.availableLanes} lorong).</div>
      </div>

      <div class="hazard-section-heading">
        <span>🛡️</span> Syarat Mitigasi Trafik PBT:
      </div>
      <ul class="hazard-actions-list">
        ${trafficStress.recommendations.map((rec) => `<li class="hazard-action-item">${rec}</li>`).join('')}
      </ul>
    </div>

    <!-- Metric Card 2: TOD Score -->
    <div class="hazard-card card-${todScore.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div class="hazard-category-tag">Kiraan 2: Aksesibiliti Transit</div>
          <div class="hazard-title">Transit-Oriented Score (TOD)</div>
        </div>
        <span class="hazard-badge badge-${todScore.hazard.toLowerCase()}">
          ${todBadgeText}
        </span>
      </div>

      <div class="hazard-score-display">
        <div class="hazard-score-num" style="color: ${todScore.color};">
          ${todScore.score}<span class="hazard-score-unit">/100</span>
        </div>
        <div class="hazard-score-sub">
          <span class="hazard-sub-title">${todScore.label}</span>
          <span class="hazard-sub-detail">Potensi Pembangunan Berorientasikan Transit</span>
        </div>
      </div>

      <div class="hazard-bar-wrapper">
        <div class="hazard-bar-fill" style="width: ${todScore.score}%; background: ${todScore.color};"></div>
      </div>

      <div class="hazard-desc-box">
        <div><strong>Stesen Rel Terdekat:</strong> ${todScore.nearestRailName} (${todScore.nearestRailDistance}) | <strong>Hentian Bas:</strong> ${todScore.busStopsCount} dalam 1km.</div>
      </div>

      <div class="hazard-section-heading">
        <span>🚆</span> Insentif & Tindakan Perancang:
      </div>
      <ul class="hazard-actions-list">
        ${todScore.recommendations.map((rec) => `<li class="hazard-action-item">${rec}</li>`).join('')}
      </ul>
    </div>

    <!-- Metric Card 3: Zoning & Heritage Law Compliance -->
    <div class="hazard-card card-${zoningCompliance.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div class="hazard-category-tag">Kiraan 3: Pematuhan Statutori</div>
          <div class="hazard-title">Zoning & Heritage Law Compliance</div>
        </div>
        <span class="hazard-badge badge-${zoningCompliance.hazard.toLowerCase()}">
          ${zoningBadgeText}
        </span>
      </div>

      <div class="hazard-desc-box">
        <div><strong>Ketumpatan:</strong> ${zoningCompliance.densityPerAcre} unit/ekar (Had siling: ${zoningCompliance.maxAllowableDensity} unit/ekar)</div>
        <div style="margin-top: 0.25rem;"><strong>Zon Warisan Terdekat:</strong> ${zoningCompliance.nearestHeritageName} (${zoningCompliance.nearestHeritageDistance})</div>
      </div>

      ${
        zoningCompliance.issues.length > 0
          ? `
        <div class="hazard-section-heading hazard-heading-warning">
          <span>⚠️</span> Fasal Perhatian Statutori:
        </div>
        <ul class="hazard-actions-list">
          ${zoningCompliance.issues
            .map(
              (iss) =>
                `<li class="hazard-action-item warning-item"><strong>${iss.law}:</strong> ${iss.text}</li>`
            )
            .join('')}
        </ul>
      `
          : `
        <div class="hazard-compliant-box">
          <span class="compliant-icon">✓</span>
          <span>Tiada perlanggaran zon penampan warisan atau had ketumpatan Akta 172.</span>
        </div>
      `
      }
    </div>
  `;

  containerElement.innerHTML = html;
}

/**
 * Renders an informative empty state for AI Simulation calculations
 * @param {HTMLElement} containerElement
 */
export function renderEmptyHazardCards(containerElement) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div class="empty-state-box">
      <div class="empty-state-icon-pulse">⚖️</div>
      <div class="empty-state-title">Simulasi AI Belum Dijalankan</div>
      <div class="empty-state-desc">
        Kiraan Bebanan Trafik (TSI), Aksesibiliti Transit (TOD), dan Pematuhan Statutori Akta PBT akan diproses selepas carian OSM selesai.
      </div>
    </div>
  `;
}
