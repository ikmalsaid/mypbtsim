/**
 * Map Markers, Custom SVG Icons & Layer Generators
 * Leaflet integration with crisp vector icons and responsive popups
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

    default:
      return new L.Icon.Default();
  }
}

/**
 * Builds HTML Popup for Map Features
 */
export function buildPopupHtml(item, type) {
  let typeLabel = 'Infrastruktur';
  let badgeColor = '#0284c7';

  if (type === 'rail') {
    typeLabel = '🚆 Stesen Rel / Transit Awam';
    badgeColor = '#8b5cf6';
  } else if (type === 'bus') {
    typeLabel = '🚌 Hentian Bas Awam';
    badgeColor = '#f59e0b';
  } else if (type === 'education') {
    typeLabel = '🏫 Institusi Pendidikan';
    badgeColor = '#10b981';
  } else if (type === 'heritage') {
    typeLabel = '🏛️ Tapak Warisan Berwarta';
    badgeColor = '#ec4899';
  } else if (type === 'site') {
    typeLabel = '📍 Tapak Cadangan Pemajuan';
    badgeColor = '#ef4444';
  }

  return `
    <div class="custom-map-popup">
      <div class="popup-badge" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}55;">
        ${typeLabel}
      </div>
      <h4 class="popup-title">${item.name || 'Infrastruktur PBT'}</h4>
      <div class="popup-meta">
        ${item.distanceMeters !== undefined ? `<div class="meta-row"><span>Jarak Geodesik:</span> <strong>${item.distanceMeters} meter</strong></div>` : ''}
        ${item.operator ? `<div class="meta-row"><span>Pengendali:</span> <strong>${item.operator}</strong></div>` : ''}
        ${item.category ? `<div class="meta-row"><span>Kategori:</span> <strong>${item.category}</strong></div>` : ''}
        ${item.heritageLevel ? `<div class="meta-row"><span>Status Warisan:</span> <strong>${item.heritageLevel}</strong></div>` : ''}
        ${item.units ? `<div class="meta-row"><span>Cadangan Unit:</span> <strong>${item.units} Unit</strong></div>` : ''}
      </div>
    </div>
  `;
}
