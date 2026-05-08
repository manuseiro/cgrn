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
    /** Precisão decimal recomendada para bases SICAR/BACEN (evita truncamento) */
    COORD_PRECISION: 8,
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
   * Terras Indígenas — FUNAI via https://manuseiro.github.io/api/funai/.
   * Fallback para arquivo local se a URL externa falhar.
   */
  TI: Object.freeze({
    URL_PRIMARIA: 'https://geoserver.funai.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:tis_poligonais&outputFormat=application%2Fjson&CQL_FILTER=uf_sigla+IN+(\'MA\',\'PI\',\'CE\',\'RN\',\'PB\',\'PE\',\'AL\',\'SE\',\'BA\')',
    URL_FALLBACK: 'api/terras_indigenas_nordeste.geojson',
    NORDESTE_UFS: Object.freeze(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA']),
  }),

  /**
   * ICMBio — Unidades de Conservação (Arquivo Interno) via https://manuseiro.github.io/api/icmbio/.
   * Fallback para arquivo local se a URL externa falhar.
   */
  ICMBIO: Object.freeze({
    URL_PRIMARIA: 'https://geoservicos.inde.gov.br/geoserver/ICMBio/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=limiteucsfederais_a&outputFormat=application%2Fjson',
    URL_FALLBACK: 'api/limiteucsfederais_a.json',
  }),

  /**
   * IBAMA — Áreas Embargadas (Arquivo Interno)
   */
  IBAMA: Object.freeze({
    URL_PRIMARIA: 'https://siscom.ibama.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=publica:vw_brasil_adm_embargo_a&outputFormat=application/json&CQL_FILTER=uf+IN+(\'MA\',\'PI\',\'CE\',\'RN\',\'PB\',\'PE\',\'AL\',\'SE\',\'BA\')',
    URL_FALLBACK: 'api/vw_brasil_adm_embargo_a.json',
  }),

  /**
   * APIs de conformidade ambiental — BACEN/SICOR
   * Todas são serviços públicos e gratuitos.
   */
  CONFORMIDADE: Object.freeze({



    /** Alternativa: SICAR / Módulo PRA */
    SICAR_API: 'https://www.car.gov.br/publico/municipios/downloads',

    /**
     * INPE TerraBrasilis — PRODES (desmatamento acumulado) e DETER (alertas)
     * https://terrabrasilis.dpi.inpe.br/geoserver/prodes-brasil-nb/prodes_brasil/wms
     * Biomas: Caatinga, Cerrado, Mata Atlântica no Nordeste
     */
    PRODES_API: 'https://terrabrasilis.dpi.inpe.br/app/api/v1/',
    DETER_WMS: 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/wms',
    BIOMA_WFS: 'https://geoservicos.ibge.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=CGMAT:qg_2025_240_bioma&outputFormat=application/json',

    /**
     * MapBiomas Alerta — desmatamento ilegal pós-marco legal
     * API GraphQL pública
     */
    MAPBIOMAS_API: 'https://plataforma.alerta.mapbiomas.org/api/v1/alerts.json',

    /**
     * CAR — Cadastro Ambiental Rural (SICAR)
     * Consulta pública por CPF/CNPJ ou código do imóvel
     */
    CAR_API: 'https://car.gov.br/#/consultar',

    /** Timeout para chamadas de API externas (ms) */
    TIMEOUT_MS: 15000,
  }),

  SICOR: Object.freeze({
    URL: 'https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v1/download/SICOR_GLEBAS_WKT_2026.gz',
  }),

  BIOMA: Object.freeze({
    URL_PRIMARIA: 'https://geoservicos.ibge.gov.br/geoserver/ows?' +
      'service=WFS&version=1.0.0&request=GetFeature' +
      '&typeName=CGMAT:qg_2025_240_bioma' +
      '&outputFormat=application%2Fjson' +
      '&CQL_FILTER=INTERSECTS(geom,POLYGON((-50%20-2,-34%20-2,-34%20-18,-50%20-18,-50%20-2)))',
    // Bounding box aproximado do Nordeste: reduz de 30MB para ~1-2MB
    URL_FALLBACK: 'api/qg_2025_240_bioma_nordeste.json',
    // ↑ versão pré-filtrada e simplificada do arquivo local (gerar com Mapshaper)
  }),

  STORAGE: Object.freeze({ KEY: 'cgrn_project_v3' }),

  /**
   * Coordenadas de exemplo — imóvel próximo ao Açude de Orós (CE)
   * Escolhido por estar em área de Caatinga sem conflitos
   */
  EXAMPLE_COORDS: [
    '1 1 -6.24100000 -38.91400000',
    '1 2 -6.24100000 -38.89800000',
    '1 3 -6.22700000 -38.89800000',
    '1 4 -6.22700000 -38.91400000',
    '1 5 -6.24100000 -38.91400000',
  ].join('\n'),

  DEBUG: false,
});
