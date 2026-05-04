/**
 * utils.js — Constantes, formatadores e utilitários gerais
 * Centraliza "magic numbers", funções de formatação e flag de debug.
 */

// ── Flag de debug ────────────────────────────────────────────────────────────
export const DEBUG = false;

/**
 * Logger condicional — só imprime quando DEBUG === true.
 */
export const log = (...args) => {
  if (DEBUG) console.log('[CGRN]', ...args);
};

export const logError = (...args) => {
  console.error('[CGRN:ERROR]', ...args);
};

// ── Constantes geográficas ───────────────────────────────────────────────────
/** Limites do Nordeste brasileiro (bounding box aproximado) */
export const NORDESTE_BOUNDS = {
  latMin: -18,
  latMax: -1,
  lonMin: -48,
  lonMax: -34,
};

/** Limites globais de coordenadas */
export const GLOBAL_BOUNDS = {
  latMin: -90,
  latMax: 90,
  lonMin: -180,
  lonMax: 180,
};

/** Número máximo de municípios que uma gleba pode abranger (regra BACEN) */
export const MAX_MUNICIPIOS_POR_GLEBA = 4;

/** Número mínimo de pontos para formar um polígono válido */
export const MIN_PONTOS_POLIGONO = 4;

/** Valores esperados por linha de coordenada (gleba, ponto, lat, lon) */
export const VALORES_POR_LINHA = 4;

/** Precisão mínima recomendada (casas decimais) */
export const MIN_DECIMAL_PRECISION = 5;

// ── Constantes do mapa ──────────────────────────────────────────────────────
export const MAP_CENTER = [-9.5, -40.5];
export const MAP_ZOOM = 5;
export const MAP_MAX_ZOOM = 18;
export const MAP_FIT_PADDING = [50, 50];

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors';

export const SUDENE_URL = 'https://manuseiro.github.io/SUDENE_2021.json';

/** Cores por estado para camada SUDENE */
export const STATE_COLORS = {
  AL: '#FF5733', BA: '#ffd740', CE: '#448aff', MA: '#FF33A1', PB: '#A133FF',
  PE: '#ff6e40', PI: '#e040fb', RN: '#5733FF', SE: '#33A1FF', MG: '#A1FF33',
  ES: '#FF33BD',
};

/** Opacidade da camada SUDENE */
export const SUDENE_OPACITY = { semiArido: 0.3, normal: 0.2 };

/** Cores utilizadas para glebas (paleta fixa para identificação visual) */
export const GLEBA_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

/** Estilo padrão do polígono desenhado via Geoman */
export const DRAW_POLYGON_STYLE = { color: '#3388ff', weight: 2, fillOpacity: 0.5 };

// ── Constantes de localStorage ──────────────────────────────────────────────
export const STORAGE_KEY = 'cgrn_projects';

// ── Constantes de diagnóstico ───────────────────────────────────────────────
export const DIAG_STATUS = {
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
};

// ── Funções utilitárias ─────────────────────────────────────────────────────

/**
 * Formata área em hectares com 2 casas decimais.
 * @param {number} areaHa
 * @returns {string}
 */
export function formatArea(areaHa) {
  return `${areaHa.toFixed(2)} ha`;
}

/**
 * Formata perímetro em metros/km.
 * @param {number} perimeterM — perímetro em metros
 * @returns {string}
 */
export function formatPerimeter(perimeterM) {
  if (perimeterM >= 1000) {
    return `${(perimeterM / 1000).toFixed(2)} km`;
  }
  return `${perimeterM.toFixed(0)} m`;
}

/**
 * Gera um hash simples (djb2) a partir de uma string.
 * Usado para cache de validação ao invés de string bruta.
 * @param {string} str
 * @returns {string}
 */
export function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Retorna a cor da gleba baseada no índice (paleta cíclica).
 * @param {number} index — índice da gleba (0-based)
 * @returns {string} cor CSS
 */
export function glebaColor(index) {
  return GLEBA_COLORS[index % GLEBA_COLORS.length];
}

/**
 * Gera cor dinâmica com base na razão área/maxÁrea.
 * Usa HSL para resultado mais perceptível.
 * @param {number} ratio — 0..1 (área / maxÁrea)
 * @returns {string} cor CSS
 */
export function areaColor(ratio) {
  // Vai de azul (240°) para vermelho (0°) conforme a área aumenta
  const hue = Math.round(240 - ratio * 240);
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Conta casas decimais de um número.
 * @param {number} num
 * @returns {number}
 */
export function countDecimals(num) {
  const str = String(num);
  const dotIdx = str.indexOf('.');
  if (dotIdx === -1) return 0;
  return str.length - dotIdx - 1;
}

/**
 * Verifica se o polígono está em sentido anti-horário.
 * Para coordenadas [lon, lat], usa regra da soma de edges.
 * @param {Array<[number, number]>} coords — [lon, lat]
 * @returns {boolean} true se anti-horário
 */
export function isCounterClockwise(coords) {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum < 0;
}

/**
 * Inverte a ordem dos pontos de um polígono (mantendo o fechamento).
 * @param {Array<[number, number]>} coords
 * @returns {Array<[number, number]>}
 */
export function reverseCoords(coords) {
  const inner = coords.slice(0, -1).reverse();
  return [...inner, inner[0]];
}

/**
 * Cria um elemento DOM a partir de um seletor tipo "div.classe#id".
 * Conveniência mínima para evitar repetição de createElement.
 * @param {string} tag
 * @param {object} attrs
 * @param {string} [textContent]
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, textContent = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (textContent) el.textContent = textContent;
  return el;
}

/**
 * Atalho para getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}
