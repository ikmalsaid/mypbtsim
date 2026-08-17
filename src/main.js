/**
 * MyPBTSim - Main Application Coordinator
 * Connects Step 1 (Input) -> Step 2 (Geocoding) -> Step 3 (Overpass Extraction)
 * -> Step 4 (AI Simulation) -> Step 5 (Visual Dashboard & Laporan Impak)
 */

import { PBT_AUTHORITIES, PRESET_SITES, DEVELOPMENT_TYPES } from './config/pbt-presets.js';
import { geocodeLocation, reverseGeocode } from './services/geocoding.js';
import { queryOverpassRadius } from './services/overpass.js';
import { runSimulation } from './services/simulation.js';
import { MapController } from './map/map-controller.js';
import { renderHazardCards } from './ui/hazard-cards.js';
import { renderInfrastructureCounters, updateStepperProgress } from './ui/summary-panel.js';
import { openReportModal, closeReportModal, printCurrentReport } from './ui/report-generator.js';

// Application State
const state = {
  currentPbt: PBT_AUTHORITIES[0],
  currentSiteName: 'Kampung Baru, Kuala Lumpur',
  currentLat: 3.1612,
  currentLng: 101.7088,
  units: 350,
  developmentTypeId: 'high_rise_residential',
  floors: 28,
  siteAreaAcres: 3.5,
  spatialData: null,
  simulationResult: null,
  isSimulating: false
};

// UI Element References
let mapController = null;

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initMap();
  runFullPipeline(); // Initial run on default site (Kampung Baru)
});

/**
 * Initialize Form Controls, Dropdowns & Listeners
 */
function initUI() {
  // 1. Populate PBT Authority Dropdown
  const pbtSelect = document.getElementById('pbt-select');
  if (pbtSelect) {
    pbtSelect.innerHTML = PBT_AUTHORITIES.map(
      (p) => `<option value="${p.id}">${p.name}</option>`
    ).join('');

    pbtSelect.addEventListener('change', (e) => {
      const selected = PBT_AUTHORITIES.find((p) => p.id === e.target.value);
      if (selected) {
        state.currentPbt = selected;
        // Auto-select first matching preset site if available
        const matchingPreset = PRESET_SITES.find((s) => s.pbtId === selected.id);
        if (matchingPreset) {
          applyPresetSite(matchingPreset);
        }
      }
    });
  }

  // 2. Populate Development Types with Category Optgroups
  const devTypeSelect = document.getElementById('dev-type-select');
  if (devTypeSelect) {
    const categories = [
      { id: 'residential', label: '🏠 Projek Kediaman (Residential)' },
      { id: 'commercial', label: '🏢 Projek Komersial & Perniagaan (Commercial)' },
      { id: 'industrial', label: '🏭 Projek Perindustrian & Teknologi (Industrial & Tech)' },
      { id: 'logistics', label: '🚛 Hab Logistik & Pergudangan (Logistics Hub)' },
      { id: 'institutional', label: '🏥 Institusi Kesihatan & Awam (Institutional)' },
      { id: 'heritage', label: '🏛️ Zon Warisan & Pelancongan (Heritage)' }
    ];

    devTypeSelect.innerHTML = categories
      .map((cat) => {
        const typesInCat = DEVELOPMENT_TYPES.filter(
          (d) => d.category === cat.id || (cat.id === 'industrial' && d.category === 'industrial')
        );
        if (typesInCat.length === 0) return '';
        return `
          <optgroup label="${cat.label}">
            ${typesInCat.map((d) => `<option value="${d.id}">${d.name}</option>`).join('')}
          </optgroup>
        `;
      })
      .join('');

    devTypeSelect.addEventListener('change', (e) => {
      state.developmentTypeId = e.target.value;
      updateUnitsLabel(e.target.value);
    });
  }

  // 3. Populate Preset Sites Chips
  const presetsContainer = document.getElementById('presets-container');
  if (presetsContainer) {
    presetsContainer.innerHTML = PRESET_SITES.map(
      (site, index) => `
        <button type="button" class="preset-chip ${index === 0 ? 'active' : ''}" data-id="${site.id}">
          ${site.name.split(',')[0]}
        </button>
      `
    ).join('');

    presetsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;

      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const preset = PRESET_SITES.find((s) => s.id === chip.dataset.id);
      if (preset) {
        applyPresetSite(preset);
      }
    });
  }

  // 4. Form Submission (Run Simulation)
  const form = document.getElementById('simulation-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      readFormInputs();
      runFullPipeline();
    });
  }

  // 5. Manual Geocoding Search Button
  const btnGeocode = document.getElementById('btn-geocode-search');
  if (btnGeocode) {
    btnGeocode.addEventListener('click', async () => {
      const siteInput = document.getElementById('site-name-input');
      if (siteInput && siteInput.value.trim()) {
        state.currentSiteName = siteInput.value.trim();
        await executeStep2Geocoding();
        mapController.setProposedSite(state.currentLat, state.currentLng, state.currentSiteName, state.units);
      }
    });
  }

  // 6. Basemap & Layer Switchers
  const basemapSelect = document.getElementById('basemap-select');
  if (basemapSelect) {
    basemapSelect.addEventListener('change', (e) => {
      mapController.setBasemap(e.target.value);
    });
  }

  document.querySelectorAll('.layer-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layerName = btn.dataset.layer;
      const isActive = btn.classList.toggle('active');
      mapController.toggleLayer(layerName, isActive);
    });
  });

  // 7. Measuring Tools
  const btnDist = document.getElementById('btn-measure-distance');
  const btnArea = document.getElementById('btn-measure-area');
  const btnClear = document.getElementById('btn-clear-measure');

  if (btnDist) {
    btnDist.addEventListener('click', () => {
      mapController.startMeasurement('distance');
    });
  }
  if (btnArea) {
    btnArea.addEventListener('click', () => {
      mapController.startMeasurement('area');
    });
  }
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      mapController.clearMeasurement();
    });
  }

  // 8. Report Modal Triggers
  const btnReportAction = document.getElementById('btn-download-report-action');
  const btnQuickReport = document.getElementById('btn-quick-report');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalPrint = document.getElementById('btn-modal-print');

  const openReport = () => {
    if (!state.simulationResult) {
      alert('Sila jalankan simulasi terlebih dahulu.');
      return;
    }
    openReportModal(state.simulationResult, state.currentPbt);
  };

  if (btnReportAction) btnReportAction.addEventListener('click', openReport);
  if (btnQuickReport) btnQuickReport.addEventListener('click', openReport);
  if (btnModalClose) btnModalClose.addEventListener('click', closeReportModal);
  if (btnModalPrint) btnModalPrint.addEventListener('click', printCurrentReport);
}

