/**
 * Summary Panel & Simulation Stepper
 * Renders spatial infrastructure counters and updates 5-step simulation progress.
 */

export function renderInfrastructureCounters(containerElement, counts) {
  if (!containerElement) return;

  const html = `
    <div class="infra-counter-grid">
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #a855f7;">${counts.railStations || 0}</span>
        <span class="infra-counter-lbl">🚆 Stesen Rel (LRT/MRT)</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #f59e0b;">${counts.busStops || 0}</span>
        <span class="infra-counter-lbl">🚌 Hentian Bas</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #10b981;">${counts.schools || 0}</span>
        <span class="infra-counter-lbl">🏫 Institusi Pendidikan</span>
      </div>
      <div class="infra-counter-item">
        <span class="infra-counter-val" style="color: #ec4899;">${counts.heritageSites || 0}</span>
        <span class="infra-counter-lbl">🏛️ Monumen Warisan</span>
      </div>
    </div>
  `;

  containerElement.innerHTML = html;
}

export function updateStepperProgress(activeStep = 1) {
  const steps = [
    { id: 1, text: 'Langkah 1: Input Pegawai Perancang' },
    { id: 2, text: 'Langkah 2: Geokod OSM Nominatim' },
    { id: 3, text: 'Langkah 3: Pengekstrakan OSM Overpass 1km' },
    { id: 4, text: 'Langkah 4: Enjin Simulasi AI & Statutori' },
    { id: 5, text: 'Langkah 5: Output Dashboard & Laporan' }
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
          <span class="step-indicator" style="${s.id < activeStep ? 'background:#10b981;' : s.id === activeStep ? 'background:#2563eb;' : 'background:#334155;'}">${icon}</span>
          <span style="font-weight: 600;">${s.text}</span>
        </div>
      `;
    })
    .join('');
}
