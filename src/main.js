/**
 * MyPBTSim - Main Application Coordinator
 * Connects Step 1 (Input & PBT) -> Step 2 (Geocoding & Jurisdiction) -> Step 3 (Overpass Extraction)
 * -> Step 4 (AI Simulation & Council Policy) -> Step 5 (Visual Dashboard & Laporan Impak)
 * 
 * Features:
 * 1. Auto-populated Dynamic Nearby Locations (Flyout while typing)
 * 2. Auto-assign PBT on location pinpoint
 * 3. Distinctive colors for each PBT layer
 * 4. Selectable visual icons for Basemaps
 * 5. Single unified action & cancel button with live stopwatch timer
 * 6. Pure, clean formal Bahasa Melayu interface
 * 7. Report button disabled until analysis complete with highlight
 */

import { MALAYSIA_STATES, PBT_ALL_DATABASE } from './config/pbt-database.js';
import { PRESET_SITES, DEVELOPMENT_TYPES } from './config/pbt-presets.js';
import { geocodeLocation, reverseGeocode, fetchNearbySuggestions, isWithinMalaysia } from './services/geocoding.js';
import { queryOverpassRadius } from './services/overpass.js';
import { runSimulation } from './services/simulation.js';
import { JurisdictionEngine } from './services/jurisdiction.js';
import { fetchTerrainElevation } from './services/elevation.js';
import { MapController } from './map/map-controller.js';
import { renderHazardCards, renderEmptyHazardCards } from './ui/hazard-cards.js';
import { renderInfrastructureCounters, renderEmptyInfrastructureCounters, updateStepperProgress } from './ui/summary-panel.js';
import { openReportModal, closeReportModal, printCurrentReport } from './ui/report-generator.js';

// Application State
const state = {
  selectedStateId: 'kl',
  currentPbt: PBT_ALL_DATABASE[0], // Default DBKL
  currentSiteName: 'Kampung Baru, Kuala Lumpur',
  lastGeocodedName: 'Kampung Baru, Kuala Lumpur',
  currentLat: 3.1612,
  currentLng: 101.7088,
  addressDetails: {},
  jurisdictionResult: null,
  terrainData: null,
  isManualPbtSelection: false, // true only when user explicitly overrides PBT dropdown
  units: 350,
  developmentTypeId: 'high_rise_residential',
  floors: 28,
  siteAreaAcres: 3.5,
  policyOptions: {
    affordableHousingPercent: 20,
    slopeClass: 'kelas_1',
    elevationMeters: 25,
    greenCertification: 'certified',
    industrialBufferMeters: 50,
    pue: 1.35
  },
  spatialData: null,
  simulationResult: null,
  isSimulating: false
};

let mapController = null;
let lastSuccessfulSnapshot = null;
let activeAbortController = null;
let nearbyDebounceTimer = null;
let simulationTimer = null;
let simulationSeconds = 0;
let simulationStartTime = 0;

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initMap();
  updateNearbyLocationChips(state.currentSiteName, state.currentPbt);
  updatePolicyOptionsForTargetPbt(state.currentPbt, state.developmentTypeId);
  initInitialSiteView(); // Lazy Load: Instant map setup with ZERO network API spam on refresh!
});

/**
 * Sets up initial site view and ready state without making any external API calls on page refresh
 */
function initInitialSiteView() {
  if (mapController) {
    mapController.setProposedSite(state.currentLat, state.currentLng, state.currentSiteName, state.units);
  }

  state.jurisdictionResult = JurisdictionEngine.validateJurisdiction(
    state.currentPbt.id,
    state.currentLat,
    state.currentLng,
    state.currentSiteName,
    { city: 'Kuala Lumpur', state: 'Wilayah Persekutuan Kuala Lumpur' }
  );

  renderJurisdictionBanner(state.jurisdictionResult);
  updateGeocodeDisplay(state.currentLat, state.currentLng, state.currentSiteName, state.terrainData);

  // Fetch initial terrain elevation & slope gradient immediately on site set
  fetchTerrainElevation(state.currentLat, state.currentLng).then((terrain) => {
    state.terrainData = terrain;
    state.policyOptions.elevationMeters = terrain.elevation;
    state.policyOptions.slopeClass = terrain.slopeClass;
    updateGeocodeDisplay(state.currentLat, state.currentLng, state.currentSiteName, terrain);
  }).catch(() => {});

  const overlayTitle = document.getElementById('overlay-site-title');
  const overlayPbtSub = document.getElementById('overlay-pbt-sub');
  const dev = DEVELOPMENT_TYPES.find((d) => d.id === state.developmentTypeId);
  const unitLabel = dev ? dev.unitLabel : 'Unit';

  if (overlayTitle) overlayTitle.innerText = `${state.currentSiteName} (${state.units} ${unitLabel})`;
  if (overlayPbtSub) overlayPbtSub.innerText = `PBT: ${state.currentPbt.shortName} (${state.currentPbt.stateName}) | Zon Penampan 1,000m`;

  // Render clean, informative empty-state placeholders (Waiting for OSM / Analysis)
  renderEmptyInfrastructureCounters(document.getElementById('infra-counters-container'));
  renderEmptyHazardCards(document.getElementById('hazard-cards-container'));

  updateStepperProgress(1);
  setReportButtonAvailable(false);
}

/**
 * Initialize UI Form Controls, State Dropdowns, Jurisdiction Listeners
 */
