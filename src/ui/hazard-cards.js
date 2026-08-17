/**
 * Red / Yellow / Green Metric Hazard Cards UI Renderer
 * Renders the 3 core simulation calculation outputs with animated gauges and mitigation actions.
 */

export function renderHazardCards(containerElement, results) {
  if (!containerElement || !results) return;

  const { trafficStress, todScore, zoningCompliance, overallAssessment } = results;

  const html = `
    <!-- Overall Assessment Banner -->
    <div class="overall-status-card glass-card" style="border-color: ${overallAssessment.color}55; background: ${overallAssessment.color}15;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: ${overallAssessment.color}; text-transform: uppercase; letter-spacing: 0.5px;">
          Keputusan Penilaian Pegawai Perancang
        </span>
        <span class="hazard-badge badge-${overallAssessment.badge.toLowerCase()}">
          ${overallAssessment.status.replace(/_/g, ' ')}
        </span>
      </div>
      <h3 style="font-size: 1rem; font-weight: 800; color: white; margin-bottom: 0.4rem;">
        ${overallAssessment.title}
      </h3>
      <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.45;">
        ${overallAssessment.summary}
      </p>
    </div>

    <!-- Metric Card 1: Traffic Stress Index -->
    <div class="hazard-card card-${trafficStress.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Kiraaan 1: Aras Bebanan Jalan</div>
          <div class="hazard-title">Traffic Stress Index (TSI)</div>
        </div>
        <span class="hazard-badge badge-${trafficStress.hazard.toLowerCase()}">
          ${trafficStress.label}
        </span>
      </div>

      <div class="hazard-score-display">
        <span class="hazard-score-num" style="color: ${trafficStress.color};">${trafficStress.indexScore}%</span>
        <span class="hazard-score-sub">Bebanan Waktu Puncak (${trafficStress.levelOfService})</span>
      </div>

      <div class="hazard-bar-wrapper">
        <div class="hazard-bar-fill" style="width: ${trafficStress.indexScore}%; background: ${trafficStress.color};"></div>
      </div>

      <div class="hazard-desc">
        <strong>Penjanaan Trafik:</strong> ~${trafficStress.peakHourGeneratedTrips} kend/jam puncak vs 
        <strong>Kapasiti Jalan Akses:</strong> ~${trafficStress.totalRoadCapacity} kend/jam (${trafficStress.availableLanes} lorong).
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: white; margin-top: 0.6rem;">Syarat Mitigasi Trafik PBT:</div>
      <ul class="hazard-actions-list">
        ${trafficStress.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
      </ul>
    </div>

    <!-- Metric Card 2: TOD Score -->
    <div class="hazard-card card-${todScore.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Kiraan 2: Aksesibiliti Transit</div>
          <div class="hazard-title">Transit-Oriented Score (TOD)</div>
        </div>
        <span class="hazard-badge badge-${todScore.hazard.toLowerCase()}">
          ${todScore.label}
        </span>
      </div>

      <div class="hazard-score-display">
        <span class="hazard-score-num" style="color: ${todScore.color};">${todScore.score}/100</span>
        <span class="hazard-score-sub">Potensi Pembangunan TOD</span>
      </div>

      <div class="hazard-bar-wrapper">
        <div class="hazard-bar-fill" style="width: ${todScore.score}%; background: ${todScore.color};"></div>
      </div>

      <div class="hazard-desc">
        <strong>Stesen Rel Terdekat:</strong> ${todScore.nearestRailName} (${todScore.nearestRailDistance}) | 
        <strong>Hentian Bas:</strong> ${todScore.busStopsCount} dalam 1km.
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: white; margin-top: 0.6rem;">Insentif & Tindakan Perancang:</div>
      <ul class="hazard-actions-list">
        ${todScore.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
      </ul>
    </div>

    <!-- Metric Card 3: Zoning & Heritage Law Compliance -->
    <div class="hazard-card card-${zoningCompliance.hazard.toLowerCase()}">
      <div class="hazard-header">
        <div>
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Kiraan 3: Pematuhan Statutori</div>
          <div class="hazard-title">Zoning & Heritage Law Compliance</div>
        </div>
        <span class="hazard-badge badge-${zoningCompliance.hazard.toLowerCase()}">
          ${zoningCompliance.label}
        </span>
      </div>

      <div class="hazard-desc" style="margin-top: 0.4rem;">
        <strong>Ketumpatan:</strong> ${zoningCompliance.densityPerAcre} unit/ekar (Had siling: ${zoningCompliance.maxAllowableDensity} unit/ekar)<br>
        <strong>Zon Warisan Terdekat:</strong> ${zoningCompliance.nearestHeritageName} (${zoningCompliance.nearestHeritageDistance})
      </div>

      ${
        zoningCompliance.issues.length > 0
          ? `
        <div style="font-size: 0.75rem; font-weight: 700; color: #fca5a5; margin-top: 0.6rem;">Fasal Perhatian Statutori:</div>
        <ul class="hazard-actions-list">
          ${zoningCompliance.issues
            .map(
              (iss) =>
                `<li><strong>${iss.law}:</strong> ${iss.text}</li>`
            )
            .join('')}
        </ul>
      `
          : `
        <div style="font-size: 0.75rem; color: #6ee7b7; margin-top: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>✓ Tiada perlanggaran zon penampan warisan atau had ketumpatan Akta 172.</span>
        </div>
      `
      }
    </div>
  `;

  containerElement.innerHTML = html;
}
