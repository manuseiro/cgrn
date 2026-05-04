/**
 * map.js — Inicialização e gerenciamento do mapa Leaflet com Leaflet-Geoman.
 *
 * Responsável por: criar o mapa, gerenciar polígonos/marcadores/centroids,
 * configurar Geoman para edição visual avançada (arrastar vértices,
 * adicionar/remover vértices, snapping), e eventos de interação.
 */

import {
  getMap, setMap, setEditableGroup, getEditableGroup,
  getPolygonLayers, setPolygonLayers,
  getMarkerLayers, setMarkerLayers,
  getCentroidLayers, setCentroidLayers,
  getGlebas, generateId,
} from './state.js';

import {
  log, logError,
  MAP_CENTER, MAP_ZOOM, MAP_MAX_ZOOM, MAP_FIT_PADDING,
  TILE_URL, TILE_ATTRIBUTION, DRAW_POLYGON_STYLE,
  glebaColor, formatArea, formatPerimeter,
} from './utils.js';

import { identificarMunicipio } from './sudene.js';
import { reprocessGlebaCoords } from './validation.js';

/* global L */

/**
 * Inicializa o mapa Leaflet e configura Geoman para edição avançada.
 * @returns {L.Map}
 */
export function initMap() {
  log('map: inicializando');

  const map = L.map('map', {
    zoomControl: true,
  }).setView(MAP_CENTER, MAP_ZOOM);

  // Tile layer
  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: MAP_MAX_ZOOM,
  }).addTo(map);

  // Feature group para polígonos editáveis
  const editableGroup = new L.FeatureGroup();
  map.addLayer(editableGroup);
  setEditableGroup(editableGroup);

  // ── Configurar Leaflet-Geoman ────────────────────────────────────────
  map.pm.addControls({
    position: 'topleft',
    drawMarker: false,
    drawCircle: false,
    drawCircleMarker: false,
    drawPolyline: false,
    drawRectangle: false,
    drawText: false,
    cutPolygon: false,
    rotateMode: false,
    drawPolygon: true,
    editMode: true,
    dragMode: true,
    removalMode: true,
  });

  // Geoman global options
  map.pm.setGlobalOptions({
    snappable: true,
    snapDistance: 15,
    allowSelfIntersection: false,
    templineStyle: { color: '#3b82f6', weight: 2 },
    hintlineStyle: { color: '#3b82f6', weight: 2, dashArray: '5,5' },
    pathOptions: { ...DRAW_POLYGON_STYLE },
  });

  // Tradução Geoman para PT-BR
  map.pm.setLang('custom', {
    tooltips: {
      placeMarker: 'Clique para posicionar marcador',
      firstVertex: 'Clique para colocar o primeiro vértice',
      continueLine: 'Clique para continuar desenhando',
      finishPoly: 'Clique no primeiro ponto para finalizar',
      finishRect: 'Clique para finalizar',
    },
    actions: {
      finish: 'Finalizar',
      cancel: 'Cancelar',
      removeLastVertex: 'Remover último vértice',
    },
    buttonTitles: {
      drawPolyButton: 'Desenhar Polígono',
      editButton: 'Editar Vértices',
      dragButton: 'Arrastar Polígonos',
      deleteButton: 'Remover Polígonos',
    },
  });

  // Salvar referência no estado
  setMap(map);

  // Evento: clique no mapa → identificar município (quando não está em modo edição)
  map.on('click', (e) => {
    if (map.pm.globalEditModeEnabled() || map.pm.globalDragModeEnabled() || map.pm.globalDrawModeEnabled()) {
      return;
    }

    const { lat, lng } = e.latlng;
    const result = identificarMunicipio(lat, lng);

    if (result) {
      const semiText = result.semiArido ? 'Semiárido' : 'Fora do Semiárido';
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`${result.nome} – ${result.uf} (${semiText})`)
        .openOn(map);
    } else {
      L.popup()
        .setLatLng(e.latlng)
        .setContent('Fora da área da SUDENE')
        .openOn(map);
    }
  });

  log('map: inicializado com sucesso');
  return map;
}

/**
 * Configura os eventos Geoman (create, edit, remove).
 * @param {function(GlebaData): void} onGlebaCreated — Callback quando nova gleba é desenhada
 * @param {function(string, Array): void} onGlebaEdited — Callback quando gleba é editada visualmente
 * @param {function(string): void} onGlebaRemoved — Callback quando gleba é removida
 */
