/**
 * @file config.js
 * @description Constantes e configurações centralizadas — v3.0.
 */

export const CONFIG = Object.freeze({
  /** URL do Proxy PHP para contornar CORS (usar caminho relativo para produção) */
  PROXY_URL: 'api/proxy.php?url=',

  MAP: Object.freeze({
    CENTER: [-9.5, -40.5],
    ZOOM: 6,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: 'Map data &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors',
    MAX_ZOOM: 18,
    FIT_PADDING: [60, 60],
  }),

  VALIDATION: Object.freeze({
    NORDESTE: Object.freeze({ latMin: -18, latMax: -1, lngMin: -48, lngMax: -34 }),
    MIN_POINTS: 4,
    /** BACEN/SICOR: máximo de municípios por gleba */
    MAX_MUNICIPIOS: 4,
    /** BACEN/SICOR: área mínima da gleba em hectares */
    AREA_MIN_HA: 0.1,
    /** BACEN/SICOR: área máxima por gleba para crédito rural geral */
    AREA_MAX_HA: 15000,
  }),

  SUDENE: Object.freeze({
    URL: 'https://manuseiro.github.io/api/sudene/SUDENE_2021.json',
    STATE_COLORS: Object.freeze({
      AL: '#FF5733', BA: '#ffd740', CE: '#448aff', MA: '#FF33A1',
      PB: '#A133FF', PE: '#ff6e40', PI: '#e040fb', RN: '#5733FF',
      SE: '#33A1FF', MG: '#A1FF33', ES: '#FF33BD',
    }),
    DEFAULT_COLOR: '#888888',
  }),

  /**
   * Terras Indígenas — FUNAI via api/funai/manuseiro.github.io/.
   * Fallback para arquivo local se a URL externa falhar.
   */
  TI: Object.freeze({
    URL_PRIMARIA: 'https://manuseiro.github.io/api/funai/terras_indigenas_nordeste_2023.geojson',
    URL_FALLBACK: 'api/funai/terras_indigenas_nordeste.geojson',
    NORDESTE_UFS: Object.freeze(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA']),
  }),

  /**
   * APIs de conformidade ambiental — BACEN/SICOR
   * Todas são serviços públicos e gratuitos.
   */
  CONFORMIDADE: Object.freeze({
    /**
     * ICMBio — Unidades de Conservação (WMS + WFS)
     * WMS para tiles visuais, WFS para intersection check
     */
    UC_WMS: 'https://geoservices.icmbio.gov.br/arcgis/services/portal/NGIT_UNIDADES_CONSERVACAO/MapServer/WMSServer',
    UC_API: 'https://geoservices.icmbio.gov.br/arcgis/rest/services/portal/NGIT_UNIDADES_CONSERVACAO/MapServer/0/query',

    /**
     * IBAMA — Áreas Embargadas
     * REST endpoint público do IBAMA
     */
    EMBARGO_API: 'https://ibama.gov.br/component/phocadownload/file/1050-consulta-embs',
    /** Alternativa: SICAR / Módulo PRA */
    SICAR_API: 'https://www.car.gov.br/publico/municipios/downloads',

    /**
     * INPE TerraBrasilis — PRODES (desmatamento acumulado) e DETER (alertas)
     * Biomas: Caatinga, Cerrado, Mata Atlântica no Nordeste
     */
    PRODES_API: 'https://terrabrasilis.dpi.inpe.br/app/api/v1/',
    DETER_WMS: 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/wms',

    /**
     * MapBiomas Alerta — desmatamento ilegal pós-marco legal
     * API GraphQL pública
     */
    MAPBIOMAS_API: 'https://plataforma.alerta.mapbiomas.org/api/v1/alerts.json',

    /**
     * CAR — Cadastro Ambiental Rural (SICAR)
     * Consulta pública por CPF/CNPJ ou código do imóvel
     */
    CAR_API: 'https://www.car.gov.br/publico/imoveis/index',

    /** Timeout para chamadas de API externas (ms) */
    TIMEOUT_MS: 15000,
  }),

  STORAGE: Object.freeze({ KEY: 'cgrn_project_v3' }),

  /**
   * Coordenadas de exemplo — imóvel próximo ao Açude de Orós (CE)
   * Escolhido por estar em área de Caatinga sem conflitos
   */
  EXAMPLE_COORDS: [
    '1 1 -6.2410 -38.9140',
    '1 2 -6.2410 -38.8980',
    '1 3 -6.2270 -38.8980',
    '1 4 -6.2270 -38.9140',
    '1 5 -6.2410 -38.9140',
  ].join('\n'),

  DEBUG: false,
});
