/**
 * @file map.js
 * @description Gerenciamento do mapa Leaflet: inicialização, renderização
 * e controle de visibilidade de polígonos, marcadores e centroids.
 */

import { CONFIG } from './config.js';
import { state, clearGlebas } from './state.js';
import { areaToColor, updateStatusCoords, formatArea, formatPerimeter, log } from './ui.js';

// ─── Inicialização ────────────────────────────────────────────────────────

export function initMap() {
  const map = L.map('map', {
    center: CONFIG.MAP.CENTER,
    zoom: CONFIG.MAP.ZOOM,
    zoomControl: true,
  });

  // Tile layer principal
  const osmLayer = L.tileLayer(CONFIG.MAP.TILE_URL, {
    attribution: CONFIG.MAP.TILE_ATTRIBUTION,
    maxZoom: CONFIG.MAP.MAX_ZOOM,
  });

  // Tile layer escuro (CartoDB Dark — sem chave de API)
  const darkLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }
  );

  osmLayer.addTo(map);

  // Controle de camadas base
  L.control.layers(
    { 'OpenStreetMap': osmLayer, 'Mapa Escuro': darkLayer },
    {},
    { position: 'topright', collapsed: true }
  ).addTo(map);

  // Feature group para Leaflet.Draw
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Controle de desenho
  const drawControl = new L.Control.Draw({
    position: 'topleft',
    edit: { featureGroup: drawnItems, remove: false },
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: true,
        metric: true,
        shapeOptions: { color: '#448aff', weight: 2, fillOpacity: 0.3 },
        tooltip: {
          start: 'Clique para iniciar o polígono',
          cont: 'Clique para continuar',
          end: 'Clique no primeiro ponto para fechar',
        },
      },
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false,
    },
  });
  map.addControl(drawControl);

  // Escala
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  // Coordenadas do cursor
  map.on('mousemove', e => updateStatusCoords(e.latlng));

  state.map = map;
  state.drawnItems = drawnItems;
  state.drawControl = drawControl;

  log('Mapa inicializado');
  return map;
}

// ─── Polígonos ────────────────────────────────────────────────────────────

/**
 * Renderiza os polígonos das glebas no mapa.
 * Remove as camadas anteriores antes de redesenhar.
 * @param {GlebaData[]} glebas
 */
export function renderPolygons(glebas) {
  // Remove polígonos anteriores
  state.polygonLayers.forEach(l => {
    state.map.removeLayer(l);
    state.drawnItems.removeLayer(l);
  });
  state.polygonLayers = [];

  if (!glebas.length) return;

  const maxArea = Math.max(...glebas.map(g => g.area));

  glebas.forEach(g => {
    const color = areaToColor(g.area, maxArea);

    const polygon = L.polygon(g.coords, {
      color,
      weight: 2.5,
      opacity: 0.9,
      fillOpacity: 0.40,
      fillColor: color,
    });

    // Popup detalhado
    polygon.bindPopup(buildPopup(g), { maxWidth: 280 });

    // Highlight ao passar mouse
    polygon.on('mouseover', function () {
      this.setStyle({ weight: 4, fillOpacity: 0.62 });
      this.bringToFront();
    });
    polygon.on('mouseout', function () {
      this.setStyle({ weight: 2.5, fillOpacity: 0.40 });
    });

    // Marca o clique como originado numa gleba (evita popup de município da SUDENE)
    polygon.on('click', e => { e.originalEvent._glebaClicked = true; });

    // Guarda referência de glebaId na camada
    polygon._glebaId = g.glebaId;

    polygon.addTo(state.map);
    state.drawnItems.addLayer(polygon);
    state.polygonLayers.push(polygon);
  });

  // Ajusta viewport
  const bounds = L.featureGroup(state.polygonLayers).getBounds();
  if (bounds.isValid()) {
    state.map.fitBounds(bounds, { padding: CONFIG.MAP.FIT_PADDING, maxZoom: 15 });
  }

  // Aplica visibilidade atual
  if (!state.showGlebas) {
    state.polygonLayers.forEach(l => state.map.removeLayer(l));
  }

  log(`${state.polygonLayers.length} polígono(s) renderizado(s)`);
}

// ─── Marcadores de vértice ────────────────────────────────────────────────