export function setupGeomanEvents(onGlebaCreated, onGlebaEdited, onGlebaRemoved) {
  const map = getMap();

  // ── Novo polígono criado via Geoman ──────────────────────────────────
  map.on('pm:create', (e) => {
    const layer = e.layer;
    const glebas = getGlebas();
    const nextNum = glebas.length + 1;

    // Extrair coordenadas do layer
    const latLngs = layer.getLatLngs()[0];
    const rawCoords = latLngs.map(ll => [ll.lng, ll.lat]);
    // Fechar polígono
    rawCoords.push([...rawCoords[0]]);

    const glebaData = reprocessGlebaCoords(rawCoords, nextNum);
    if (glebaData) {
      glebaData.id = generateId();
      // Remover layer temporária do Geoman
      map.removeLayer(layer);
      onGlebaCreated(glebaData);
    } else {
      map.removeLayer(layer);
      log('map: polígono desenhado inválido');
    }
  });

  // ── Polígono editado (vértices arrastados, adicionados, removidos) ──
  map.on('pm:edit', (e) => {
    const layer = e.layer;
    const glebaId = layer._glebaId;
    if (!glebaId) return;

    const latLngs = layer.getLatLngs()[0];
    const rawCoords = latLngs.map(ll => [ll.lng, ll.lat]);
    rawCoords.push([...rawCoords[0]]);

    log('map: gleba editada via Geoman', glebaId);
    onGlebaEdited(glebaId, rawCoords);
  });

  // ── Polígono removido via Geoman ────────────────────────────────────
  map.on('pm:remove', (e) => {
    const layer = e.layer;
    const glebaId = layer._glebaId;
    if (!glebaId) return;

    log('map: gleba removida via Geoman', glebaId);
    onGlebaRemoved(glebaId);
  });
}

/**
 * Desenha as glebas validadas como polígonos no mapa.
 * Cada gleba recebe uma cor da paleta fixa para identificação visual clara.
 * Os polígonos são adicionados ao editableGroup para edição via Geoman.
 *
 * @param {Array} glebas — Array de GlebaData validadas
 */
export function renderGlebas(glebas) {
  const map = getMap();
  if (!map) return;

  log('map: renderizando', glebas.length, 'glebas');

  // ── Limpar layers anteriores ──────────────────────────────────────
  getPolygonLayers().forEach(l => map.removeLayer(l));
  getCentroidLayers().forEach(l => map.removeLayer(l));
  const editableGroup = getEditableGroup();
  editableGroup.clearLayers();

  const newPolygonLayers = [];
  const newCentroidLayers = [];

  glebas.forEach((g, idx) => {
    const color = glebaColor(idx);

    // ── Polígono ────────────────────────────────────────────────────
    const polygon = L.polygon(g.coords, {
      color,
      weight: 2.5,
      fillOpacity: 0.35,
      fillColor: color,
    });

    // Marcar com ID da gleba para rastreamento
    polygon._glebaId = g.id;

    // Popup com informações completas
    polygon.bindPopup(`
      <div style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block"></span>
          <b>Gleba ${g.gleba}</b>
        </div>
        <b>Área:</b> ${formatArea(g.area)}<br>
        <b>Perímetro:</b> ${formatPerimeter(g.perimeter)}<br>
        <b>Municípios:</b> ${g.municipios.length}<br>
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-primary popup-edit-btn" data-gleba-id="${g.id}">
            <i class="bi bi-pencil"></i> Editar
          </button>
          <button class="btn btn-sm btn-outline-danger popup-remove-btn ms-1" data-gleba-id="${g.id}">
            <i class="bi bi-trash"></i> Remover
          </button>
        </div>
      </div>
    `);

    // Hover highlight
    const originalStyle = { color, weight: 2.5, fillOpacity: 0.35 };
    const hoverStyle = { color: '#fff', weight: 4, fillOpacity: 0.6 };

    polygon.on('mouseover', () => polygon.setStyle(hoverStyle));
    polygon.on('mouseout', () => polygon.setStyle(originalStyle));

    // Habilitar edição Geoman neste layer
    polygon.options.pmIgnore = false;

    polygon.addTo(map);
    editableGroup.addLayer(polygon);
    newPolygonLayers.push(polygon);

    // ── Centroide com label ─────────────────────────────────────────
    if (g.centroid) {
      const [lon, lat] = g.centroid;
      const centroidMarker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: 'centroid-label',
          html: `<span class="centroid-text" style="border-left:3px solid ${color}">G${g.gleba}<br>${formatArea(g.area)}</span>`,
          iconSize: [90, 40],
          iconAnchor: [45, 20],
        }),
        interactive: false,
        pmIgnore: true,
      }).addTo(map);
      newCentroidLayers.push(centroidMarker);
    }
  });

  setPolygonLayers(newPolygonLayers);
  setCentroidLayers(newCentroidLayers);

  // Ajustar viewport
  if (newPolygonLayers.length > 0) {
    const bounds = L.featureGroup(newPolygonLayers).getBounds();
    map.fitBounds(bounds, { padding: MAP_FIT_PADDING });
  }

  log('map: renderização concluída');
}

