/**
 * Map Controller (Leaflet + Turf.js Integration)
 * Manages basemaps, 1km buffer zones, spatial markers, layer toggles, and robust live measuring tools.
 * Includes abnormal pinpoint handling (criss-cross / bowtie, duplicate clicks, collinear points, complex multi-vertex polygons).
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { createCustomIcon, buildPopupHtml } from './map-layers.js';

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
      heritage: L.layerGroup(),
      roads: L.layerGroup(),
      measurements: L.layerGroup()
    };

    this.activeBasemap = 'dark';
    this.measuringMode = null; // 'distance' | 'area' | null
    this.measurePoints = []; // Array of [lng, lat]
    this.activeShapeLayer = null;
    this.activeLabelMarker = null;
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
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }),
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
      }),
      light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      })
    };

    this.basemaps.dark.addTo(this.map);

    // Add all layer groups to map
    Object.values(this.layers).forEach((layerGroup) => layerGroup.addTo(this.map));

    // Handle Map Clicks for site selection or measuring
    this.map.on('click', (e) => this.handleMapClick(e));
  }

  setBasemap(type) {
    if (!this.basemaps[type]) return;
    Object.values(this.basemaps).forEach((layer) => this.map.removeLayer(layer));
    this.basemaps[type].addTo(this.map);
    this.activeBasemap = type;
  }

  toggleLayer(layerName, isVisible) {
    if (!this.layers[layerName]) return;
    if (isVisible) {
      this.map.addLayer(this.layers[layerName]);
    } else {
      this.map.removeLayer(this.layers[layerName]);
    }
  }

  /**
   * Updates proposed site location, 1km radius buffer, and pan/zoom
   */
  setProposedSite(lat, lng, siteName = 'Tapak Cadangan', units = 350) {
    this.centerLat = lat;
    this.centerLng = lng;

    // Clear previous site & buffer
    this.layers.siteMarker.clearLayers();
    this.layers.bufferCircle.clearLayers();

    // 1. Add Proposed Site Marker
    const siteIcon = createCustomIcon('site', siteName);
    const marker = L.marker([lat, lng], { icon: siteIcon, zIndexOffset: 1000 });
    marker.bindPopup(buildPopupHtml({ name: siteName, units, lat, lng }, 'site'));
    this.layers.siteMarker.addLayer(marker);

    // 2. Add 1km Radius Buffer Circle (Geodesic 1000m)
    const circle = L.circle([lat, lng], {
      radius: this.bufferRadiusMeters,
      color: '#38bdf8',
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#0284c7',
      fillOpacity: 0.08
    });
    circle.bindTooltip(`Zon Penampan 1km (1,000m Radius Buffer)`, { permanent: false, direction: 'top' });
    this.layers.bufferCircle.addLayer(circle);

    // Smooth flyTo
    this.map.flyTo([lat, lng], 15, { duration: 1.2 });
  }

  /**
   * Renders extracted OSM spatial infrastructure
   */
  renderSpatialInfrastructure(spatialData) {
    // Clear previous items
    this.layers.rail.clearLayers();
    this.layers.bus.clearLayers();
    this.layers.education.clearLayers();
    this.layers.heritage.clearLayers();

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

    // 4. Heritage Sites
    (spatialData.heritageSites || []).forEach((item) => {
      const icon = createCustomIcon('heritage', item.name);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(buildPopupHtml(item, 'heritage'));
      this.layers.heritage.addLayer(marker);
    });
  }

  /**
   * Interactive Measuring Tools (Distance & Area)
   */
  startMeasurement(mode = 'distance') {
    this.clearMeasurement();
    this.measuringMode = mode;
    this.map.getContainer().style.cursor = 'crosshair';
    this.updateMeasureStatusText(
      mode === 'distance'
        ? '📍 Klik titik-titik atas peta untuk ukur jarak jajaran.'
        : '📐 Klik sekurang-kurangnya 3 titik untuk ukur keluasan poligon tapak.'
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
    this.updateMeasureStatusText('');
  }

  handleMapClick(e) {
    if (!this.measuringMode) {
      if (this.onSiteSelectedCallback) {
        this.onSiteSelectedCallback(e.latlng.lat, e.latlng.lng);
      }
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
      if (this.measurePoints.length >= 2) {
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

        this.updateMeasureStatusText(`📏 Jarak: ${text} (${this.measurePoints.length} titik disambung)`);
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
        this.updateMeasureStatusText(`📐 Titik ${this.measurePoints.length}/3 dipilih. Sila klik titik seterusnya untuk membentuk poligon.`);
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
          this.updateMeasureStatusText('⚠️ Titik-titik berada dalam satu garisan lurus. Sila klik titik di luar jajaran untuk membentuk keluasan.');
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
          `📐 Keluasan: ${areaSqM.toLocaleString()} m² (~${areaAcres} ekar / ${areaHectares} hektar) [${this.measurePoints.length} bucu${isSelfIntersecting ? ' - Auto Unkinked' : ''}]`
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
   * Fallback Shoelace formula for non-manifold topologies
   */
  calculateShoelaceArea(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Convert lat/lng to approximate meters from reference
      const x1 = points[i][0] * 111320 * Math.cos((points[i][1] * Math.PI) / 180);
      const y1 = points[i][1] * 110540;
      const x2 = points[j][0] * 111320 * Math.cos((points[j][1] * Math.PI) / 180);
      const y2 = points[j][1] * 110540;
      area += x1 * y2 - x2 * y1;
    }
    const areaSqM = Math.round(Math.abs(area) / 2);
    const areaAcres = (areaSqM / 4046.86).toFixed(2);
    const areaHectares = (areaSqM / 10000).toFixed(2);
    const areaSqFt = Math.round(areaSqM * 10.7639).toLocaleString();

    return {
      isCollinear: areaSqM < 0.5,
      isSelfIntersecting: false,
      areaSqM,
      areaAcres,
      areaHectares,
      areaSqFt,
      labelCenter: { lat: points[0][1], lng: points[0][0] }
    };
  }

  updateMeasureStatusText(text) {
    const statusSpan = document.getElementById('measure-status-text');
    if (statusSpan) {
      statusSpan.innerText = text;
    }
  }

  onSiteSelected(callback) {
    this.onSiteSelectedCallback = callback;
  }
}
