/**
 * @file state.js
 * @description Gerenciamento de estado centralizado da aplicação.
 * Substitui variáveis globais espalhadas pelo código.
 * Importe e mute diretamente (sem setter/getter para simplicidade sem framework).
 */

/** @type {AppState} */
export const state = {
  /** Instância do mapa Leaflet */
  map: null,

  /** Controle de desenho do Leaflet.Draw */
  drawControl: null,

  /** L.FeatureGroup que contém os itens desenhados */
  drawnItems: null,

  /** Dados validados das glebas atuais */
  glebas: [],

  /** Camadas de polígonos Leaflet atualmente no mapa */
  polygonLayers: [],

  /** Camadas de marcadores de vértices Leaflet */
  markerLayers: [],

  /** Marcadores de centroid Leaflet */
  centroidLayers: [],

  /** Camada GeoJSON da SUDENE */
  sudeneLayer: null,

  /**
   * Índice espacial pré-computado das features da SUDENE.
   * Cada item: { id: string, bbox: number[], feature: GeoJSONFeature }
   * Permite filtro por bounding box antes de booleanPointInPolygon.
   */
  sudeneFeatures: [],

  /** Indica se a camada SUDENE foi carregada com sucesso */
  sudeneLoaded: false,

  /**
   * Cache de validação: Map<hash, GlebaData[]>
   * Usa hash djb2 do texto bruto como chave (ao invés do texto inteiro).
   */
  cache: new Map(),

  /** Flag para bloquear ações paralelas durante processamento */
  isProcessing: false,

  /** Modo escuro ativo */
  darkMode: false,

  /** Configuração de visibilidade de marcadores */
  showMarkers: false,

  /** Configuração de visibilidade de centroids */
  showCentroids: false,

  /** Polígonos visíveis no mapa (toggle "Mostrar Glebas") */
  showGlebas: true,

  /**
   * Quando true, valida cada vértice individualmente contra a SUDENE.
   * Operação mais pesada; controlada pelo checkbox "Validar pontos".
   */
  validatePoints: true,

  // ── Terras Indígenas ────────────────────────────────────────────────────

  /**
   * FeatureGroup Leaflet com os polígonos das Terras Indígenas do Nordeste.
   * null até que loadTerrasIndigenas() seja concluído.
   */
  tiLayer: null,

  /**
   * Índice espacial das features de TI.
   * Cada item: { bbox: number[], feature: GeoJSONFeature, props: object }
   */
  tiFeatures: [],

  /** Indica se a camada de TI foi carregada com sucesso */
  tiLoaded: false,

  /** Se a camada de TI está visível no mapa */
  showTI: false,
};

/**
 * Limpa apenas os dados de glebas e camadas do mapa.
 * Não afeta cache, configurações de SUDENE ou estado de UI.
 */
export function clearGlebas() {
  state.glebas = [];
  state.polygonLayers = [];
  state.markerLayers = [];
  state.centroidLayers = [];
}