/**
 * Ativa edição de uma gleba específica no mapa.
 * @param {string} glebaId
 */
export function enableGlebaEdit(glebaId) {
  const map = getMap();
  if (!map) return;

  // Desabilitar edição global primeiro
  map.pm.disableGlobalEditMode();

  // Encontrar o layer da gleba
  const layers = getPolygonLayers();
  const layer = layers.find(l => l._glebaId === glebaId);
  if (layer) {
    layer.pm.enable({
      allowSelfIntersection: false,
      snappable: true,
      snapDistance: 15,
    });
    // Zoom no polígono
    map.fitBounds(layer.getBounds(), { padding: MAP_FIT_PADDING });
    log('map: edição habilitada para gleba', glebaId);
  }
}

/**
 * Desabilita edição de todas as glebas.
 */
export function disableAllEdits() {
  const map = getMap();
  if (!map) return;
  map.pm.disableGlobalEditMode();
  map.pm.disableGlobalDragMode();
  getPolygonLayers().forEach(l => {
    if (l.pm) l.pm.disable();
  });
}

/**
 * Renderiza marcadores nos vértices das glebas.
 * @param {Array} glebas
 */
export function renderMarkers(glebas) {
  const map = getMap();
  if (!map) return;

  // Limpar marcadores anteriores
  getMarkerLayers().forEach(l => map.removeLayer(l));
  const newMarkers = [];

  glebas.forEach((g, gIdx) => {
    const color = glebaColor(gIdx);
    g.coords.forEach((coord, idx) => {
      const marker = L.circleMarker(coord, {
        radius: 5,
        color: color,
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
        pmIgnore: true,
      })
        .addTo(map)
        .bindPopup(`<b>Gleba ${g.gleba}</b>, Ponto ${idx + 1}<br>[${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`);
      newMarkers.push(marker);
    });
  });

  setMarkerLayers(newMarkers);
  log('map: marcadores renderizados:', newMarkers.length);
}

/**
 * Remove todos os marcadores do mapa.
 */
export function clearMarkers() {
  const map = getMap();
  getMarkerLayers().forEach(l => map?.removeLayer(l));
  setMarkerLayers([]);
}

/**
 * Ativa o modo de desenho de polígono via Geoman.
 */
export function enableDrawMode() {
  const map = getMap();
  if (!map) return;
  map.pm.enableDraw('Polygon', {
    snappable: true,
    snapDistance: 15,
    allowSelfIntersection: false,
    templineStyle: { color: '#3b82f6', weight: 2 },
    hintlineStyle: { color: '#3b82f6', weight: 2, dashArray: '5,5' },
    pathOptions: { ...DRAW_POLYGON_STYLE },
  });
  log('map: modo de desenho ativado via Geoman');
}

/**
 * Destaca um polígono de gleba no mapa (flash).
 * @param {string} glebaId
 */
export function flashGleba(glebaId) {
  const layer = getPolygonLayers().find(l => l._glebaId === glebaId);
  if (!layer) return;

  const map = getMap();
  const origStyle = { ...layer.options };

  let count = 0;
  const flash = setInterval(() => {
    if (count % 2 === 0) {
      layer.setStyle({ color: '#fff', weight: 5, fillOpacity: 0.7 });
    } else {
      layer.setStyle({ color: origStyle.color, weight: origStyle.weight, fillOpacity: origStyle.fillOpacity });
    }
    count++;
    if (count >= 6) {
      clearInterval(flash);
      layer.setStyle({ color: origStyle.color, weight: origStyle.weight, fillOpacity: origStyle.fillOpacity });
    }
  }, 200);

  map.fitBounds(layer.getBounds(), { padding: MAP_FIT_PADDING });
}
