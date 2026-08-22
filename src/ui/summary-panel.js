/**
 * Summary Panel & Simulation Stepper
 * Renders spatial infrastructure counters (Transit, Schools, Worship Places, Heritage)
 * and updates 5-step simulation progress.
 */

export function renderInfrastructureCounters(containerElement, counts = {}) {
  if (!containerElement) return;

  const categories = [
    { key: 'railStations', label: '🚆 Stesen Rel', color: '#a855f7', count: counts.railStations || 0 },
    { key: 'busStops', label: '🚌 Hentian Bas', color: '#f59e0b', count: counts.busStops || 0 },
    { key: 'schools', label: '🏫 Pendidikan', color: '#10b981', count: counts.schools || 0 },
    { key: 'worshipPlaces', label: '🕌 Rumah Ibadat', color: '#06b6d4', count: counts.worshipPlaces || 0 },
    { key: 'heritageSites', label: '🏛️ Warisan Sejarah', color: '#ec4899', count: counts.heritageSites || 0 },
    { key: 'museums', label: '🎨 Muzium & Sains', color: '#f43f5e', count: counts.museums || 0 },
    { key: 'healthSafety', label: '🏥 Kesihatan & Awam', color: '#14b8a6', count: counts.healthSafety || 0 },
    { key: 'parks', label: '🌳 Taman & Rekreasi', color: '#84cc16', count: counts.parks || 0 }
  ];

  // Filter to show active categories or core transit/community if all zero
  const activeCategories = categories.filter((c) => c.count > 0);
  const displayCategories = activeCategories.length > 0 ? activeCategories : categories.slice(0, 5);

  const html = `
    <div class="infra-counter-grid">
      ${displayCategories
        .map(
          (cat) => `
        <div class="infra-counter-item">
          <span class="infra-counter-val" style="color: ${cat.color};">${cat.count}</span>
          <span class="infra-counter-lbl">${cat.label}</span>
        </div>
      `
        )
        .join('')}
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
