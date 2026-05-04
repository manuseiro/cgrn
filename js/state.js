/**
 * state.js — Gerenciamento centralizado de estado da aplicação.
 * 
 * Single source of truth para glebas. O textarea é apenas uma
 * visualização secundária. Qualquer edição (mapa, tabela, textarea)
 * deve passar pelo state para manter consistência.
 * 
 * Melhorias v2:
 *  - CRUD completo de glebas (add, update, remove por ID)
 *  - Reprocessamento automático (área, perímetro, municípios)
 *  - Eventos granulares por gleba
 *  - Unique ID por gleba para tracking robusto
 */

import { log } from './utils.js';

/**
 * @typedef {Object} GlebaData
 * @property {string} id — ID único da gleba (uuid simples)
 * @property {number} gleba — Número identificador da gleba (exibição)
 * @property {Array<[number, number]>} coords — Pares [lat, lon] para Leaflet
 * @property {Array<[number, number]>} rawCoords — Pares [lon, lat] originais (GeoJSON)
 * @property {number} area — Área em hectares
 * @property {number} perimeter — Perímetro em metros
 * @property {string[]} municipios — Códigos GEOCMU dos municípios
 * @property {[number, number]|null} centroid — [lon, lat] do centroide
 * @property {L.Layer|null} layer — Referência à layer do polígono no mapa
 */

/** Estado interno — não exportar diretamente */
const _state = {
  /** @type {GlebaData[]} */
  glebas: [],

  /** @type {L.Layer[]} */
  polygonLayers: [],

  /** @type {L.Marker[]} */
  markerLayers: [],

  /** @type {L.Layer[]} */
  centroidLayers: [],

  /** @type {L.Layer[]} */
  diagnosticLayers: [],

  /** @type {Map<string, any>} — cache de validação (chave = hash) */
  cache: new Map(),

  /** @type {L.FeatureGroup|null} — Camada para polígonos editáveis */
  editableGroup: null,

  /** @type {L.FeatureGroup|null} — Camada SUDENE carregada */
  sudeneLayer: null,

  /** @type {Array<{geometry: object, bbox: number[], properties: object}>} — Índice espacial SUDENE */
  sudeneIndex: [],

  /** @type {boolean} */
  darkMode: false,

  /** @type {boolean} — Flag de processamento em andamento */
  processing: false,

  /** @type {L.Map|null} */
  map: null,

  /** @type {string|null} — ID da gleba sendo editada visualmente */
  editingGlebaId: null,

  /** Counter for unique IDs */
  _idCounter: 0,
};

/** Listeners inscritos por chave de estado */
const _listeners = new Map();

// ── ID Generation ────────────────────────────────────────────────────────────

/**
 * Gera um ID único simples para glebas.
 * @returns {string}
 */
export function generateId() {
  _state._idCounter++;
  return `gleba_${Date.now()}_${_state._idCounter}`;
}

/**
 * Inscreve um callback para mudanças em uma chave do estado.
 * @param {string} key
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export function subscribe(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(callback);
  return () => _listeners.get(key)?.delete(callback);
}

/** Notifica listeners de uma chave. */
function _notify(key) {
  _listeners.get(key)?.forEach(fn => fn(_state[key]));
}

// ── Getters ──────────────────────────────────────────────────────────────────

export function getGlebas()         { return _state.glebas; }
export function getPolygonLayers()  { return _state.polygonLayers; }
export function getMarkerLayers()   { return _state.markerLayers; }
export function getCentroidLayers() { return _state.centroidLayers; }
export function getDiagnosticLayers() { return _state.diagnosticLayers; }
export function getCache()          { return _state.cache; }
export function getEditableGroup()  { return _state.editableGroup; }
export function getSudeneLayer()    { return _state.sudeneLayer; }
export function getSudeneIndex()    { return _state.sudeneIndex; }
export function isDarkMode()        { return _state.darkMode; }
export function isProcessing()      { return _state.processing; }
export function getMap()            { return _state.map; }
export function getEditingGlebaId() { return _state.editingGlebaId; }

/**
 * Obtém uma gleba pelo ID.
 * @param {string} id
 * @returns {GlebaData|undefined}
 */
export function getGlebaById(id) {
  return _state.glebas.find(g => g.id === id);
}

/**
 * Obtém uma gleba pelo número.
 * @param {number} num
 * @returns {GlebaData|undefined}
 */
export function getGlebaByNumber(num) {
  return _state.glebas.find(g => g.gleba === num);
}

// ── Setters ──────────────────────────────────────────────────────────────────

export function setGlebas(glebas) {
  // Ensure all glebas have IDs
  glebas.forEach(g => {
    if (!g.id) g.id = generateId();
  });
  _state.glebas = glebas;
  log('State: glebas atualizadas', glebas.length);
  _notify('glebas');
}

