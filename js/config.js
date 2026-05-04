/**
 * @file config.js
 * @description Constantes e configurações centralizadas da aplicação.
 * Modificar aqui para ajustar comportamento global sem tocar na lógica.
 */

export const CONFIG = Object.freeze({

  MAP: Object.freeze({
    CENTER: [-9.5, -40.5],
    ZOOM: 6,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: 'Map data &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors',
    MAX_ZOOM: 18,
    FIT_PADDING: [60, 60],
  }),

  VALIDATION: Object.freeze({
    /** Bounding box aproximada do Nordeste + área SUDENE */
    NORDESTE: Object.freeze({ latMin: -18, latMax: -1, lngMin: -48, lngMax: -34 }),
    /** Mínimo de vértices por polígono (incluindo fechamento) */
    MIN_POINTS: 4,
    /** Máximo de municípios que uma gleba pode abranger */
    MAX_MUNICIPIOS: 4,
  }),

  SUDENE: Object.freeze({
    URL: 'https://manuseiro.github.io/api/sudene/SUDENE_2021.json',
    /** Cores por UF para visualização */
    STATE_COLORS: Object.freeze({
      AL: '#FF5733', BA: '#ffd740', CE: '#448aff', MA: '#FF33A1',
      PB: '#A133FF', PE: '#ff6e40', PI: '#e040fb', RN: '#5733FF',
      SE: '#33A1FF', MG: '#A1FF33', ES: '#FF33BD',
    }),
    DEFAULT_COLOR: '#888888',
  }),

  STORAGE: Object.freeze({
    KEY: 'cgrn_project_v2',
  }),

  /** Coordenadas de exemplo no formato esperado (Recife-PE) */
  EXAMPLE_COORDS: '1 1 -8.05 -34.95\n1 2 -8.10 -34.95\n1 3 -8.10 -34.90\n1 4 -8.05 -34.95',

  /** Ativar para ver logs detalhados no console */
  DEBUG: false,
});
