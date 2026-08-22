/**
 * Map Controller (Leaflet + Turf.js Integration)
 * Manages basemaps, 1km buffer zones, spatial markers, layer toggles, and robust live measuring tools.
 * Includes abnormal pinpoint handling (criss-cross / bowtie, duplicate clicks, collinear points, complex multi-vertex polygons).
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { createCustomIcon, buildPopupHtml } from './map-layers.js';
import { isWithinMalaysia, reverseGeocode } from '../services/geocoding.js';

export class MapController {
  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.centerLat = 3.1612; // Default Kampung Baru KL
    this.centerLng = 101.7088;
    this.bufferRadiusMeters = 1000;

    // Layer groups
    this.layers = {
      siteMarker: L.layerGroup(),
      bufferCircle: L.layerGroup(),
      rail: L.layerGroup(),
      bus: L.layerGroup(),
      education: L.layerGroup(),
      worship: L.layerGroup(),
      heritage: L.layerGroup(),
      museum: L.layerGroup(),
      health: L.layerGroup(),
      parks: L.layerGroup(),
      roads: L.layerGroup(),
      measurements: L.layerGroup()
    };

    this.activeBasemap = 'satellite';
    this.measuringMode = null; // 'distance' | 'area' | null
    this.measurePoints = []; // Array of [lng, lat]
    this.activeShapeLayer = null;
    this.activeLabelMarker = null;
    this.activeBufferCircle = null;
    this.activeBufferHalo = null;
    this.pendingRelocateMarker = null;
    this.vertexMarkers = [];
    this.onSiteSelectedCallback = null;

    this.initMap();
  }

  initMap() {
    this.map = L.map(this.containerId, {
      center: [this.centerLat, this.centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true
    });

    // Custom Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Add Basemaps
    this.basemaps = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }),
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      })
    };

    this.basemaps.satellite.addTo(this.map);

    // Add all layer groups to map
    Object.values(this.layers).forEach((layerGroup) => layerGroup.addTo(this.map));

    // Handle Map Clicks for site selection or measuring
    this.map.on('click', (e) => this.handleMapClick(e));

    // Global popup lifecycle listeners to prevent stuck/orphaned relocate confirmation pins
    this.map.on('popupopen', (e) => {
      // If any popup opens that is NOT the pending relocate confirmation, remove the pending relocate pin
      if (this.pendingRelocateMarker && e.popup !== this.pendingRelocateMarker.getPopup()) {
        this.clearPendingRelocate();
      }
    });

    this.map.on('popupclose', (e) => {
      // If the pending relocate popup is closed (by user clicking close button, tapping outside, etc.), clean up
      if (this.pendingRelocateMarker && e.popup === this.pendingRelocateMarker.getPopup()) {
        this.clearPendingRelocate();
      }
    });

    // Recalibrate full-screen dimensions
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 150);
  }

  setBasemap(type) {
    if (!this.basemaps[type]) return;
    Object.values(this.basemaps).forEach((layer) => this.map.removeLayer(layer));
    this.basemaps[type].addTo(this.map);
    this.activeBasemap = type;
    this.updateBufferStyle();
  }

  getBufferStyles(basemapType = 'dark') {
    switch (basemapType) {
      case 'light':
        return {
          strokeColor: '#1d4ed8', // Bold Cobalt Blue for bright positron map
          weight: 2.8,
          dashArray: '8, 8',
          fillColor: '#2563eb',
          fillOpacity: 0.16,
          haloColor: '#60a5fa',
          haloWeight: 6,
          haloOpacity: 0.35
        };
      case 'osm':
        return {
          strokeColor: '#0369a1', // Deep Cerulean for colorful OSM standard
          weight: 3.0,
          dashArray: '8, 8',
          fillColor: '#0284c7',
          fillOpacity: 0.18,
          haloColor: '#38bdf8',
          haloWeight: 6,
          haloOpacity: 0.35
        };
      case 'satellite':
        return {
          strokeColor: '#00f5d4', // Vivid Electric Mint/Teal for dark Earth terrain
          weight: 3.2,
          dashArray: '8, 6',
          fillColor: '#00f5d4',
          fillOpacity: 0.20,
          haloColor: '#ffffff',
          haloWeight: 7,
          haloOpacity: 0.45
        };
      case 'dark':
      default:
        return {
          strokeColor: '#38bdf8', // Luminous Cyber Cyan for Dark Matter
          weight: 2.5,
          dashArray: '7, 7',
          fillColor: '#0284c7',
          fillOpacity: 0.15,
          haloColor: '#0ea5e9',
          haloWeight: 6,
          haloOpacity: 0.35
        };
    }
  }

  updateBufferStyle() {
    if (!this.activeBufferCircle) return;
    const style = this.getBufferStyles(this.activeBasemap);

    if (this.activeBufferHalo) {
      this.activeBufferHalo.setStyle({
        color: style.haloColor,
        weight: style.haloWeight,
        opacity: style.haloOpacity
      });
    }

    this.activeBufferCircle.setStyle({
      color: style.strokeColor,
      weight: style.weight,
      dashArray: style.dashArray,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity
    });
  }

  toggleLayer(layerName, isVisible) {
    if (!this.layers[layerName]) return;
    if (isVisible) {
      if (!this.map.hasLayer(this.layers[layerName])) {
        this.map.addLayer(this.layers[layerName]);
      }
    } else {
      if (this.map.hasLayer(this.layers[layerName])) {
        this.map.removeLayer(this.layers[layerName]);
      }
    }
  }

  /**
   * Updates proposed site location, 1km radius buffer, and pan/zoom
   */
  setProposedSite(lat, lng, siteName = 'Tapak Cadangan', units = 350) {
    this.centerLat = lat;
    this.centerLng = lng;

    // Clear any pending relocation marker
    this.clearPendingRelocate();

    // Clear previous site & buffer
    this.layers.siteMarker.clearLayers();
    this.layers.bufferCircle.clearLayers();

    // 1. Add Proposed Site Marker
    const siteIcon = createCustomIcon('site', siteName);
    const marker = L.marker([lat, lng], { icon: siteIcon, zIndexOffset: 1000 });
    marker.bindPopup(buildPopupHtml({ name: siteName, units, lat, lng }, 'site'));
    this.layers.siteMarker.addLayer(marker);

    // 2. Add Adaptive Dual-Ring 1km Buffer (Geodesic 1,000m)
    const style = this.getBufferStyles(this.activeBasemap);

    // Outer Contrast Halo Ring (gives sharp pop across all map types)
    this.activeBufferHalo = L.circle([lat, lng], {
      radius: this.bufferRadiusMeters,
      color: style.haloColor,
      weight: style.haloWeight,
      opacity: style.haloOpacity,
      fill: false,
      interactive: false
    });
    this.layers.bufferCircle.addLayer(this.activeBufferHalo);

    // Primary Luminous Dashed Buffer Circle
    this.activeBufferCircle = L.circle([lat, lng], {
      radius: this.bufferRadiusMeters,
      color: style.strokeColor,
      weight: style.weight,
      dashArray: style.dashArray,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      interactive: false
    });
    this.layers.bufferCircle.addLayer(this.activeBufferCircle);

    // Ensure buffer layer is visible on the map
    if (!this.map.hasLayer(this.layers.bufferCircle)) {
      this.map.addLayer(this.layers.bufferCircle);
    }

    // Smooth flyTo
    this.map.flyTo([lat, lng], 15, { duration: 1.2 });
  }

  /**
   * Clears all spatial infrastructure layers (rail, bus, education, worship, heritage, museum, health, parks)
   */
  clearSpatialLayers() {
    this.layers.rail.clearLayers();
    this.layers.bus.clearLayers();
    this.layers.education.clearLayers();
    this.layers.worship.clearLayers();
    this.layers.heritage.clearLayers();
    this.layers.museum.clearLayers();
    this.layers.health.clearLayers();
    this.layers.parks.clearLayers();
  }

  /**
   * Renders infrastructure items onto their respective Leaflet layer groups
   */
  renderSpatialInfrastructure(spatialData) {
    // Clear previous items
    this.clearSpatialLayers();

    // 1. Rail Stations
    (spatialData.railStations || []).forEach((item) => {
      const icon = createCustomIcon('rail', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'rail'));
      this.layers.rail.addLayer(marker);
    });

    // 2. Bus Stops
    (spatialData.busStops || []).forEach((item) => {
      const icon = createCustomIcon('bus', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'bus'));
      this.layers.bus.addLayer(marker);
    });

    // 3. Education
    (spatialData.schools || []).forEach((item) => {
      const icon = createCustomIcon('education', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'education'));
      this.layers.education.addLayer(marker);
    });

    // 4. Places of Worship (Kemudahan Keagamaan)
    (spatialData.worshipPlaces || []).forEach((item) => {
      const icon = createCustomIcon('worship', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'worship'));
      this.layers.worship.addLayer(marker);
    });

    // 5. Authentic Heritage Sites (Akta 645)
    (spatialData.heritageSites || []).forEach((item) => {
      const icon = createCustomIcon('heritage', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'heritage'));
      this.layers.heritage.addLayer(marker);
    });

    // 6. Museums, Science Discovery Centers & Tourism Attractions
    (spatialData.museums || []).forEach((item) => {
      const icon = createCustomIcon('museum', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'museum'));
      this.layers.museum.addLayer(marker);
    });

    // 7. Health & Public Safety (Hospital, Klinik, Polis, Bomba)
    (spatialData.healthSafety || []).forEach((item) => {
      const icon = createCustomIcon('health', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'health'));
      this.layers.health.addLayer(marker);
    });

    // 8. Public Parks & Recreation
    (spatialData.parks || []).forEach((item) => {
      const icon = createCustomIcon('parks', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'parks'));
      this.layers.parks.addLayer(marker);
    });
  }

  /**
   * Zoom & Camera Navigation Helpers
   */
  zoomIn() {
    if (this.map) this.map.zoomIn();
  }

  zoomOut() {
    if (this.map) this.map.zoomOut();
  }

  fitSite() {
    if (this.map && typeof this.centerLat === 'number' && typeof this.centerLng === 'number') {
      this.map.flyTo([this.centerLat, this.centerLng], 15, { duration: 0.8 });
    }
  }

  fitMalaysia() {
    if (this.map) {
      this.map.flyToBounds([
        [1.0, 99.6],
        [7.4, 119.3]
      ], { duration: 1.0 });
    }
  }

  /**
   * Interactive Measuring Tools (Distance & Area)
   */
  startMeasurement(mode = 'distance') {
    this.clearMeasurement();
    this.measuringMode = mode;
    this.map.getContainer().style.cursor = 'crosshair';

    const btnDist = document.getElementById('btn-measure-distance');
    const btnArea = document.getElementById('btn-measure-area');
    if (btnDist) btnDist.classList.toggle('active', mode === 'distance');
    if (btnArea) btnArea.classList.toggle('active', mode === 'area');

    this.updateMeasureStatusText(
      mode === 'distance'
        ? '📏 Klik peta untuk jarak'
        : '📐 Klik ≥3 titik untuk luas'
    );
  }

  clearMeasurement() {
    this.measuringMode = null;
    this.measurePoints = [];
    this.vertexMarkers = [];
    this.activeShapeLayer = null;
    this.activeLabelMarker = null;
    this.layers.measurements.clearLayers();
    this.map.getContainer().style.cursor = '';

    const btnDist = document.getElementById('btn-measure-distance');
    const btnArea = document.getElementById('btn-measure-area');
    if (btnDist) btnDist.classList.remove('active');
    if (btnArea) btnArea.classList.remove('active');

    this.updateMeasureStatusText('Sedia untuk mengukur');
  }

  handleMapClick(e) {
    if (!this.measuringMode) {
      this.showRelocateConfirmation(e.latlng.lat, e.latlng.lng);
      return;
    }

    const { lat, lng } = e.latlng;

    // 1. Prevent duplicate rapid double-clicks on the same spot (< 0.5m)
    if (this.measurePoints.length > 0) {
      const [lastLng, lastLat] = this.measurePoints[this.measurePoints.length - 1];
      const distToLast = turf.distance(turf.point([lastLng, lastLat]), turf.point([lng, lat]), { units: 'meters' });
      if (distToLast < 0.5) return;
    }

    this.measurePoints.push([lng, lat]); // GeoJSON coordinate is [lng, lat]

    // 2. Add vertex marker
    const vertexMarker = L.circleMarker([lat, lng], {
      radius: 5,
      color: this.measuringMode === 'area' ? '#a855f7' : '#38bdf8',
      fillColor: '#ffffff',
      fillOpacity: 1,
      weight: 2
    });
    this.layers.measurements.addLayer(vertexMarker);
    this.vertexMarkers.push(vertexMarker);

    // 3. Remove previous active shape & label to prevent visual ghosting/stacking
    if (this.activeShapeLayer) {
      this.layers.measurements.removeLayer(this.activeShapeLayer);
      this.activeShapeLayer = null;
    }
    if (this.activeLabelMarker) {
      this.layers.measurements.removeLayer(this.activeLabelMarker);
      this.activeLabelMarker = null;
    }

    const latLngs = this.measurePoints.map(([pLng, pLat]) => [pLat, pLng]);

    if (this.measuringMode === 'distance') {
      if (this.measurePoints.length === 1) {
        this.updateMeasureStatusText('📏 1 titik (klik titik seterusnya)');
      } else if (this.measurePoints.length >= 2) {
        const line = turf.lineString(this.measurePoints);
        const lengthKm = turf.length(line, { units: 'kilometers' });
        const text = lengthKm < 1 ? `${(lengthKm * 1000).toFixed(1)} meter` : `${lengthKm.toFixed(2)} km`;

        this.activeShapeLayer = L.polyline(latLngs, {
          color: '#38bdf8',
          weight: 3,
          dashArray: '5, 5'
        });
        this.layers.measurements.addLayer(this.activeShapeLayer);

        // Summary tooltip on the latest vertex
        this.activeLabelMarker = L.circleMarker([lat, lng], { radius: 0.1, opacity: 0 });
        this.activeLabelMarker
          .bindTooltip(`<strong>Jumlah Jarak:</strong> ${text} (${this.measurePoints.length} titik)`, {
            permanent: true,
            direction: 'right',
            className: 'measure-tooltip'
          })
          .openTooltip();
        this.layers.measurements.addLayer(this.activeLabelMarker);

        this.updateMeasureStatusText(`📏 ${text} (${this.measurePoints.length} titik)`);
      }
    } else if (this.measuringMode === 'area') {
      if (this.measurePoints.length < 3) {
        // Less than 3 points: draw preview polyline
        this.activeShapeLayer = L.polyline(latLngs, {
          color: '#a855f7',
          weight: 2,
          dashArray: '4, 4'
        });
        this.layers.measurements.addLayer(this.activeShapeLayer);
        this.updateMeasureStatusText(`📐 Titik ${this.measurePoints.length}/3 (klik seterusnya)`);
      } else {
        // 3 or more points: draw closed polygon
        this.activeShapeLayer = L.polygon(latLngs, {
          color: '#a855f7',
          weight: 2.5,
          fillColor: '#a855f7',
          fillOpacity: 0.3
        });
        this.layers.measurements.addLayer(this.activeShapeLayer);

        // Robust Polygon Calculation (Handles abnormal, criss-cross, and collinear points)
        const areaResult = this.calculateRobustArea(this.measurePoints);

        if (areaResult.isCollinear) {
          this.updateMeasureStatusText('⚠️ Titik selari (klik luar jajaran)');
          return;
        }

        const { areaSqM, areaAcres, areaHectares, areaSqFt, isSelfIntersecting, labelCenter } = areaResult;

        this.activeLabelMarker = L.circleMarker([labelCenter.lat, labelCenter.lng], { radius: 0.1, opacity: 0 });
        this.activeLabelMarker
          .bindTooltip(
            `<div style="text-align:center;">
              <strong style="color:#c084fc;">Keluasan Tapak${isSelfIntersecting ? ' (Poligon Bersilang)' : ''}:</strong><br>
              <span style="font-size:1.1rem; font-weight:800;">${areaSqM.toLocaleString()} m²</span><br>
              <span style="font-size:0.75rem;">(~${areaAcres} ekar | ${areaHectares} ha | ${areaSqFt} kps)</span>
              ${isSelfIntersecting ? '<br><span style="font-size:0.68rem; color:#fde047;">(Auto-Unkinked Figure-8 / Poligon Kompleks)</span>' : ''}
            </div>`,
            { permanent: true, direction: 'center', className: 'measure-tooltip area-tooltip' }
          )
          .openTooltip();
        this.layers.measurements.addLayer(this.activeLabelMarker);

        this.updateMeasureStatusText(
          `📐 ${areaSqM.toLocaleString()} m² (~${areaAcres} ekar)`
        );
      }
    }
  }

  /**
   * Calculates robust geodesic area handling abnormal pinpoint geometries:
   * - Self-intersecting / Bowtie / Figure-8 polygons (via turf.unkinkPolygon)
   * - Collinear points
   * - Non-convex / Concave multi-point parcels
   */
  calculateRobustArea(points) {
    if (!points || points.length < 3) {
      return { isCollinear: true, areaSqM: 0 };
    }

    try {
      const closedRing = [...points, points[0]];
      const rawPolygon = turf.polygon([closedRing]);

      // Check for self-intersections (kinks)
      let isSelfIntersecting = false;
      let calculatedArea = 0;

      try {
        const kinks = turf.kinks(rawPolygon);
        if (kinks && kinks.features && kinks.features.length > 0) {
          isSelfIntersecting = true;
          // Unkink the bowtie/figure-8 into valid sub-polygons and sum their exact areas
          const unkinked = turf.unkinkPolygon(rawPolygon);
          unkinked.features.forEach((feat) => {
            calculatedArea += turf.area(feat);
          });
        } else {
          calculatedArea = turf.area(rawPolygon);
        }
      } catch (kinkErr) {
        // Fallback to direct polygon area
        calculatedArea = turf.area(rawPolygon);
      }

      // If area is effectively zero, points are collinear
      if (calculatedArea < 0.5) {
        return { isCollinear: true, areaSqM: 0 };
      }

      const areaSqM = Math.round(calculatedArea);
      const areaAcres = (areaSqM / 4046.86).toFixed(2);
      const areaHectares = (areaSqM / 10000).toFixed(2);
      const areaSqFt = Math.round(areaSqM * 10.7639).toLocaleString();

      // Safe Centroid Placement (Fallback to bbox center if centroid is outside)
      let labelCenter = { lat: points[0][1], lng: points[0][0] };
      try {
        const centerOfMass = turf.centerOfMass(rawPolygon);
        const [cLng, cLat] = centerOfMass.geometry.coordinates;
        labelCenter = { lat: cLat, lng: cLng };
      } catch (cErr) {
        const bbox = turf.bbox(rawPolygon);
        labelCenter = {
          lat: (bbox[1] + bbox[3]) / 2,
          lng: (bbox[0] + bbox[2]) / 2
        };
      }

      return {
        isCollinear: false,
        isSelfIntersecting,
        areaSqM,
        areaAcres,
        areaHectares,
        areaSqFt,
        labelCenter
      };
    } catch (err) {
      console.warn('[Robust Area Calculation] Heuristic fallback:', err.message);
      // Ultimate fallback: Shoelace on planar projection
      return this.calculateShoelaceArea(points);
    }
  }

  /**
   * Fallback Shoelace formula with origin-centered local projection for maximum numerical precision
   */
  calculateShoelaceArea(points) {
    let area = 0;
    const n = points.length;
    if (n < 3) {
      return { isCollinear: true, areaSqM: 0 };
    }

    const refLng = points[0][0];
    const refLat = points[0][1];
    const cosLat = Math.cos((refLat * Math.PI) / 180);
    const metersPerDegreeLng = 111320 * cosLat;
    const metersPerDegreeLat = 110574;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = (points[i][0] - refLng) * metersPerDegreeLng;
      const y1 = (points[i][1] - refLat) * metersPerDegreeLat;
      const x2 = (points[j][0] - refLng) * metersPerDegreeLng;
      const y2 = (points[j][1] - refLat) * metersPerDegreeLat;
      area += x1 * y2 - x2 * y1;
    }
    const areaSqM = Math.round(Math.abs(area) / 2);
    const areaAcres = (areaSqM / 4046.8564).toFixed(2);
    const areaHectares = (areaSqM / 10000).toFixed(2);
    const areaSqFt = Math.round(areaSqM * 10.7639).toLocaleString();

    return {
      isCollinear: areaSqM < 0.5,
      isSelfIntersecting: false,
      areaSqM,
      areaAcres,
      areaHectares,
      areaSqFt,
      labelCenter: { lat: refLat, lng: refLng }
    };
  }

  updateMeasureStatusText(text) {
    const statusSpan = document.getElementById('measure-status-text');
    if (statusSpan) {
      statusSpan.innerText = text;
    }
  }

  /**
   * Safely clears any pending site relocation marker and its popup
   */
  clearPendingRelocate() {
    if (this.pendingRelocateMarker) {
      const marker = this.pendingRelocateMarker;
      this.pendingRelocateMarker = null;
      if (this.map && this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    }
  }

  async showRelocateConfirmation(lat, lng) {
    // Clear any previous pending confirmation marker
    this.clearPendingRelocate();

    // 1. Initial quick bounds check (e.g. Europe, America, Australia, North Asia)
    const isObviousOverseas = lat < 0.5 || lat > 8.0 || lng < 99.0 || lng > 120.0;

    const pinIcon = L.divIcon({
      className: 'pending-site-pin',
      html: `
        <div class="pending-pin-wrapper">
          <div class="pending-pin-pulse" id="pending-pin-pulse-el"></div>
          <div class="pending-pin-dot" id="pending-pin-dot-el">?</div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });

    const loadingHtml = `
      <div class="site-relocate-confirm-popup">
        <div class="confirm-header">
          <span class="confirm-icon">🔍</span>
          <strong>Menyemak Lokasi Tapak...</strong>
        </div>
        <p class="confirm-desc" style="color: #94a3b8; font-size: 0.76rem; margin: 0.5rem 0;">
          Sedang mengesahkan sempadan wilayah dan pihak berkuasa tempatan (PBT)...
        </p>
        <div class="confirm-coords">
          <code>Lat: ${lat.toFixed(5)}</code> | <code>Lng: ${lng.toFixed(5)}</code>
        </div>
      </div>
    `;

    this.pendingRelocateMarker = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 2000 })
      .addTo(this.map)
      .bindPopup(loadingHtml, { closeButton: true, minWidth: 260, className: 'relocate-confirm-leaflet-popup' })
      .openPopup();

    if (isObviousOverseas) {
      this.renderRelocateError(lat, lng, 'Lokasi Antarabangsa');
      return;
    }

    // 2. Fetch authoritative reverse geocode to verify country
    try {
      const geo = await reverseGeocode(lat, lng);
      if (!this.pendingRelocateMarker || !this.map.hasLayer(this.pendingRelocateMarker)) return;

      const isMalaysia = isWithinMalaysia(lat, lng, geo.addressDetails);

      if (!isMalaysia || (geo.addressDetails && geo.addressDetails.country_code && geo.addressDetails.country_code !== 'my')) {
        this.renderRelocateError(lat, lng, geo.displayName || 'Di Luar Sempadan Malaysia');
      } else {
        this.renderRelocateSuccess(lat, lng, geo);
      }
    } catch {
      if (!this.pendingRelocateMarker || !this.map.hasLayer(this.pendingRelocateMarker)) return;
      this.renderRelocateSuccess(lat, lng, { displayName: `Tapak (${lat.toFixed(4)}, ${lng.toFixed(4)})`, addressDetails: {} });
    }
  }

  renderRelocateError(lat, lng, locationName) {
    if (!this.pendingRelocateMarker || !this.map.hasLayer(this.pendingRelocateMarker)) return;

    // Update marker styling to Red Warning
    const pulseEl = document.getElementById('pending-pin-pulse-el');
    const dotEl = document.getElementById('pending-pin-dot-el');
    if (pulseEl) pulseEl.style.background = 'rgba(239, 68, 68, 0.45)';
    if (dotEl) {
      dotEl.style.background = '#ef4444';
      dotEl.style.borderColor = '#fca5a5';
      dotEl.innerText = '✕';
    }

    const popupHtml = `
      <div class="site-relocate-confirm-popup site-relocate-error-popup">
        <div class="confirm-header" style="color: #ef4444;">
          <span class="confirm-icon">⚠️</span>
          <strong style="color: #fca5a5;">Ralat: Di Luar Malaysia</strong>
        </div>
        <p class="confirm-desc" style="color: #cbd5e1; font-size: 0.76rem; line-height: 1.35; margin: 0.4rem 0;">
          Lokasi dikesan di luar Malaysia (${locationName}). Simulasi MyPBTSim dihadkan khusus untuk PBT di dalam Malaysia sahaja.
        </p>
        <div class="confirm-coords" style="margin-bottom: 0.6rem;">
          <code>Lat: ${lat.toFixed(5)}</code> | <code>Lng: ${lng.toFixed(5)}</code>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-confirm-no" id="btn-cancel-move-site" style="width: 100%; font-weight: 700; background: #334155; color: #f8fafc; cursor: pointer; padding: 0.45rem;">✕ Tutup</button>
        </div>
      </div>
    `;

    this.pendingRelocateMarker.setPopupContent(popupHtml);

    setTimeout(() => {
      const btnCancel = document.getElementById('btn-cancel-move-site');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => {
          this.clearPendingRelocate();
        });
      }
    }, 50);
  }

  renderRelocateSuccess(lat, lng, geo) {
    if (!this.pendingRelocateMarker || !this.map.hasLayer(this.pendingRelocateMarker)) return;

    const cleanName = geo && geo.displayName ? geo.displayName.split(',').slice(0, 2).join(',') : `Tapak (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    const popupHtml = `
      <div class="site-relocate-confirm-popup">
        <div class="confirm-header">
          <span class="confirm-icon">📍</span>
          <strong>Pindahkan Tapak & Zon Penampan?</strong>
        </div>
        <p class="confirm-desc" style="font-size: 0.76rem; line-height: 1.35; margin: 0.4rem 0;">
          Adakah anda ingin menukar tapak pemajuan ke <strong>${cleanName}</strong> dan mengira semula zon penampan 1,000m?
        </p>
        <div class="confirm-coords" style="margin-bottom: 0.6rem;">
          <code>Lat: ${lat.toFixed(5)}</code> | <code>Lng: ${lng.toFixed(5)}</code>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-confirm-yes" id="btn-confirm-move-site">✓ Sahkan & Kira</button>
          <button type="button" class="btn-confirm-no" id="btn-cancel-move-site">✕ Batal</button>
        </div>
      </div>
    `;

    this.pendingRelocateMarker.setPopupContent(popupHtml);

    setTimeout(() => {
      const btnConfirm = document.getElementById('btn-confirm-move-site');
      const btnCancel = document.getElementById('btn-cancel-move-site');

      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
          this.clearPendingRelocate();
          if (this.onSiteSelectedCallback) {
            this.onSiteSelectedCallback(lat, lng, geo);
          }
        });
      }

      if (btnCancel) {
        btnCancel.addEventListener('click', () => {
          this.clearPendingRelocate();
        });
      }
    }, 50);
  }

  onSiteSelected(callback) {
    this.onSiteSelectedCallback = callback;
  }
}