export function setPolygonLayers(layers) {
  _state.polygonLayers = layers;
  _notify('polygonLayers');
}

export function setMarkerLayers(layers) {
  _state.markerLayers = layers;
  _notify('markerLayers');
}

export function setCentroidLayers(layers) {
  _state.centroidLayers = layers;
  _notify('centroidLayers');
}

export function setDiagnosticLayers(layers) {
  _state.diagnosticLayers = layers;
  _notify('diagnosticLayers');
}

export function setEditableGroup(fg) {
  _state.editableGroup = fg;
}

export function setSudeneLayer(layer) {
  _state.sudeneLayer = layer;
  log('State: sudeneLayer definida');
  _notify('sudeneLayer');
}

export function setSudeneIndex(index) {
  _state.sudeneIndex = index;
  log('State: sudeneIndex criado com', index.length, 'features');
}

export function setDarkMode(value) {
  _state.darkMode = value;
  _notify('darkMode');
}

export function setProcessing(value) {
  _state.processing = value;
  _notify('processing');
}

export function setMap(map) {
  _state.map = map;
}

export function setEditingGlebaId(id) {
  _state.editingGlebaId = id;
  _notify('editingGlebaId');
}

// ── CRUD de Glebas ──────────────────────────────────────────────────────────

/**
 * Adiciona uma nova gleba ao estado.
 * @param {GlebaData} gleba
 */
export function addGleba(gleba) {
  if (!gleba.id) gleba.id = generateId();
  _state.glebas.push(gleba);
  log('State: gleba adicionada', gleba.gleba);
  _notify('glebas');
}

/**
 * Atualiza uma gleba existente pelo ID.
 * @param {string} id
 * @param {Partial<GlebaData>} updates
 */
export function updateGleba(id, updates) {
  const idx = _state.glebas.findIndex(g => g.id === id);
  if (idx === -1) {
    log('State: gleba não encontrada para update', id);
    return;
  }
  _state.glebas[idx] = { ..._state.glebas[idx], ...updates };
  log('State: gleba atualizada', _state.glebas[idx].gleba);
  _notify('glebas');
}

/**
 * Remove uma gleba pelo ID.
 * @param {string} id
 */
export function removeGleba(id) {
  const idx = _state.glebas.findIndex(g => g.id === id);
  if (idx === -1) return;
  const removed = _state.glebas.splice(idx, 1)[0];
  log('State: gleba removida', removed.gleba);
  // Renumerar glebas restantes
  _state.glebas.forEach((g, i) => { g.gleba = i + 1; });
  _notify('glebas');
}

// ── Ações compostas ─────────────────────────────────────────────────────────

/**
 * Limpa todo o estado de glebas, polígonos e marcadores.
 */
export function clearAll() {
  const map = _state.map;
  _state.polygonLayers.forEach(l => map?.removeLayer(l));
  _state.markerLayers.forEach(l => map?.removeLayer(l));
  _state.centroidLayers.forEach(l => map?.removeLayer(l));
  _state.diagnosticLayers.forEach(l => map?.removeLayer(l));
  _state.editableGroup?.clearLayers();

  _state.glebas = [];
  _state.polygonLayers = [];
  _state.markerLayers = [];
  _state.centroidLayers = [];
  _state.diagnosticLayers = [];
  _state.cache.clear();
  _state.editingGlebaId = null;

  _notify('glebas');
  _notify('polygonLayers');
  _notify('markerLayers');
  _notify('centroidLayers');
  _notify('diagnosticLayers');
  log('State: tudo limpo');
}

/**
 * Limpa apenas as camadas de diagnóstico.
 */
export function clearDiagnosticLayers() {
  const map = _state.map;
  _state.diagnosticLayers.forEach(l => map?.removeLayer(l));
  _state.diagnosticLayers = [];
}

/**
 * Adiciona resultado ao cache de validação.
 * @param {string} hash
 * @param {any} result
 */
export function cacheSet(hash, result) {
  _state.cache.set(hash, result);
}

/**
 * Obtém resultado do cache.
 * @param {string} hash
 * @returns {any|undefined}
 */
export function cacheGet(hash) {
  return _state.cache.get(hash);
}

/**
 * Serializa as glebas atuais para o formato de texto do textarea.
 * State → Textarea text.
 * @returns {string}
 */
export function glebasToText() {
  const lines = [];
  for (const g of _state.glebas) {
    g.rawCoords.forEach((coord, idx) => {
      const [lon, lat] = coord;
      lines.push(`${g.gleba} ${idx + 1} ${lat} ${lon}`);
    });
  }
  return lines.join('\n');
}
