/**
 * @file map.js — v3.0
 * @description Gerenciamento do mapa Leaflet: inicialização e renderização.
 */

import { CONFIG } from '../utils/config.js';
import { state, clearGlebas } from '../utils/state.js';
import {
  areaToColor, updateStatusCoords,
  formatArea, formatPerimeter, log
} from './ui.js';

const { COORD_PRECISION } = CONFIG.VALIDATION;

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

  // Cria um painel (pane) exclusivo para validações, garantindo que fiquem SEMPRE no topo
  const vPane = map.createPane('validationPane');
  vPane.style.zIndex = 650;
  vPane.style.pointerEvents = 'none';

  log('Mapa inicializado');
  return map;
}

export function renderPolygons(glebas) {
  state.polygonLayers.forEach(l => { state.map.removeLayer(l); state.drawnItems.removeLayer(l); });
  state.polygonLayers = [];
  if (!glebas.length) return;

  const maxArea = Math.max(...glebas.map(g => g.area));

  glebas.forEach(g => {
    //05/05/2026 - subistituimos o trecho: const color = areaToColor(g.area, maxArea);
    const color = areaToColor(g.area, maxArea, g.glebaId);
    const conf = state.conformidade.get(g.glebaId);

    // Borda vermelha se reprovada, amarela se alerta, azul se ok
    const strokeColor = conf?.reprovada ? '#dc2626'
      : g.tiIntersecoes?.length ? '#F68B1F'
        : conf?.temAlerta ? '#F68B1F'
          : color;

    const polygon = L.polygon(g.coords, {
      color: strokeColor, weight: 2.5, opacity: 0.5,
      fillColor: color, fillOpacity: 0.5,
    });

    polygon.bindPopup(buildPopup(g), { maxWidth: 300 });

    polygon.on('mouseover', function () {
      this.setStyle({ weight: 4, fillOpacity: 0.60 });
      this.bringToFront();
    });
    polygon.on('mouseout', function () {
      this.setStyle({ weight: 2.5, fillOpacity: 0.5 }); // Corrigido: era 0.8
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
          Lat: ${coord[0].toFixed(COORD_PRECISION)}<br>Lon: ${coord[1].toFixed(COORD_PRECISION)}</span>`);
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
    const color = areaToColor(g.area, maxArea, g.glebaId);
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
/**
 * Renderiza marcadores destacando problemas de validação 
 * (pontos duplicados, autointerseções e sobreposições entre glebas)
 * Só é chamado quando "Validar Pontos" está marcado.
 */
export function renderValidationMarkers(glebas, overlapFeatures = []) {
  // Remove marcadores antigos de validação
  if (state.validationMarkerLayers) {
    state.validationMarkerLayers.forEach(m => m && state.map.removeLayer(m));
  }
  state.validationMarkerLayers = [];

  if (!state.validatePoints) return;

  glebas.forEach(gleba => {
    const coords = gleba.coords; // [lat, lon]

    // Detecta duplicatas consecutivas
    const duplicates = [];
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      if (prev[0] === curr[0] && prev[1] === curr[1]) {
        duplicates.push(curr);
      }
    }

    // Marcadores vermelhos para duplicatas
    duplicates.forEach((coord, idx) => {
      const marker = L.circleMarker(coord, {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#dc3545',
        fillOpacity: 0.95,
        zIndexOffset: 1000,
        pane: 'validationPane'
      }).bindPopup(`<strong style="color:#dc3545"><i class="bi bi-exclamation-triangle-fill"></i> Ponto Duplicado</strong><br>
        Gleba ${gleba.glebaId} — Ponto ${idx + 1}<br>
        Lat: ${coord[0].toFixed(COORD_PRECISION)}<br>Lon: ${coord[1].toFixed(COORD_PRECISION)}`);

      marker.addTo(state.map);
      state.validationMarkerLayers.push(marker);
    });

    // Autointerseções (Kinks)
    if (gleba.turfPolygon) {
      try {
        const kinks = turf.kinks(gleba.turfPolygon);
        kinks.features.forEach((feat) => {
          const coord = [feat.geometry.coordinates[1], feat.geometry.coordinates[0]]; // [lat, lon]
          const marker = L.circleMarker(coord, {
            radius: 10,
            color: '#fff',
            weight: 3,
            fillColor: '#f59e0b', // Laranja ambar
            fillOpacity: 0.95,
            zIndexOffset: 1100,
            pane: 'validationPane'
          }).bindPopup(`<strong style="color:#d97706"><i class="bi bi-intersect"></i> Autointerseção</strong><br>
            Gleba ${gleba.glebaId}<br>
            Cruzamento de linhas detectado neste ponto.<br>
            Lat: ${coord[0].toFixed(COORD_PRECISION)}<br>Lon: ${coord[1].toFixed(COORD_PRECISION)}`);

          marker.addTo(state.map);
          state.validationMarkerLayers.push(marker);
        });
      } catch (e) {
        console.warn(`Gleba ${gleba.glebaId}: Erro ao processar autointerseções para o mapa.`, e);
      }
    }
  });

  // Renderiza sobreposições entre glebas (interseções)
  overlapFeatures.forEach(feat => {
    try {
      const layer = L.geoJSON(feat, {
        style: {
          color: '#dc2626',
          weight: 3,
          fillColor: '#ef4444',
          fillOpacity: 0.6,
          dashArray: '4, 4',
          pane: 'validationPane'
        }
      }).bindPopup(`
        <div class="small">
          <strong class="text-danger"><i class="bi bi-intersect"></i> Sobreposição Detectada</strong><br>
          Gleba ${feat.properties.gleba1} ↔ Gleba ${feat.properties.gleba2}<br>
          Área afetada: <strong>${feat.properties.area.toFixed(4)} ha</strong>
        </div>
      `);

      layer.addTo(state.map);
      state.validationMarkerLayers.push(layer);

      // NOVO: Adiciona marcadores nos pontos de "encontro" da sobreposição
      try {
        const points = turf.explode(feat);
        points.features.forEach(pt => {
          const coord = [pt.geometry.coordinates[1], pt.geometry.coordinates[0]];
          const m = L.circleMarker(coord, {
            radius: 4,
            color: '#dc2626',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 2,
            pane: 'validationPane'
          });
          m.addTo(state.map);
          state.validationMarkerLayers.push(m);
        });
      } catch (err) { /* explode falhou para geometria simples */ }
    } catch (e) {
      console.warn('Erro ao renderizar polígono de sobreposição:', e);
    }
  });

  log(`Validation markers: ${state.validationMarkerLayers.length} problemas destacados`);
}
export function clearMapLayers() {
  [...state.polygonLayers,
  ...state.markerLayers,
  ...state.centroidLayers,
  ...(state.validationMarkerLayers || [])]
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
          uf: i.uf,
          area: i.areaHa,
          status: i.status,
          condicao: i.condicao,
          areaModulos: i.areaModulos,
          tipoImovel: i.tipoImovel,
          datCriacao: i.datCriacao,
          datAtualizacao: i.datAtualizacao
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
      const p = f.properties;
      const municipioUF = p.uf && p.uf !== '—'
        ? `${p.municipio} - ${p.uf.toUpperCase()}`
        : p.municipio;

      const fmtData = (d) => {
        if (!d || d === '—') return '—';
        // Formato da API: YYYY-MM-DD ou YYYYMMDD
        const m = String(d).match(/(\d{4})-?(\d{2})-?(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
      };

      const statusLabel = {
        'AT': 'Ativo', 'CA': 'Cancelado',
        'SU': 'Suspenso', 'PE': 'Pendente'
      }[p.status] ?? p.status ?? '—';

      const condicaoLabel = {
        'REG': 'Regularizado', 'IRR': 'Irregular',
        'PEN': 'Pendente'
      }[p.condicao] ?? p.condicao ?? '—';

      l.bindPopup(`
        <div class="small" style="min-width:240px">
          <strong class="d-block mb-2 text-success border-bottom pb-1">
            <i class="bi bi-tree-fill me-1"></i> Cadastro Ambiental Rural
          </strong>
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
            <tr><td style="color:#666;width:85px;padding:2px 0">Código</td>
                <td><code style="font-size:0.75rem">${p.codigo}</code></td></tr>
            <tr><td style="color:#666;padding:2px 0">Município</td>
                <td><strong>${p.municipio} - ${String(p.uf).toUpperCase()}</strong></td></tr>
            <tr><td style="color:#666;padding:2px 0">Área</td>
                <td>${Number(p.area).toFixed(2).replace('.', ',')} ha</td></tr>
            <tr><td style="color:#666;padding:2px 0">Tip Imovel</td>
                <td><span class="badge bg-light text-dark border py-0" style="font-size:0.7rem">${p.tipoImovel}</span></td></tr>
            <tr><td style="color:#666;padding:2px 0">Mód. Fiscais</td>
                <td><strong>${Number(p.areaModulos || 0).toFixed(3).replace('.', ',')}</strong></td></tr>
            <tr><td style="color:#666;padding:2px 0">Situação</td>
                <td><span style="color:${p.status === 'AT' ? '#2e7d32' : '#666'}">●</span> ${statusLabel}</td></tr>
            <tr><td style="color:#666;padding:2px 0">Condição</td>
                <td>${condicaoLabel}</td></tr>
            <tr><td style="color:#666;padding:2px 0">Criado em</td>
                <td>${fmtData(p.datCriacao)}</td></tr>
            <tr><td style="color:#666;padding:2px 0">Atualizado</td>
                <td>${fmtData(p.datAtualizacao)}</td></tr>
          </table>
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
          <td class="font-monospace" style="font-size:.7em">${g.centroid[1].toFixed(COORD_PRECISION)},<br>${g.centroid[0].toFixed(COORD_PRECISION)}</td></tr>
    </table>
  </div>`;
}