function updateUnitsLabel(typeId) {
  const label = document.getElementById('units-label');
  const dev = DEVELOPMENT_TYPES.find((d) => d.id === typeId);
  if (label && dev) {
    label.innerText = `Skala Cadangan (${dev.unitLabel || 'Bilangan Unit'})`;
  }
}

/**
 * Applies a preset site into form inputs and state
 */
function applyPresetSite(preset) {
  state.currentSiteName = preset.name;
  state.currentLat = preset.lat;
  state.currentLng = preset.lng;
  state.units = preset.defaultUnits;
  state.developmentTypeId = preset.developmentType;
  state.floors = preset.defaultFloors || 24;
  state.siteAreaAcres = preset.defaultArea || 3.5;

  // Sync PBT dropdown
  const pbtSelect = document.getElementById('pbt-select');
  if (pbtSelect && preset.pbtId) {
    pbtSelect.value = preset.pbtId;
    state.currentPbt = PBT_AUTHORITIES.find((p) => p.id === preset.pbtId) || state.currentPbt;
  }

  // Sync form inputs
  const siteInput = document.getElementById('site-name-input');
  const unitsInput = document.getElementById('units-input');
  const devTypeSelect = document.getElementById('dev-type-select');
  const floorsInput = document.getElementById('floors-input');
  const areaInput = document.getElementById('area-input');

  if (siteInput) siteInput.value = preset.name;
  if (unitsInput) unitsInput.value = preset.defaultUnits;
  if (devTypeSelect) devTypeSelect.value = preset.developmentType;
  if (floorsInput) floorsInput.value = state.floors;
  if (areaInput) areaInput.value = state.siteAreaAcres;

  updateUnitsLabel(preset.developmentType);
  runFullPipeline();
}

/**
 * Initializes Leaflet Map Controller
 */
