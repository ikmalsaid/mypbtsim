/**
 * Map Markers, Custom SVG Icons & Layer Generators
 * Leaflet integration with crisp vector icons, distinctive colors, and rich Overpass-tag-exposing popups.
 */

import L from 'leaflet';

/**
 * Creates custom SVG DivIcon
 */
export function createCustomIcon(type, label = '') {
  let iconHtml = '';
  let className = `custom-map-pin pin-${type}`;

  switch (type) {
    case 'site':
      iconHtml = `
        <div class="pin-wrapper pin-site-wrapper">
          <div class="pulse-ring"></div>
          <div class="pin-body site-pin">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="pin-label-tag">TAPAK PBT</div>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 42],
        popupAnchor: [0, -42]
      });

    case 'rail':
      iconHtml = `
        <div class="pin-body rail-pin" title="${label}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect width="16" height="16" x="4" y="3" rx="2"/>
            <path d="M4 11h16"/>
            <path d="M12 3v8"/>
            <path d="m8 19-2 3"/>
            <path d="m18 22-2-3"/>
            <circle cx="8" cy="15" r="1"/>
            <circle cx="16" cy="15" r="1"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });

    case 'bus':
      iconHtml = `
        <div class="pin-body bus-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/>
            <path d="M16 6v6"/>
            <path d="M4 12h16"/>
            <path d="M6 18h12"/>
            <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    case 'education':
      iconHtml = `
        <div class="pin-body school-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    case 'worship':
      iconHtml = `
        <div class="pin-body worship-pin" title="${label}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4"/>
            <path d="M4 22h16"/>
            <path d="M6 18h12"/>
            <path d="M6 18V9a6 6 0 0 1 12 0v9"/>
            <path d="M9 18v-4a3 3 0 0 1 6 0v4"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

    case 'heritage':
      iconHtml = `
        <div class="pin-body heritage-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="22" x2="21" y2="22"/>
            <line x1="6" y1="18" x2="6" y2="11"/>
            <line x1="10" y1="18" x2="10" y2="11"/>
            <line x1="14" y1="18" x2="14" y2="11"/>
            <line x1="18" y1="18" x2="18" y2="11"/>
            <polygon points="12 2 20 7 4 7"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    case 'museum':
      iconHtml = `
        <div class="pin-body museum-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
            <path d="M2 12h20"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    case 'health':
      iconHtml = `
        <div class="pin-body health-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 6v12"/>
            <path d="M6 12h12"/>
            <rect width="18" height="18" x="3" y="3" rx="4"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    case 'parks':
      iconHtml = `
        <div class="pin-body parks-pin" title="${label}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/>
            <path d="M7 16v6"/>
            <path d="M13 19v3"/>
            <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-4 4.3a1 1 0 0 0 .8 1.7H10l-3 3.3a1 1 0 0 0 .7 1.7H10l-3 3.3a1 1 0 0 0 .7 1.7H12Z"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className,
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

    default:
      return new L.Icon.Default();
  }
}

/**
 * Builds HTML Popup for Map Features with a sleek, polished executive layout and OpenStreetMap inspection
 */
export function buildPopupHtml(item, type) {
  let typeLabel = 'Infrastruktur PBT';
  let icon = '📍';
  let badgeColor = '#0284c7';

  if (type === 'rail') {
    typeLabel = 'Stesen Transit Rel';
    icon = '🚆';
    badgeColor = '#a855f7';
  } else if (type === 'bus') {
    typeLabel = 'Hentian Bas Awam';
    icon = '🚌';
    badgeColor = '#f59e0b';
  } else if (type === 'education') {
    typeLabel = 'Institusi Pendidikan';
    icon = '🏫';
    badgeColor = '#10b981';
  } else if (type === 'worship') {
    typeLabel = 'Rumah Ibadat Komuniti';
    icon = '🕌';
    badgeColor = '#06b6d4';
  } else if (type === 'heritage') {
    typeLabel = 'Warisan Sejarah (Akta 645)';
    icon = '🏛️';
    badgeColor = '#ec4899';
  } else if (type === 'museum') {
    typeLabel = 'Muzium & Pusat Sains';
    icon = '🎨';
    badgeColor = '#f43f5e';
  } else if (type === 'health') {
    typeLabel = 'Kesihatan & Awam';
    icon = '🏥';
    badgeColor = '#14b8a6';
  } else if (type === 'parks') {
    typeLabel = 'Taman & Rekreasi Awam';
    icon = '🌳';
    badgeColor = '#84cc16';
  } else if (type === 'site') {
    typeLabel = 'Tapak Cadangan Pemajuan';
    icon = '📍';
    badgeColor = '#ef4444';
  }

  // Construct structured rows tailored strictly per type
  const metaRows = [];

  if (item.distanceMeters !== undefined) {
    const walkingMinutes = Math.max(1, Math.round(item.distanceMeters / 80));
    metaRows.push(`
      <div class="popup-attr-row">
        <span class="attr-label"><span class="attr-icon">📏</span> Jarak Geodesik</span>
        <span class="attr-value"><strong>${item.distanceMeters.toLocaleString()} m</strong> <small>(~${walkingMinutes} min)</small></span>
      </div>
    `);
  }

  // Type-specific key-value attributes
  if (type === 'rail') {
    if (item.line) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🚆</span> Laluan Transit</span>
          <span class="attr-value"><strong>${item.line}</strong></span>
        </div>
      `);
    }
    if (item.operator) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🏢</span> Pengendali</span>
          <span class="attr-value"><strong>${item.operator}</strong></span>
        </div>
      `);
    }
  } else if (type === 'bus') {
    if (item.shelter) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">⛱️</span> Kemudahan</span>
          <span class="attr-value"><strong>${item.shelter}</strong> ${item.bench ? '<small>(Berbangku)</small>' : ''}</span>
        </div>
      `);
    }
  } else if (type === 'education') {
    metaRows.push(`
      <div class="popup-attr-row">
        <span class="attr-label"><span class="attr-icon">📚</span> Kategori</span>
        <span class="attr-value"><strong>${item.categoryLabel || item.category || 'Institusi Pendidikan'}</strong></span>
      </div>
    `);
    if (item.operator) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🏛️</span> Pentadbiran</span>
          <span class="attr-value"><strong>${item.operator}</strong></span>
        </div>
      `);
    }
  } else if (type === 'worship') {
    if (item.religiousType || item.religion) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🕊️</span> Jenis Rumah Ibadat</span>
          <span class="attr-value"><strong>${item.religiousType || item.religion}</strong></span>
        </div>
      `);
    }
  } else if (type === 'heritage') {
    if (item.heritageLevel) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">📜</span> Status Warisan</span>
          <span class="attr-value"><strong style="color: #f472b6;">${item.heritageLevel}</strong></span>
        </div>
      `);
    }
  } else if (type === 'museum') {
    metaRows.push(`
      <div class="popup-attr-row">
        <span class="attr-label"><span class="attr-icon">🔬</span> Jenis Tarikan</span>
        <span class="attr-value"><strong>${item.attractionType || 'Muzium / Pusat Sains'}</strong></span>
      </div>
    `);
    if (item.operator) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🏢</span> Pengurusan</span>
          <span class="attr-value"><strong>${item.operator}</strong></span>
        </div>
      `);
    }
  } else if (type === 'health') {
    metaRows.push(`
      <div class="popup-attr-row">
        <span class="attr-label"><span class="attr-icon">🏥</span> Jenis Kemudahan</span>
        <span class="attr-value"><strong>${item.categoryLabel || 'Kemudahan Awam & Kesihatan'}</strong></span>
      </div>
    `);
    if (item.operator) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🏛️</span> Agensi</span>
          <span class="attr-value"><strong>${item.operator}</strong></span>
        </div>
      `);
    }
  } else if (type === 'parks') {
    metaRows.push(`
      <div class="popup-attr-row">
        <span class="attr-label"><span class="attr-icon">🌳</span> Jenis Rekreasi</span>
        <span class="attr-value"><strong>${item.categoryLabel || 'Taman & Rekreasi Awam'}</strong></span>
      </div>
    `);
  } else if (type === 'site') {
    if (item.units) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">🏢</span> Skala Cadangan</span>
          <span class="attr-value"><strong>${item.units.toLocaleString()} Unit</strong></span>
        </div>
      `);
    }
    if (item.lat && item.lng) {
      metaRows.push(`
        <div class="popup-attr-row">
          <span class="attr-label"><span class="attr-icon">📍</span> Koordinat Tapak</span>
          <span class="attr-value"><strong>${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}</strong></span>
        </div>
      `);
    }
  }

  return `
    <div class="custom-map-popup" style="--popup-accent: ${badgeColor};">
      <!-- Popup Header Bar -->
      <div class="popup-header-bar">
        <span class="popup-badge" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}66;">
          <span class="popup-badge-icon">${icon}</span> ${typeLabel}
        </span>
      </div>

      <!-- Landmark Title -->
      <h4 class="popup-title">${item.name || 'Infrastruktur PBT'}</h4>

      <!-- Key Attributes List -->
      <div class="popup-attr-list">
        ${metaRows.join('')}
      </div>

      <!-- OpenStreetMap / Overpass Technical Inspector (Collapsible & Hidden by Default) -->
      ${
        item.primaryTag
          ? `
        <details class="popup-osm-details">
          <summary class="popup-osm-summary" title="Klik untuk papar / sembunyi data teknikal OpenStreetMap">
            <span class="osm-inspect-title">Data OSM</span>
            <span class="osm-chevron">▾</span>
          </summary>
          <div class="osm-expanded-body">
            <div class="osm-tag-item">
              <span class="osm-k">Kategori API (Overpass):</span>
              <code class="osm-v">${item.primaryTag}</code>
            </div>
            ${
              item.osmTagsSummary
                ? `
              <div class="osm-tag-item">
                <span class="osm-k">Tag Penuh OSM:</span>
                <div class="osm-tags-text">${item.osmTagsSummary}</div>
              </div>
            `
                : ''
            }
          </div>
        </details>
      `
          : ''
      }
    </div>
  `;
}
