/**
 * Summary Panel & Simulation Stepper
 * Renders spatial infrastructure counters (Transit, Schools, Worship Places, Heritage)
 * and updates 5-step simulation progress.
 */

export function renderInfrastructureCounters(containerElement, counts) {
  if (!containerElement) return;

  const html = `
    <div class="infra-counter-grid">
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #a855f7;">${counts.railStations || 0}</span>
        <span class="infra-counter-lbl">🚆 Stesen Rel</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #f59e0b;">${counts.busStops || 0}</span>
        <span class="infra-counter-lbl">🚌 Hentian Bas</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #10b981;">${counts.schools || 0}</span>
        <span class="infra-counter-lbl">🏫 Pendidikan</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #06b6d4;">${counts.worshipPlaces || 0}</span>
        <span class="infra-counter-lbl">🕌 Rumah Ibadat</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #ec4899;">${counts.heritageSites || 0}</span>
        <span class="infra-counter-lbl">🏛️ Tapak Warisan</span>
      </div>
    </div>
  `;

  containerElement.innerHTML = html;
}

/**
 * Renders an informative empty state when OSM data has not been queried yet
 * @param {HTMLElement} containerElement
 */
export function renderEmptyInfrastructureCounters(containerElement) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div class="empty-state-box">
      <div class="empty-state-icon-pulse">📡</div>
      <div class="empty-state-title">Tiada Data Spatial (Menunggu OSM)</div>
      <div class="empty-state-desc">
        Pengekstrakan transit rel, hentian bas, sekolah, rumah ibadat dan tapak warisan dalam radius 1,000m belum dimulakan.
      </div>
      <div class="empty-state-hint">
        Tekan <strong>"Jalankan Simulasi Impak"</strong> untuk memulakan semakan OSM.
      </div>
    </div>
  `;
}

export function updateStepperProgress(activeStep = 1) {
  const steps = [
    { id: 1, text: 'Input Parameter & Lokasi' },
    { id: 2, text: 'Semakan Bidang Kuasa PBT' },
    { id: 3, text: 'Carian Data Spatial 1km' },
    { id: 4, text: 'Simulasi Statutori & Impak' },
    { id: 5, text: 'Penilaian & Laporan KM' }
  ];

  const container = document.getElementById('simulation-stepper-container');
  if (!container) return;

  container.innerHTML = steps
    .map((s) => {
      let stateClass = '';
      let icon = s.id;
      if (s.id < activeStep) {
        stateClass = 'completed';
        icon = '✓';
      } else if (s.id === activeStep) {
        stateClass = 'active';
      }

      return `
        <div class="step-item ${stateClass}">
          <span class="step-indicator" style="${s.id < activeStep ? 'background:#10b981;' : s.id === activeStep ? 'background:#0284c7;' : 'background:#334155;'}">${icon}</span>
          <span style="font-weight: 600; font-size: 0.76rem;">${s.text}</span>
        </div>
      `;
    })
    .join('');
}