function initMap() {
  mapController = new MapController('map');

  // Handle map click to pin proposed site
  mapController.onSiteSelected(async (lat, lng) => {
    state.currentLat = lat;
    state.currentLng = lng;
    const address = await reverseGeocode(lat, lng);
    state.currentSiteName = address.split(',').slice(0, 2).join(',');

    const siteInput = document.getElementById('site-name-input');
    if (siteInput) siteInput.value = state.currentSiteName;

    updateGeocodeDisplay(lat, lng, address);
    runFullPipeline();
  });
}

function readFormInputs() {
  const siteInput = document.getElementById('site-name-input');
  const unitsInput = document.getElementById('units-input');
  const devTypeSelect = document.getElementById('dev-type-select');
  const floorsInput = document.getElementById('floors-input');
  const areaInput = document.getElementById('area-input');

  if (siteInput) state.currentSiteName = siteInput.value.trim();
  if (unitsInput) state.units = parseInt(unitsInput.value, 10) || 350;
  if (devTypeSelect) state.developmentTypeId = devTypeSelect.value;
  if (floorsInput) state.floors = parseInt(floorsInput.value, 10) || 28;
  if (areaInput) state.siteAreaAcres = parseFloat(areaInput.value) || 3.5;
}

/**
 * Coordinates the Full 5-Step Pipeline
 */
async function runFullPipeline() {
  if (state.isSimulating) return;
  state.isSimulating = true;

  const btnSim = document.getElementById('btn-run-simulation');
  if (btnSim) {
    btnSim.disabled = true;
    btnSim.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Menjalankan Simulasi AI...
    `;
  }

  try {
    // STEP 1: User Input validation
    updateStepperProgress(1);
    const overlayTitle = document.getElementById('overlay-site-title');
    const dev = DEVELOPMENT_TYPES.find((d) => d.id === state.developmentTypeId);
    const unitLabel = dev ? dev.unitLabel : 'Unit';
    if (overlayTitle) overlayTitle.innerText = `${state.currentSiteName} (${state.units} ${unitLabel})`;

    // STEP 2: Geocoding via Nominatim
    updateStepperProgress(2);
    await executeStep2Geocoding();

    // Update map view with 1km buffer
    mapController.setProposedSite(state.currentLat, state.currentLng, state.currentSiteName, state.units);

    // STEP 3: Spatial Data Extraction via Overpass API (1km buffer)
    updateStepperProgress(3);
    state.spatialData = await queryOverpassRadius(state.currentLat, state.currentLng, 1000);
    mapController.renderSpatialInfrastructure(state.spatialData);

    // Render counts
    const countersContainer = document.getElementById('infra-counters-container');
    renderInfrastructureCounters(countersContainer, state.spatialData.counts);

    // STEP 4: AI Simulation Engine Calculations (TSI, TOD, Zoning/Heritage/JAS)
    updateStepperProgress(4);
    state.simulationResult = runSimulation({
      siteName: state.currentSiteName,
      units: state.units,
      developmentTypeId: state.developmentTypeId,
      floors: state.floors,
      siteAreaAcres: state.siteAreaAcres,
      spatialData: state.spatialData
    });

    // STEP 5: Visual Dashboard Output & Metric Hazard Cards
    updateStepperProgress(5);
    const hazardContainer = document.getElementById('hazard-cards-container');
    renderHazardCards(hazardContainer, state.simulationResult.results);

  } catch (err) {
    console.error('[MyPBTSim] Simulation pipeline error:', err);
  } finally {
    state.isSimulating = false;
    if (btnSim) {
      btnSim.disabled = false;
      btnSim.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Jalankan Simulasi Impak
      `;
    }
  }
}

async function executeStep2Geocoding() {
  try {
    const geoResult = await geocodeLocation(state.currentSiteName);
    state.currentLat = geoResult.lat;
    state.currentLng = geoResult.lng;
    updateGeocodeDisplay(geoResult.lat, geoResult.lng, geoResult.displayName);
  } catch (err) {
    console.warn('[Geocoding] Fallback:', err.message);
  }
}

function updateGeocodeDisplay(lat, lng, address) {
  const coordsDisplay = document.getElementById('geo-coords-display');
  const addressDisplay = document.getElementById('geo-address-display');

  if (coordsDisplay) {
    coordsDisplay.innerText = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  }
  if (addressDisplay) {
    addressDisplay.innerText = address;
  }
}