function initUI() {
  // 1. Populate State Filter Dropdown
  const stateSelect = document.getElementById('state-filter-select');
  if (stateSelect) {
    stateSelect.innerHTML = [
      `<option value="all">Semua Negeri & WP (${MALAYSIA_STATES.length})</option>`,
      ...MALAYSIA_STATES.map((s) => `<option value="${s.id}" ${s.id === state.selectedStateId ? 'selected' : ''}>${s.name}</option>`)
    ].join('');

    stateSelect.addEventListener('change', (e) => {
      state.selectedStateId = e.target.value;
      state.isManualPbtSelection = true;
      populatePbtDropdown(e.target.value);
      const pbtSelect = document.getElementById('pbt-select');
      if (pbtSelect) {
        const selected = PBT_ALL_DATABASE.find((p) => p.id === pbtSelect.value);
        if (selected) {
          handleManualPbtSelection(selected);
        }
      }
    });
  }

  // 2. Populate Initial PBT Dropdown
  populatePbtDropdown(state.selectedStateId);

  const pbtSelect = document.getElementById('pbt-select');
  if (pbtSelect) {
    pbtSelect.addEventListener('change', (e) => {
      const selected = PBT_ALL_DATABASE.find((p) => p.id === e.target.value);
      if (selected) {
        handleManualPbtSelection(selected);
      }
    });
  }

  // 3. Populate Development Types with Pure Bahasa Melayu Categories
  const devTypeSelect = document.getElementById('dev-type-select');
  if (devTypeSelect) {
    const categories = [
      { id: 'residential', label: '🏠 Projek Kediaman' },
      { id: 'commercial', label: '🏢 Projek Komersial & Perniagaan' },
      { id: 'industrial', label: '🏭 Projek Perindustrian & Teknologi' },
      { id: 'logistics', label: '🚛 Hab Logistik & Pergudangan' },
      { id: 'institutional', label: '🏥 Institusi Kesihatan & Awam' },
      { id: 'heritage', label: '🏛️ Zon Warisan & Pelancongan' }
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
      updatePolicyOptionsForTargetPbt(state.currentPbt, e.target.value);
    });
  }

  // 4. Dynamic Nearby Location Autocomplete Flyout (Shows only while typing/focusing)
  const siteInput = document.getElementById('site-name-input');
  const siteInputGroup = document.getElementById('site-input-group');
  const autocompleteFlyout = document.getElementById('autocomplete-flyout');

  if (siteInput && autocompleteFlyout) {
    const showFlyout = () => {
      autocompleteFlyout.style.display = 'block';
    };

    const hideFlyout = () => {
      autocompleteFlyout.style.display = 'none';
    };

    siteInput.addEventListener('focus', () => {
      showFlyout();
      updateNearbyLocationChips(siteInput.value, state.currentPbt);
    });

    siteInput.addEventListener('input', (e) => {
      showFlyout();
      state.isManualPbtSelection = false; // User typed a new location
      clearTimeout(nearbyDebounceTimer);
      nearbyDebounceTimer = setTimeout(() => {
        updateNearbyLocationChips(e.target.value, state.currentPbt);
      }, 350);
    });

    siteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        hideFlyout();
      }
    });

    // Close flyout when clicking outside
    document.addEventListener('click', (e) => {
      if (siteInputGroup && !siteInputGroup.contains(e.target)) {
        hideFlyout();
      }
    });
  }

  const presetsContainer = document.getElementById('presets-container');
  if (presetsContainer) {
    presetsContainer.addEventListener('click', (e) => {
      const row = e.target.closest('.suggestion-row');
      if (!row) return;

      if (autocompleteFlyout) {
        autocompleteFlyout.style.display = 'none';
      }

      state.isManualPbtSelection = false; // Selecting a location preset
      document.querySelectorAll('.suggestion-row').forEach((c) => c.classList.remove('active'));
      row.classList.add('active');

      const name = row.dataset.name;
      const fullName = row.dataset.fullname || name;
      const lat = parseFloat(row.dataset.lat);
      const lng = parseFloat(row.dataset.lng);
      const pbtId = row.dataset.pbt;

      if (!isNaN(lat) && !isNaN(lng)) {
        updateSiteLocationOnly(lat, lng, fullName, {}, pbtId);
      }
    });
  }

  // 5. Policy Options Accordion Toggle
  const btnAccordion = document.getElementById('btn-toggle-policy-options');
  const accordionBody = document.getElementById('policy-options-body');
  const arrow = document.getElementById('accordion-arrow');

  if (btnAccordion && accordionBody) {
    btnAccordion.addEventListener('click', () => {
      const isOpen = accordionBody.style.display !== 'none';
      accordionBody.style.display = isOpen ? 'none' : 'flex';
      if (arrow) arrow.innerText = isOpen ? '▾' : '▴';
    });
  }

  // Range Slider value sync
  const sliderAffordable = document.getElementById('opt-affordable-percent');
  const valAffordable = document.getElementById('affordable-percent-val');
  if (sliderAffordable && valAffordable) {
    sliderAffordable.addEventListener('input', (e) => {
      valAffordable.innerText = `${e.target.value}%`;
      state.policyOptions.affordableHousingPercent = parseInt(e.target.value, 10);
    });
  }

  // 6. Form Submission & Unified Run/Cancel Button
  const btnSim = document.getElementById('btn-run-simulation');
  if (btnSim) {
    btnSim.addEventListener('click', (e) => {
      if (state.isSimulating) {
        e.preventDefault();
        // Guard against rapid click / accidental cancel on startup
        if (Date.now() - simulationStartTime < 800) {
          return;
        }
        cancelSimulationAndRollback();
      }
    });
  }

  const form = document.getElementById('simulation-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (autocompleteFlyout) autocompleteFlyout.style.display = 'none';
      state.isManualPbtSelection = false; // Running simulation on entered location
      if (!state.isSimulating) {
        readFormInputs();
        runFullPipeline();
      }
    });
  }

  // 7. Manual Geocoding Search Button
  const btnSearch = document.getElementById('btn-geocode-search');
  if (btnSearch) {
    btnSearch.addEventListener('click', async () => {
      if (autocompleteFlyout) autocompleteFlyout.style.display = 'none';
      state.isManualPbtSelection = false; // Explicit search on entered location
      readFormInputs();
      if (!state.currentSiteName) return;

      try {
        const geoResult = await geocodeLocation(state.currentSiteName);
        const cleanName = geoResult.displayName.split(',').slice(0, 2).join(',');
        updateSiteLocationOnly(geoResult.lat, geoResult.lng, cleanName, geoResult.addressDetails || {});
      } catch (err) {
        console.error('Geocoding search failed:', err);
      }
    });
  }

  // 8. Quick Report Modal Open/Close & Print
  const btnQuickReport = document.getElementById('btn-quick-report');
  if (btnQuickReport) {
    btnQuickReport.addEventListener('click', () => {
      if (state.simulationResult) {
        openReportModal(state.simulationResult, state.currentPbt);
      }
    });
  }

  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeReportModal);
  }

  const btnPrintReport = document.getElementById('btn-print-report');
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', printCurrentReport);
  }

  // Close modal when clicking outside
  const reportModal = document.getElementById('report-modal');
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        closeReportModal();
      }
    });
  }

  // 9. Selectable Basemap Icon Bar Listeners
  const basemapGroup = document.getElementById('basemap-icon-group');
  if (basemapGroup) {
    basemapGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.basemap-icon-btn');
      if (!btn) return;

      document.querySelectorAll('.basemap-icon-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const basemapType = btn.dataset.basemap;
      if (mapController && basemapType) {
        mapController.setBasemap(basemapType);
      }
    });
  }

  // 10. Layer Toggle Buttons Listeners
  document.querySelectorAll('.layer-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const isActive = btn.classList.toggle('active');
      if (mapController && layer) {
        mapController.toggleLayer(layer, isActive);
      }
    });
  });

  // 11. Measuring Tools Listeners
  const btnDist = document.getElementById('btn-measure-distance');
  const btnArea = document.getElementById('btn-measure-area');
  const btnClear = document.getElementById('btn-clear-measure');

  if (btnDist) {
    btnDist.addEventListener('click', () => {
      if (mapController) mapController.startMeasurement('distance');
    });
  }
  if (btnArea) {
    btnArea.addEventListener('click', () => {
      if (mapController) mapController.startMeasurement('area');
    });
  }
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (mapController) mapController.clearMeasurement();
    });
  }

  // 12. Zoom & Camera Navigation Listeners
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFitSite = document.getElementById('btn-zoom-fit-site');
  const btnZoomFitMalaysia = document.getElementById('btn-zoom-fit-malaysia');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      if (mapController) mapController.zoomIn();
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      if (mapController) mapController.zoomOut();
    });
  }
  if (btnZoomFitSite) {
    btnZoomFitSite.addEventListener('click', () => {
      if (mapController) mapController.fitSite();
    });
  }
  if (btnZoomFitMalaysia) {
    btnZoomFitMalaysia.addEventListener('click', () => {
      if (mapController) mapController.fitMalaysia();
    });
  }
}