export function renderMarkers(glebas) {
  state.markerLayers.forEach(l => state.map.removeLayer(l));
  state.markerLayers = [];
  if (!glebas.length) return;

  glebas.forEach(g => {
    // Exclui o último ponto (fechamento)
    g.coords.slice(0, -1).forEach((coord, idx) => {
      const marker = L.circleMarker(coord, {
        radius: 5,
        color: '#fff',
        weight: 1.5,
        fillColor: '#1e3a5f',
        fillOpacity: 0.9,
      }).bindPopup(
        `<strong>Gleba ${g.glebaId} — Ponto ${idx + 1}</strong><br>` +
        `<span class="font-monospace" style="font-size:0.8em">` +
        `Lat: ${coord[0].toFixed(6)}<br>Lon: ${coord[1].toFixed(6)}</span>`
      );
      marker.addTo(state.map);
      state.markerLayers.push(marker);
    });
  });

  log(`${state.markerLayers.length} marcador(es) renderizado(s)`);
}

// ─── Centroids ────────────────────────────────────────────────────────────

export function renderCentroids(glebas) {
  state.centroidLayers.forEach(l => state.map.removeLayer(l));
  state.centroidLayers = [];
  if (!glebas.length) return;

  const maxArea = Math.max(...glebas.map(g => g.area));

  glebas.forEach(g => {
    const [lon, lat] = g.centroid;
    const color = areaToColor(g.area, maxArea);
    const icon = L.divIcon({
      className: '',
      html: `<div class="cgrn-centroid" style="background:${color};border-color:${color}">${g.glebaId}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const m = L.marker([lat, lon], { icon })
      .bindPopup(buildPopup(g), { maxWidth: 280 })
      .addTo(state.map);
    state.centroidLayers.push(m);
  });

  log(`${state.centroidLayers.length} centroid(s) renderizado(s)`);
}

// ─── Toggle de visibilidade ───────────────────────────────────────────────

/** Alterna visibilidade de todos os polígonos (Mostrar Glebas) */
export function setGlebasVisible(visible) {
  state.showGlebas = visible;
  state.polygonLayers.forEach(l => {
    if (visible) { if (!state.map.hasLayer(l)) state.map.addLayer(l); }
    else state.map.removeLayer(l);
  });
}

/** Alterna visibilidade dos marcadores de vértice */
export function setMarkersVisible(visible) {
  state.showMarkers = visible;
  state.markerLayers.forEach(l => {
    if (visible) { if (!state.map.hasLayer(l)) state.map.addLayer(l); }
    else state.map.removeLayer(l);
  });
}

/** Alterna visibilidade dos centroids */
export function setCentroidsVisible(visible) {
  state.showCentroids = visible;
  state.centroidLayers.forEach(l => {
    if (visible) { if (!state.map.hasLayer(l)) state.map.addLayer(l); }
    else state.map.removeLayer(l);
  });
}

// ─── Zoom para uma gleba ──────────────────────────────────────────────────

export function zoomToGleba(glebaId) {
  const layer = state.polygonLayers.find(l => l._glebaId === glebaId);
  if (!layer) return;
  state.map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
  layer.openPopup();
}

// ─── Limpeza ──────────────────────────────────────────────────────────────

export function clearMapLayers() {
  [...state.polygonLayers, ...state.markerLayers, ...state.centroidLayers]
    .forEach(l => state.map.removeLayer(l));
  state.drawnItems.clearLayers();
  clearGlebas();
  log('Mapa limpo');
}

// ─── Popup HTML ───────────────────────────────────────────────────────────

function buildPopup(g) {
  const semiLabel = g.semiArido === true
    ? '<span class="badge bg-warning text-dark"><i class="bi bi-cloud-slash-fill"></i> Semiárido</span>'
    : g.semiArido === false
      ? '<span class="badge bg-success-subtle text-success-emphasis"><i class="bi bi-cloud-rain-heavy-fill"></i> Fora do Semiárido</span>'
      : '';

  return `
    <div style="min-width:200px;font-size:0.83rem">
      <div class="d-flex align-items-center gap-2 mb-2">
        <strong>Gleba ${g.glebaId}</strong>
        ${semiLabel}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#888;width:40%">Área</td>
            <td><strong>${formatArea(g.area)} ha</strong></td></tr>
        <tr><td style="color:#888">Perímetro</td>
            <td>${formatPerimeter(g.perimeter)}</td></tr>
        <tr><td style="color:#888">Municípios</td>
            <td>${g.municipioCount}</td></tr>
        <tr><td style="color:#888">Centro Geométrico</td>
            <td class="font-monospace" style="font-size:0.72em">
              ${g.centroid[1].toFixed(5)},<br>${g.centroid[0].toFixed(5)}
            </td></tr>
      </table>
    </div>`;
}
