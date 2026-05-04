/**
 * @file map.js — v3.0
 * @description Gerenciamento do mapa Leaflet: inicialização e renderização.
 */

import { CONFIG } from './config.js';
import { state, clearGlebas } from './state.js';
import {
  areaToColor, updateStatusCoords,
  formatArea, formatPerimeter, log
} from './ui.js';

export function initMap() {
  const map = L.map('map', { center: CONFIG.MAP.CENTER, zoom: CONFIG.MAP.ZOOM });

  const osmLayer = L.tileLayer(CONFIG.MAP.TILE_URL, {
    attribution: CONFIG.MAP.TILE_ATTRIBUTION, maxZoom: CONFIG.MAP.MAX_ZOOM,
  });
  const darkLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '&copy; CARTO', maxZoom: 19 }
  );
  const satLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '&copy; Esri, Maxar', maxZoom: 18 }
  );

  osmLayer.addTo(map);

  L.control.layers(
    { 'OpenStreetMap': osmLayer, 'Satélite (Esri)': satLayer, 'Mapa Escuro': darkLayer },
    {}, { position: 'topright', collapsed: true }
  ).addTo(map);

  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    position: 'topleft',
    edit: { featureGroup: drawnItems, remove: false },
    draw: {
      polygon: {
        allowIntersection: false, showArea: true, metric: true,
        shapeOptions: { color: '#448aff', weight: 2, fillOpacity: 0.3 },
      },
      polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
    },
  });
  map.addControl(drawControl);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  map.on('mousemove', e => updateStatusCoords(e.latlng));

  state.map = map;
  state.drawnItems = drawnItems;
  state.drawControl = drawControl;
  log('Mapa inicializado');
  return map;
}

export function renderPolygons(glebas) {
  state.polygonLayers.forEach(l => { state.map.removeLayer(l); state.drawnItems.removeLayer(l); });
  state.polygonLayers = [];
  if (!glebas.length) return;

  const maxArea = Math.max(...glebas.map(g => g.area));

  glebas.forEach(g => {
    const color = areaToColor(g.area, maxArea);
    const conf = state.conformidade.get(g.glebaId);

    // Borda vermelha se reprovada, amarela se alerta, azul se ok
    const strokeColor = conf?.reprovada ? '#dc2626'
      : g.tiIntersecoes?.length ? '#f59e0b'
        : conf?.temAlerta ? '#f59e0b'
          : color;

    const polygon = L.polygon(g.coords, {
      color: strokeColor, weight: 2.5, opacity: 0.9,
      fillColor: color, fillOpacity: 0.38,
    });

    polygon.bindPopup(buildPopup(g), { maxWidth: 300 });

    polygon.on('mouseover', function () {
      this.setStyle({ weight: 4, fillOpacity: 0.60 });
      this.bringToFront();
    });
    polygon.on('mouseout', function () {
      this.setStyle({ weight: 2.5, fillOpacity: 0.38 });
    });
    polygon.on('click', e => { e.originalEvent._glebaClicked = true; });
    polygon._glebaId = g.glebaId;

    polygon.addTo(state.map);
    state.drawnItems.addLayer(polygon);
    state.polygonLayers.push(polygon);
  });

  const bounds = L.featureGroup(state.polygonLayers).getBounds();
  if (bounds.isValid()) state.map.fitBounds(bounds, { padding: CONFIG.MAP.FIT_PADDING, maxZoom: 15 });
  if (!state.showGlebas) state.polygonLayers.forEach(l => state.map.removeLayer(l));
  log(`${state.polygonLayers.length} polígono(s) renderizado(s)`);
}

export function renderMarkers(glebas) {
  state.markerLayers.forEach(l => state.map.removeLayer(l));
  state.markerLayers = [];
  glebas.forEach(g => {
    g.coords.slice(0, -1).forEach((coord, i) => {
      const m = L.circleMarker(coord, {
        radius: 5, color: '#fff', weight: 1.5, fillColor: '#1e3a5f', fillOpacity: 0.9,
      }).bindPopup(`<strong>Gleba ${g.glebaId} — Ponto ${i + 1}</strong><br>
        <span class="font-monospace" style="font-size:.8em">
          Lat: ${coord[0].toFixed(6)}<br>Lon: ${coord[1].toFixed(6)}</span>`);
      m.addTo(state.map);
      state.markerLayers.push(m);
    });
  });
}

