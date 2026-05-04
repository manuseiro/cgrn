/**
 * @file state.js — v3.0
 * @description Estado centralizado da aplicação CGRN.
 */

export const state = {
  map: null,
  drawControl: null,
  drawnItems: null,
  glebas: [],
  polygonLayers: [],
  markerLayers: [],
  centroidLayers: [],
  validationMarkerLayers: [],

  // SUDENE
  sudeneLayer: null,
  sudeneFeatures: [],
  sudeneLoaded: false,

  // Cache djb2
  cache: new Map(),

  // Flags de UI
  isProcessing: false,
  darkMode: false,
  showMarkers: false,
  showCentroids: false,
  showGlebas: true,
  validatePoints: true,

  // Terras Indígenas (FUNAI)
  tiLayer: null,
  tiFeatures: [],
  tiLoaded: false,
  showTI: false,

  // Camadas externas — conformidade ambiental
  ucLayer: null,   // Unidades de Conservação (ICMBio)
  ucFeatures: [],
  ucLoaded: false,
  showUC: false,

  ibamaLayer: null, // Embargos IBAMA
  ibamaFeatures: [],
  ibamaLoaded: false,
  showIbama: false,

  biomeLayer: null,   // Biomas (IBGE)
  biomeFeatures: [],
  biomeLoaded: false,
  showBioma: false,

  carLayer: null,   // Layer para visualização de geometrias do CAR
  carFeatures: [],
  showCAR: false,

  /** Resultados de conformidade BACEN/SICOR por glebaId */
  conformidade: new Map(),  // glebaId → ConformidadeResult
};

export function clearGlebas() {
  state.glebas = [];
  state.polygonLayers = [];
  state.markerLayers = [];
  state.centroidLayers = [];
  state.conformidade = new Map();
}