/**
 * Dynamically updates the "Lokasi Pantas" suggestions
 */
async function updateNearbyLocationChips(queryText = '', pbtInfo = state.currentPbt) {
  const container = document.getElementById('presets-container');
  const loadingIndicator = document.getElementById('presets-loading-indicator');
  if (!container) return;

  if (loadingIndicator) loadingIndicator.style.display = 'inline';

  try {
    const suggestions = await fetchNearbySuggestions(queryText, pbtInfo);
    if (loadingIndicator) loadingIndicator.style.display = 'none';

    if (suggestions.length === 0) {
      container.innerHTML = `
        <div style="padding: 0.75rem; font-size: 0.74rem; color: #94a3b8; text-align: center;">
          Tiada cadangan lokasi dijumpai. Sila taip carian atau klik pada peta.
        </div>
      `;
      return;
    }

    container.innerHTML = suggestions
      .map(
        (s) => `
        <div class="suggestion-row" 
          data-id="${s.id}" 
          data-lat="${s.lat}" 
          data-lng="${s.lng}" 
          data-name="${s.name}" 
          data-fullname="${s.fullName || s.name}"
          data-pbt="${s.pbtId || ''}">
          <div class="suggestion-icon">
            ${s.type === 'preset' ? '📍' : s.type === 'pbt' ? '🏛️' : '🔍'}
          </div>
          <div class="suggestion-info">
            <div class="suggestion-title">${s.name}</div>
            <div class="suggestion-sub">${s.subtitle || ''}</div>
          </div>
          ${s.badge ? `<div class="suggestion-badge">${s.badge}</div>` : ''}
        </div>
      `
      )
      .join('');
  } catch (err) {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/**
 * Populates PBT Council Dropdown based on State Filter
 */
function populatePbtDropdown(stateId = 'all') {
  const pbtSelect = document.getElementById('pbt-select');
  if (!pbtSelect) return;

  const filteredPbts = stateId === 'all' ? PBT_ALL_DATABASE : PBT_ALL_DATABASE.filter((p) => p.stateId === stateId);

  pbtSelect.innerHTML = filteredPbts
    .map(
      (p) => `<option value="${p.id}" ${p.id === state.currentPbt.id ? 'selected' : ''}>
        ${p.shortName} - ${p.name}
      </option>`
    )
    .join('');

  if (!filteredPbts.some((p) => p.id === state.currentPbt.id) && filteredPbts.length > 0) {
    state.currentPbt = filteredPbts[0];
    pbtSelect.value = filteredPbts[0].id;
  }
}

function updateUnitsLabel(typeId) {
  const label = document.getElementById('units-label');
  const dev = DEVELOPMENT_TYPES.find((d) => d.id === typeId);
  if (label && dev) {
    label.innerText = `Skala Cadangan (${dev.unitLabel || 'Bilangan Unit'})`;
  }
}

/**
 * Resets any previous simulation results to clean idle/ready state
 * when a user relocates or changes to a new site.
 */
function resetSimulationToReadyState() {
  state.spatialData = null;
  state.simulationResult = null;

  if (mapController) {
    mapController.clearSpatialLayers();
  }

  const countersContainer = document.getElementById('infra-counters-container');
  if (countersContainer) renderEmptyInfrastructureCounters(countersContainer);

  const hazardContainer = document.getElementById('hazard-cards-container');
  if (hazardContainer) renderEmptyHazardCards(hazardContainer);

  setReportButtonAvailable(false);
  updateStepperProgress(1);
}

/**
 * Handles site change to a new location without automatically triggering the heavy simulation.
 * Updates coordinates, map buffer, auto-detects PBT, and sets UI to clean ready state.
 */
function updateSiteLocationOnly(lat, lng, siteName, addressDetails = {}, pbtId = null) {
  if (!isWithinMalaysia(lat, lng, addressDetails)) {
    console.warn('[Update Site Location] Lokasi di luar Malaysia diabaikan:', lat, lng);
    return;
  }

  state.currentLat = lat;
  state.currentLng = lng;
  state.currentSiteName = siteName;
  state.lastGeocodedName = siteName;
  state.addressDetails = addressDetails;

  const siteInput = document.getElementById('site-name-input');
  if (siteInput) siteInput.value = siteName;

  const flyout = document.getElementById('autocomplete-flyout');
  if (flyout) flyout.style.display = 'none';

  // Auto-Detect PBT using single source of truth
  const detectedPbt = JurisdictionEngine.detectPBTFromLocation(lat, lng, siteName, addressDetails);
  const targetPbt = detectedPbt || (pbtId ? PBT_ALL_DATABASE.find((p) => p.id === pbtId) : PBT_ALL_DATABASE[0]);

  if (targetPbt) {
    state.currentPbt = targetPbt;
    state.selectedStateId = targetPbt.stateId;
    state.isManualPbtSelection = false;

    const stateSelect = document.getElementById('state-filter-select');
    if (stateSelect) stateSelect.value = targetPbt.stateId;
    populatePbtDropdown(targetPbt.stateId);

    const pbtSelect = document.getElementById('pbt-select');
    if (pbtSelect) pbtSelect.value = targetPbt.id;

    const overlayPbtSub = document.getElementById('overlay-pbt-sub');
    if (overlayPbtSub) {
      overlayPbtSub.innerText = `PBT: ${targetPbt.shortName} (${targetPbt.stateName}) | Zon Penampan 1,000m`;
    }

    updatePolicyOptionsForTargetPbt(targetPbt, state.developmentTypeId);
  }

  // Update map view with 1km buffer ring
  if (mapController) {
    mapController.setProposedSite(lat, lng, siteName, state.units);
  }

  // Update overlay title
  const overlayTitle = document.getElementById('overlay-site-title');
  const dev = DEVELOPMENT_TYPES.find((d) => d.id === state.developmentTypeId);
  const unitLabel = dev ? dev.unitLabel : 'Unit';
  if (overlayTitle) overlayTitle.innerText = `${siteName} (${state.units} ${unitLabel})`;

  // Validate jurisdiction banner
  state.jurisdictionResult = JurisdictionEngine.validateJurisdiction(
    state.currentPbt.id,
    lat,
    lng,
    siteName,
    addressDetails
  );
  renderJurisdictionBanner(state.jurisdictionResult);
  updateGeocodeDisplay(lat, lng, siteName, state.terrainData);
  updateNearbyLocationChips(siteName, state.currentPbt);

  // Fetch real-time satellite elevation & slope gradient in background
  fetchTerrainElevation(lat, lng).then((terrain) => {
    state.terrainData = terrain;
    state.policyOptions.elevationMeters = terrain.elevation;
    state.policyOptions.slopeClass = terrain.slopeClass;
    updateGeocodeDisplay(lat, lng, siteName, terrain);
  }).catch(() => {});

  // Clean reset of previous simulation results to ready state (zero Overpass queries!)
  resetSimulationToReadyState();
}

/**
 * Applies a preset site into form inputs and state (without auto-starting simulation)
 */
function applyPresetSite(preset) {
  state.units = preset.defaultUnits;
  state.developmentTypeId = preset.developmentType;
  state.floors = preset.defaultFloors || 24;
  state.siteAreaAcres = preset.defaultArea || 3.5;

  const unitsInput = document.getElementById('units-input');
  const devTypeSelect = document.getElementById('dev-type-select');
  const floorsInput = document.getElementById('floors-input');
  const areaInput = document.getElementById('area-input');

  if (unitsInput) unitsInput.value = preset.defaultUnits;
  if (devTypeSelect) devTypeSelect.value = preset.developmentType;
  if (floorsInput) floorsInput.value = state.floors;
  if (areaInput) areaInput.value = state.siteAreaAcres;

  updateUnitsLabel(preset.developmentType);
  updateSiteLocationOnly(preset.lat, preset.lng, preset.name, {}, preset.pbtId);
}

/**
 * Initializes Leaflet Map Controller & Auto-Assigns PBT on Pinpoint (without auto-starting simulation)
 */
function initMap() {
  mapController = new MapController('map');

  // Handle map click to pin proposed site (pre-validated and geo-resolved)
  mapController.onSiteSelected(async (lat, lng, geo = null) => {
    try {
      const geoResolved = geo || await reverseGeocode(lat, lng, activeAbortController ? activeAbortController.signal : null);
      if (!isWithinMalaysia(lat, lng, geoResolved.addressDetails || {})) {
        console.warn('[Map Click] Titik di luar wilayah Malaysia diabaikan.');
        return;
      }
      const siteName = geoResolved.displayName ? geoResolved.displayName.split(',').slice(0, 2).join(',') : `Tapak (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      updateSiteLocationOnly(lat, lng, siteName, geoResolved.addressDetails || {});
    } catch (err) {
      console.error('Reverse geocode error:', err);
      updateSiteLocationOnly(lat, lng, `Tapak (${lat.toFixed(4)}, ${lng.toFixed(4)})`, {});
    }
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

  // Read policy options
  const optSlope = document.getElementById('opt-slope-class');
  const optElev = document.getElementById('opt-elevation-meters');
  const optGreen = document.getElementById('opt-green-cert');
  const optIndBuf = document.getElementById('opt-industrial-buffer');
  const optPue = document.getElementById('opt-pue');

  if (optSlope) state.policyOptions.slopeClass = optSlope.value;
  if (optElev) state.policyOptions.elevationMeters = parseFloat(optElev.value) || 25;
  if (optGreen) state.policyOptions.greenCertification = optGreen.value;
  if (optIndBuf) state.policyOptions.industrialBufferMeters = parseFloat(optIndBuf.value) || 50;
  if (optPue) state.policyOptions.pue = parseFloat(optPue.value) || 1.35;
}

/**
 * Coordinates the Full 5-Step Pipeline with Live Stopwatch & Unified Cancel Support
 */
async function runFullPipeline() {
  if (state.isSimulating) return;
  state.isSimulating = true;
  simulationStartTime = Date.now();

  // Create new AbortController for cancelation
  activeAbortController = new AbortController();

  const btnSim = document.getElementById('btn-run-simulation');
  const btnIcon = document.getElementById('btn-sim-icon');
  const btnText = document.getElementById('btn-sim-text');

  // Start live timer
  simulationSeconds = 0;
  if (btnSim) {
    btnSim.classList.remove('simulating-success');
    btnSim.classList.add('simulating-active');
    if (btnIcon) {
      btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>`;
    }
    if (btnText) {
      btnText.innerText = 'Sedang Memproses (0s) • Batal';
    }
  }

  clearInterval(simulationTimer);
  simulationTimer = setInterval(() => {
    simulationSeconds++;
    if (btnText && state.isSimulating) {
      btnText.innerText = `Sedang Memproses (${simulationSeconds}s) • Batal`;
    }
  }, 1000);

  setReportButtonAvailable(false);

  try {
    // STEP 1: User Input validation
    updateStepperProgress(1);
    const overlayTitle = document.getElementById('overlay-site-title');
    const overlayPbtSub = document.getElementById('overlay-pbt-sub');
    const dev = DEVELOPMENT_TYPES.find((d) => d.id === state.developmentTypeId);
    const unitLabel = dev ? dev.unitLabel : 'Unit';

    if (overlayTitle) overlayTitle.innerText = `${state.currentSiteName} (${state.units} ${unitLabel})`;
    if (overlayPbtSub) overlayPbtSub.innerText = `PBT: ${state.currentPbt.shortName} (${state.currentPbt.stateName}) | Zon Penampan 1,000m`;

    // STEP 2: Geocoding & Jurisdiction Verification
    updateStepperProgress(2);
    await executeStep2GeocodingAndJurisdiction(activeAbortController.signal);

    // Update map view with 1km buffer
    mapController.setProposedSite(state.currentLat, state.currentLng, state.currentSiteName, state.units);

    // If jurisdiction conflict is detected, halt immediately before Overpass query to save API rate limits!
    if (state.jurisdictionResult && !state.jurisdictionResult.isValid) {
      updateStepperProgress(4);
      state.spatialData = { counts: { rail: 0, bus: 0, education: 0, worship: 0, heritage: 0, total: 0 }, rail: [], bus: [], education: [], worship: [], heritage: [] };
      mapController.renderSpatialInfrastructure(state.spatialData);

      const countersContainer = document.getElementById('infra-counters-container');
      renderInfrastructureCounters(countersContainer, state.spatialData.counts);

      state.simulationResult = runSimulation({
        pbtId: state.currentPbt.id,
        siteName: state.currentSiteName,
        units: state.units,
        developmentTypeId: state.developmentTypeId,
        floors: state.floors,
        siteAreaAcres: state.siteAreaAcres,
        spatialData: state.spatialData,
        jurisdictionResult: state.jurisdictionResult,
        policyOptions: state.policyOptions
      });

      updateStepperProgress(5);
      const hazardContainer = document.getElementById('hazard-cards-container');
      renderHazardCards(hazardContainer, state.simulationResult.results);

      // Immediately show the official conflict resolution dialog
      openPbtConflictDialog(state.jurisdictionResult);
      return;
    }

    // STEP 3: Spatial Data Extraction via Overpass API
    updateStepperProgress(3);
    state.spatialData = await queryOverpassRadius(state.currentLat, state.currentLng, 1000, activeAbortController.signal);
    mapController.renderSpatialInfrastructure(state.spatialData);

    // Render counts
    const countersContainer = document.getElementById('infra-counters-container');
    renderInfrastructureCounters(countersContainer, state.spatialData.counts);

    // STEP 4: AI Simulation Engine Calculations
    updateStepperProgress(4);
    state.simulationResult = runSimulation({
      pbtId: state.currentPbt.id,
      siteName: state.currentSiteName,
      units: state.units,
      developmentTypeId: state.developmentTypeId,
      floors: state.floors,
      siteAreaAcres: state.siteAreaAcres,
      spatialData: state.spatialData,
      jurisdictionResult: state.jurisdictionResult,
      policyOptions: state.policyOptions
    });

    // STEP 5: Visual Dashboard Output & Metric Hazard Cards
    updateStepperProgress(5);
    const hazardContainer = document.getElementById('hazard-cards-container');
    renderHazardCards(hazardContainer, state.simulationResult.results);

    // Save successful analysis snapshot for cancel / rollback
    lastSuccessfulSnapshot = {
      selectedStateId: state.selectedStateId,
      currentPbt: { ...state.currentPbt },
      currentSiteName: state.currentSiteName,
      currentLat: state.currentLat,
      currentLng: state.currentLng,
      addressDetails: { ...state.addressDetails },
      jurisdictionResult: state.jurisdictionResult,
      units: state.units,
      developmentTypeId: state.developmentTypeId,
      floors: state.floors,
      siteAreaAcres: state.siteAreaAcres,
      policyOptions: { ...state.policyOptions },
      spatialData: JSON.parse(JSON.stringify(state.spatialData)),
      simulationResult: JSON.parse(JSON.stringify(state.simulationResult))
    };

    // Enable "Laporan Tersedia" with highlight
    setReportButtonAvailable(true);

    if (btnSim) {
      btnSim.classList.remove('simulating-active');
      btnSim.classList.add('simulating-success');
      if (btnIcon) {
        btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      }
      if (btnText) {
        btnText.innerText = 'Simulasi Selesai';
      }
      setTimeout(() => {
        if (!state.isSimulating) {
          btnSim.classList.remove('simulating-success');
          if (btnIcon) btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          if (btnText) btnText.innerText = 'Jalankan Simulasi Impak';
        }
      }, 1200);
    }

  } catch (err) {
    if (activeAbortController && activeAbortController.signal.aborted) {
      console.log('[MyPBTSim] Proses simulasi telah dibatalkan oleh pengguna.');
    } else {
      console.error('[MyPBTSim] Simulation pipeline error:', err);
    }
  } finally {
    state.isSimulating = false;
    activeAbortController = null;
    clearInterval(simulationTimer);

    if (btnSim && !btnSim.classList.contains('simulating-success')) {
      btnSim.classList.remove('simulating-active');
      if (btnIcon) {
        btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      }
      if (btnText) {
        btnText.innerText = 'Jalankan Simulasi Impak';
      }
    }
  }
}

/**
 * Cancels current running simulation and reverts state to last successful analysis
 */
function cancelSimulationAndRollback() {
  if (activeAbortController) {
    activeAbortController.abort();
  }

  state.isSimulating = false;
  clearInterval(simulationTimer);

  const btnSim = document.getElementById('btn-run-simulation');
  const btnIcon = document.getElementById('btn-sim-icon');
  const btnText = document.getElementById('btn-sim-text');

  if (btnSim) {
    btnSim.classList.remove('simulating-active', 'simulating-success');
    if (btnIcon) {
      btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
    if (btnText) {
      btnText.innerText = 'Jalankan Simulasi Impak';
    }
  }

  // Restore snapshot if available
  if (lastSuccessfulSnapshot) {
    state.selectedStateId = lastSuccessfulSnapshot.selectedStateId;
    state.currentPbt = { ...lastSuccessfulSnapshot.currentPbt };
    state.currentSiteName = lastSuccessfulSnapshot.currentSiteName;
    state.currentLat = lastSuccessfulSnapshot.currentLat;
    state.currentLng = lastSuccessfulSnapshot.currentLng;
    state.addressDetails = { ...lastSuccessfulSnapshot.addressDetails };
    state.jurisdictionResult = lastSuccessfulSnapshot.jurisdictionResult;
    state.units = lastSuccessfulSnapshot.units;
    state.developmentTypeId = lastSuccessfulSnapshot.developmentTypeId;
    state.floors = lastSuccessfulSnapshot.floors;
    state.siteAreaAcres = lastSuccessfulSnapshot.siteAreaAcres;
    state.policyOptions = { ...lastSuccessfulSnapshot.policyOptions };
    state.spatialData = JSON.parse(JSON.stringify(lastSuccessfulSnapshot.spatialData));
    state.simulationResult = JSON.parse(JSON.stringify(lastSuccessfulSnapshot.simulationResult));

    // Restore form values
    const siteInput = document.getElementById('site-name-input');
    const unitsInput = document.getElementById('units-input');
    const devTypeSelect = document.getElementById('dev-type-select');
    const floorsInput = document.getElementById('floors-input');
    const areaInput = document.getElementById('area-input');

    if (siteInput) siteInput.value = state.currentSiteName;
    if (unitsInput) unitsInput.value = state.units;
    if (devTypeSelect) devTypeSelect.value = state.developmentTypeId;
    if (floorsInput) floorsInput.value = state.floors;
    if (areaInput) areaInput.value = state.siteAreaAcres;

    // Restore PBT dropdown
    const stateSelect = document.getElementById('state-filter-select');
    if (stateSelect) stateSelect.value = state.selectedStateId;
    populatePbtDropdown(state.selectedStateId);
    const pbtSelect = document.getElementById('pbt-select');
    if (pbtSelect) pbtSelect.value = state.currentPbt.id;

    // Re-render map and dashboard
    mapController.setProposedSite(state.currentLat, state.currentLng, state.currentSiteName, state.units);
    mapController.renderSpatialInfrastructure(state.spatialData);
    renderInfrastructureCounters(document.getElementById('infra-counters-container'), state.spatialData.counts);
    renderHazardCards(document.getElementById('hazard-cards-container'), state.simulationResult.results);
    renderJurisdictionBanner(state.jurisdictionResult);
    updateGeocodeDisplay(state.currentLat, state.currentLng, state.currentSiteName);
    updateNearbyLocationChips(state.currentSiteName, state.currentPbt);
    updateStepperProgress(5);
    setReportButtonAvailable(true);
  }
}

/**
 * Toggles report button availability state with pulsing highlight
 */
function setReportButtonAvailable(isAvailable) {
  const btn = document.getElementById('btn-quick-report');
  const btnText = document.getElementById('report-btn-text');
  if (!btn) return;

  if (isAvailable && state.simulationResult) {
    btn.disabled = false;
    btn.classList.remove('disabled-report-btn');
    btn.classList.add('btn-report-available');
    if (btnText) btnText.innerText = 'Laporan Tersedia';
  } else {
    btn.disabled = true;
    btn.classList.add('disabled-report-btn');
    btn.classList.remove('btn-report-available');
    if (btnText) btnText.innerText = 'Laporan Belum Sedia';
  }
}

async function executeStep2GeocodingAndJurisdiction(signal = null) {
  try {
    let lat = state.currentLat;
    let lng = state.currentLng;
    let displayName = state.currentSiteName;
    let addressDetails = state.addressDetails || {};

    const hasPinnedLocation =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      state.lastGeocodedName &&
      state.lastGeocodedName.trim().toLowerCase() === state.currentSiteName.trim().toLowerCase();

    if (!hasPinnedLocation) {
      const geoResult = await geocodeLocation(state.currentSiteName, signal);
      lat = geoResult.lat;
      lng = geoResult.lng;
      displayName = geoResult.displayName;
      addressDetails = geoResult.addressDetails || {};

      state.currentLat = lat;
      state.currentLng = lng;
      state.addressDetails = addressDetails;
      state.lastGeocodedName = state.currentSiteName;
    }

    const detectedPbt = JurisdictionEngine.detectPBTFromLocation(
      lat,
      lng,
      displayName,
      addressDetails
    );

    // If user changed location (e.g. from KL to Alor Gajah), automatically assign MPAG seamlessly!
    if (!state.isManualPbtSelection && detectedPbt && state.currentPbt.id !== detectedPbt.id) {
      state.currentPbt = detectedPbt;
      state.selectedStateId = detectedPbt.stateId;

      const stateSelect = document.getElementById('state-filter-select');
      if (stateSelect) stateSelect.value = detectedPbt.stateId;
      populatePbtDropdown(detectedPbt.stateId);

      const pbtSelect = document.getElementById('pbt-select');
      if (pbtSelect) pbtSelect.value = detectedPbt.id;

      const overlayPbtSub = document.getElementById('overlay-pbt-sub');
      if (overlayPbtSub) {
        overlayPbtSub.innerText = `PBT: ${detectedPbt.shortName} (${detectedPbt.stateName}) | Zon Penampan 1,000m`;
      }

      updatePolicyOptionsForTargetPbt(detectedPbt, state.developmentTypeId);
    }

    // Fetch real-time satellite elevation and calculate ground slope gradient
    let terrain = state.terrainData;
    if (!terrain) {
      terrain = await fetchTerrainElevation(lat, lng);
      state.terrainData = terrain;
    }
    state.policyOptions.elevationMeters = terrain.elevation;
    state.policyOptions.slopeClass = terrain.slopeClass;

    // Validate Spatial Jurisdiction against selected PBT
    // If the user manually selected an unmatched PBT, this generates a clear warning banner!
    state.jurisdictionResult = JurisdictionEngine.validateJurisdiction(
      state.currentPbt.id,
      lat,
      lng,
      displayName,
      addressDetails
    );

    renderJurisdictionBanner(state.jurisdictionResult);
    updateGeocodeDisplay(lat, lng, displayName, terrain);
  } catch (err) {
    if (signal && signal.aborted) throw err;
    console.warn('[Geocoding] Fallback:', err.message);
  }
}

/**
 * Updates Geocoding status box in Card 2 with clean address, coordinates, and live satellite elevation / slope
 */
function updateGeocodeDisplay(lat, lng, displayName, terrainData = null) {
  const addressDisplay = document.getElementById('geo-address-display');
  const coordsVal = document.getElementById('geo-coords-val');
  const elevVal = document.getElementById('geo-elevation-val');
  const slopeVal = document.getElementById('geo-slope-val');

  if (addressDisplay) {
    addressDisplay.innerText = displayName || 'Tapak Cadangan';
  }
  if (coordsVal) {
    coordsVal.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  if (elevVal && slopeVal) {
    if (terrainData) {
      elevVal.innerText = `${terrainData.elevation}m`;
      const shortClass = terrainData.slopeClassLabel ? terrainData.slopeClassLabel.split('-')[0].trim() : 'Kelas I';
      slopeVal.innerText = `${terrainData.slopeDegrees}° (${shortClass})`;
    } else {
      elevVal.innerText = `...`;
      slopeVal.innerText = `...`;
    }
  }
}

function renderJurisdictionBanner(jurisdiction) {
  const container = document.getElementById('jurisdiction-banner');
  if (!container || !jurisdiction) return;

  if (jurisdiction.isValid) {
    container.className = 'jurisdiction-banner matched';
    container.innerHTML = `
      <div class="jurisdiction-header-row">
        <strong style="color: #6ee7b7; display: flex; align-items: center; gap: 4px;">
          ✓ ${jurisdiction.title}
        </strong>
        <span style="font-size: 0.68rem; background: rgba(16, 185, 129, 0.2); color: #a7f3d0; padding: 1px 6px; border-radius: 4px;">
          ${jurisdiction.selectedPbt.shortName}
        </span>
      </div>
      <div>${jurisdiction.message}</div>
    `;
  } else {
    container.className = 'jurisdiction-banner mismatch';
    container.innerHTML = `
      <div class="jurisdiction-header-row">
        <strong style="color: #fca5a5; display: flex; align-items: center; gap: 4px;">
          ⚠️ ${jurisdiction.title}
        </strong>
        <button type="button" id="btn-auto-sync-pbt" class="btn-auto-sync">
          Selaraskan
        </button>
      </div>
      <div>${jurisdiction.message}</div>
    `;

    // Wire Auto-Sync Button to open Conflict Resolution Dialog Box
    const btnSync = document.getElementById('btn-auto-sync-pbt');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        openPbtConflictDialog(jurisdiction);
      });
    }
  }
}

/**
 * Opens the PBT Jurisdiction Conflict Resolution Dialog Box
 */
function openPbtConflictDialog(jurisdiction) {
  const modal = document.getElementById('pbt-conflict-modal');
  const modalBody = document.getElementById('conflict-modal-body');
  if (!modal || !modalBody || !jurisdiction) return;

  const detected = jurisdiction.suggestedPbt || jurisdiction.detectedPbt;
  const selected = jurisdiction.selectedPbt;

  modalBody.innerHTML = `
    <div class="conflict-alert-box">
      <div class="conflict-alert-title">Perhatian: Percanggahan Bidang Kuasa PBT Dikesan</div>
      <div class="conflict-alert-desc">
        Tapak cadangan pemajuan (<strong>${state.currentSiteName}</strong>) dikesan berada di bawah kawasan pentadbiran statutori 
        <strong>${detected.name}</strong> (${detected.stateName}), tetapi permohonan semasa ditetapkan kepada 
        <strong>${selected.name}</strong>.
      </div>
    </div>

    <div class="conflict-comparison-grid">
      <div class="conflict-col col-detected">
        <div class="conflict-col-badge">✓ PBT Berkuasa Statutori (Dikesan)</div>
        <div class="conflict-pbt-name">${detected.name}</div>
        <div class="conflict-detail-row">
          <span>Negeri Pentadbiran:</span>
          <strong>${detected.stateName}</strong>
        </div>
        <div class="conflict-detail-row">
          <span>Akta / Ordinan Statutori:</span>
          <strong>${detected.act}</strong>
        </div>
        <div class="conflict-detail-row">
          <span>Rancangan Tempatan:</span>
          <strong>${detected.localPlan}</strong>
        </div>
      </div>

      <div class="conflict-col col-selected">
        <div class="conflict-col-badge badge-warning">⚠️ PBT Semasa Dipilih</div>
        <div class="conflict-pbt-name">${selected.name}</div>
        <div class="conflict-detail-row">
          <span>Negeri Pentadbiran:</span>
          <strong>${selected.stateName}</strong>
        </div>
        <div class="conflict-detail-row">
          <span>Akta / Ordinan Statutori:</span>
          <strong>${selected.act}</strong>
        </div>
        <div class="conflict-detail-row">
          <span>Rancangan Tempatan:</span>
          <strong>${selected.localPlan}</strong>
        </div>
      </div>
    </div>

    <div class="conflict-law-note">
      <strong>Kesan Perundangan:</strong> Di bawah Seksyen 19 Akta Perancangan Bandar dan Desa 1976 (Akta 172) / Akta 267 / Ordinan Negeri, Kebenaran Merancang (KM) hanya sah di sisi undang-undang jika diluluskan oleh Pihak Berkuasa Tempatan yang mempunyai bidang kuasa statutori ke atas lot berkenaan. Permohonan kepada PBT yang salah adalah tidak sah (<em>ultra vires</em>) dan tertolak secara automatik. Sila selaraskan PBT untuk meneruskan permohonan yang sah.
    </div>
  `;

  modal.classList.add('open');

  const btnConfirm = document.getElementById('btn-confirm-sync-pbt');
  const btnClose = document.getElementById('btn-close-conflict-modal');
  const btnKeep = document.getElementById('btn-keep-current-pbt');

  const closeModal = () => modal.classList.remove('open');

  if (btnConfirm) {
    btnConfirm.onclick = () => {
      closeModal();
      autoSyncPbt(detected);
    };
  }

  if (btnClose) btnClose.onclick = closeModal;
  if (btnKeep) btnKeep.onclick = closeModal;
}

/**
 * Handles manual State / PBT selection by validating jurisdiction immediately
 * and showing the conflict dialog before running any simulation to save rate limits.
 */
function handleManualPbtSelection(selectedPbt) {
  state.currentPbt = selectedPbt;
  state.isManualPbtSelection = true;

  const overlayPbtSub = document.getElementById('overlay-pbt-sub');
  if (overlayPbtSub) {
    overlayPbtSub.innerText = `PBT: ${selectedPbt.shortName} (${selectedPbt.stateName}) | Zon Penampan 1,000m`;
  }

  updateNearbyLocationChips(state.currentSiteName, selectedPbt);
  updatePolicyOptionsForTargetPbt(selectedPbt, state.developmentTypeId);

  // Validate jurisdiction against the current site coordinates & name
  const jurisdiction = JurisdictionEngine.validateJurisdiction(
    selectedPbt.id,
    state.currentLat,
    state.currentLng,
    state.currentSiteName,
    state.addressDetails
  );

  state.jurisdictionResult = jurisdiction;
  renderJurisdictionBanner(jurisdiction);

  // If a conflict exists with the current site location, show the dialog box immediately!
  if (!jurisdiction.isValid) {
    openPbtConflictDialog(jurisdiction);
  }
}

/**
 * 1-Click Auto Sync when location is in a different PBT.
 * Instantly re-evaluates statutory rules locally without re-querying Overpass or restarting the stopwatch.
 */
function autoSyncPbt(targetPbt) {
  state.currentPbt = targetPbt;
  state.selectedStateId = targetPbt.stateId;
  state.isManualPbtSelection = false;

  const stateSelect = document.getElementById('state-filter-select');
  if (stateSelect) stateSelect.value = targetPbt.stateId;
  populatePbtDropdown(targetPbt.stateId);

  const pbtSelect = document.getElementById('pbt-select');
  if (pbtSelect) pbtSelect.value = targetPbt.id;

  const overlayPbtSub = document.getElementById('overlay-pbt-sub');
  if (overlayPbtSub) {
    overlayPbtSub.innerText = `PBT: ${targetPbt.shortName} (${targetPbt.stateName}) | Zon Penampan 1,000m`;
  }

  updateNearbyLocationChips(state.currentSiteName, targetPbt);
  updatePolicyOptionsForTargetPbt(targetPbt, state.developmentTypeId);

  // Validate and update jurisdiction banner
  state.jurisdictionResult = JurisdictionEngine.validateJurisdiction(
    targetPbt.id,
    state.currentLat,
    state.currentLng,
    state.currentSiteName,
    state.addressDetails
  );
  renderJurisdictionBanner(state.jurisdictionResult);

  // If spatial data already exists for this site, re-evaluate statutory rules locally in 0ms!
  if (state.spatialData && state.spatialData.counts && state.spatialData.counts.total !== undefined && state.spatialData.counts.total >= 0) {
    state.simulationResult = runSimulation({
      pbtId: targetPbt.id,
      siteName: state.currentSiteName,
      units: state.units,
      developmentTypeId: state.developmentTypeId,
      floors: state.floors,
      siteAreaAcres: state.siteAreaAcres,
      spatialData: state.spatialData,
      jurisdictionResult: state.jurisdictionResult,
      policyOptions: state.policyOptions
    });

    updateStepperProgress(5);
    const hazardContainer = document.getElementById('hazard-cards-container');
    renderHazardCards(hazardContainer, state.simulationResult.results);
    setReportButtonAvailable(true);
  } else {
    // Idle state: not simulated yet -> keep stepper at ready state
    updateStepperProgress(1);
  }
}

/**
 * Dynamically updates policy option labels, guidelines, and hints to match the selected target PBT & development type
 */
function updatePolicyOptionsForTargetPbt(pbt, devTypeId) {
  if (!pbt) return;

  const lblAffordable = document.getElementById('lbl-affordable-housing');
  const hintAffordable = document.getElementById('hint-affordable-policy');
  const badgeSlope = document.getElementById('badge-slope-policy');
  const groupPue = document.getElementById('group-opt-pue');
  const groupIndBuffer = document.getElementById('group-opt-industrial-buffer');
  const selectGreen = document.getElementById('opt-green-cert');

  // 1. Dynamic Affordable Housing Policy Matching
  const stateId = pbt.stateId;
  let policyName = 'Kuota Rumah Mampu Milik Tempatan:';
  let policyHint = 'Tertakluk kepada syarat PBT berkenaan';

  if (stateId === 'selangor') {
    policyName = 'Kuota Rumah Selangorku (RSKU 3.0):';
    policyHint = 'Mandatori 20% - 40% bagi pemajuan kediaman ≥ 5 ekar';
  } else if (stateId === 'kl') {
    policyName = 'Kuota RUMAWIP / Residensi Wilayah:';
    policyHint = 'Pematuhan dasar kuota mampu milik DBKL / WP';
  } else if (stateId === 'johor') {
    policyName = 'Kuota Rumah Mampu Milik Johor (RMBJ):';
    policyHint = 'Polisi Perumahan Rakyat Johor & Zon Ekonomi Khas JS-SEZ';
  } else if (stateId === 'penang') {
    policyName = 'Kuota RMM Pulau Pinang:';
    policyHint = 'Garis Panduan Perumahan Mampu Milik MBPP / MBSP';
  } else if (stateId === 'putrajaya') {
    policyName = 'Kuota PPAM / Residensi Madani:';
    policyHint = 'Dasar Perumahan Penjawat Awam Malaysia (PPAM) & PPj';
  } else if (stateId === 'melaka') {
    policyName = 'Kuota RMM Melaka:';
    policyHint = 'Dasar Lembaga Perumahan Melaka (LPM)';
  } else if (stateId === 'perak') {
    policyName = 'Kuota Rumah Perakku:';
    policyHint = 'Lembaga Perumahan dan Hartanah Perak (LPHP)';
  } else if (stateId === 'pahang') {
    policyName = 'Kuota Rumah Makmur Pahang:';
    policyHint = 'Lembaga Perumahan dan Hartanah Pahang';
  } else if (stateId === 'kedah') {
    policyName = 'Kuota Rumah Kasih Kedah:';
    policyHint = 'Dasar Perumahan Negeri Kedah';
  } else if (stateId === 'sabah') {
    policyName = 'Kuota Rumah Mesra SMJ Sabah:';
    policyHint = 'Ordinan Perancangan Bandar Sabah (Cap. 141)';
  } else if (stateId === 'sarawak') {
    policyName = 'Kuota Rumah Spektra Sarawak:';
    policyHint = 'State Planning Authority (SPA) & HDC Sarawak';
  }

  if (lblAffordable) lblAffordable.innerText = policyName;
  if (hintAffordable) hintAffordable.innerText = policyHint;

  // 2. Dynamic Hillside Sensitivity Matching
  const isHillsidePbt =
    pbt.policyFlags?.hasPenangHillside ||
    pbt.policyFlags?.hasHillsideGuidelines ||
    ['mbpp', 'mbsp', 'mdch', 'mpbentong', 'mpaj', 'mphs', 'mdraub', 'mdranau'].includes(pbt.id);

  if (badgeSlope) {
    if (isHillsidePbt) {
      badgeSlope.innerText = '⚠️ Kawasan Sensitif Cerun';
      badgeSlope.title = `Tertakluk kepada Garis Panduan Kawalan Cerun ${pbt.shortName}`;
    } else {
      badgeSlope.innerText = '';
    }
  }

  // 3. Dynamic Tech/Data Center & Industrial Context
  const isDataCenter = devTypeId === 'ai_datacenter' || pbt.policyFlags?.hasDataCenterGuidelines;
  if (groupPue) {
    groupPue.style.opacity = isDataCenter ? '1' : '0.75';
  }

  const isIndustrial = ['light_industrial', 'heavy_industrial', 'logistics_hub', 'ai_datacenter'].includes(devTypeId);
  if (groupIndBuffer) {
    groupIndBuffer.style.opacity = isIndustrial ? '1' : '0.75';
  }

  // 4. Green City context (LCCF)
  if (selectGreen && pbt.policyFlags?.hasLCCF && selectGreen.value === 'none') {
    selectGreen.value = 'lccf_2030';
  }
}