export function renderCentroids(glebas) {
  state.centroidLayers.forEach(l => state.map.removeLayer(l));
  state.centroidLayers = [];
  const maxArea = Math.max(...glebas.map(g => g.area));
  glebas.forEach(g => {
    const [lon, lat] = g.centroid;
    const color = areaToColor(g.area, maxArea);
    const icon = L.divIcon({
      className: '',
      html: `<div class="cgrn-centroid" style="background:${color};border-color:${color}">${g.glebaId}</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13],
    });
    const centroidMarker = L.marker([lat, lon], { icon })
      .bindPopup(buildPopup(g), { maxWidth: 300 })
      .addTo(state.map);
    state.centroidLayers.push(centroidMarker); // Bug corrigido: era push() sem argumento
  });
}

export function clearMapLayers() {
  [...state.polygonLayers, ...state.markerLayers, ...state.centroidLayers]
    .forEach(l => l && state.map.removeLayer(l));
  
  if (state.carLayer) {
    state.map.removeLayer(state.carLayer);
    state.carLayer = null;
  }

  state.drawnItems.clearLayers();
  clearGlebas();
  log('Mapa limpo');
}

/**
 * Renderiza os polígonos do CAR no mapa.
 * @param {CARResult[]} imoveis 
 */
export function renderCARLayer(imoveis) {
  if (state.carLayer) state.map.removeLayer(state.carLayer);
  
  const features = imoveis
    .filter(i => i.geometry)
    .map(i => {
      return {
        type: 'Feature',
        geometry: i.geometry,
        properties: {
          codigo: i.codigo,
          municipio: i.municipio,
          area: i.areaHa
        }
      };
    });

  if (!features.length) return;

  state.carLayer = L.geoJSON(features, {
    style: {
      color: '#059669',
      weight: 2,
      fillColor: '#10b981',
      fillOpacity: 0.2,
      dashArray: '5, 5'
    },
    onEachFeature: (f, l) => {
      l.bindPopup(`
        <div class="small">
          <strong class="d-block mb-1 text-success">Cadastro Ambiental Rural</strong>
          <span class="d-block"><strong>Código:</strong> ${f.properties.codigo}</span>
          <span class="d-block"><strong>Município:</strong> ${f.properties.municipio}</span>
          <span class="d-block"><strong>Área:</strong> ${f.properties.area.toFixed(2)} ha</span>
        </div>
      `);
    }
  }).addTo(state.map);

  state.map.fitBounds(state.carLayer.getBounds(), { padding: [50, 50] });
  log(`${features.length} imóvel(is) CAR renderizado(s) no mapa`);
}

export function zoomToGleba(glebaId) {
  const l = state.polygonLayers.find(l => l._glebaId === glebaId);
  if (!l) return;
  state.map.fitBounds(l.getBounds(), { padding: [40, 40], maxZoom: 16 });
  l.openPopup();
}

export function setGlebasVisible(v) {
  state.showGlebas = v;
  state.polygonLayers.forEach(l => v ? state.map.addLayer(l) : state.map.removeLayer(l));
}
export function setMarkersVisible(v) {
  state.showMarkers = v;
  state.markerLayers.forEach(l => v ? state.map.addLayer(l) : state.map.removeLayer(l));
}
export function setCentroidsVisible(v) {
  state.showCentroids = v;
  state.centroidLayers.forEach(l => v ? state.map.addLayer(l) : state.map.removeLayer(l));
}

function buildPopup(g) {
  const conf = state.conformidade.get(g.glebaId);
  const confLine = conf
    ? `<tr><td style="color:#888">BACEN/SICOR</td><td>${conf.reprovada ? '<i class="bi bi-slash-circle-fill"></i> Reprovada' : conf.temAlerta ? '<i class="bi bi-exclamation-triangle-fill"></i> Ressalvas' : '<i class="bi bi-check-circle-fill"></i> Aprovada'}</td></tr>`
    : '';
  const tiLine = g.tiIntersecoes?.length
    ? `<tr><td style="color:#888">Terra Indígena</td><td>${g.tiIntersecoes.map(t => t.nome).join(', ')}</td></tr>`
    : '';
  const biomaLine = g.bioma
    ? `<tr><td style="color:#888">Bioma</td><td>${g.bioma}</td></tr>` : '';

  return `<div style="min-width:210px;font-size:.83rem">
    <div class="fw-bold mb-2">Gleba ${g.glebaId}
      ${g.semiArido === true ? '<span class="badge bg-warning text-dark ms-1" style="font-size:.65rem"><i class="bi bi-sun-fill"></i> Semiárido</span>' : ''}
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#888;width:40%">Área</td><td><strong>${formatArea(g.area)} ha</strong></td></tr>
      <tr><td style="color:#888">Perímetro</td><td>${formatPerimeter(g.perimeter)}</td></tr>
      <tr><td style="color:#888">Municípios</td><td>${g.municipioCount}</td></tr>
      ${biomaLine}${tiLine}${confLine}
      <tr><td style="color:#888">Centroid</td>
          <td class="font-monospace" style="font-size:.7em">${g.centroid[1].toFixed(5)},<br>${g.centroid[0].toFixed(5)}</td></tr>
    </table>
  </div>`;
}
