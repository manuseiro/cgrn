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
    AREA_MIN_HA: 0.01,
    /** BACEN/SICOR: área máxima por gleba para crédito rural geral */
    AREA_MAX_HA: 50000,
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
   * URL_PRIMARIA com FILTRO PIR UF: &CQL_FILTER=uf_sigla%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)
   */
  TI: Object.freeze({
    URL_PRIMARIA: 'https://geoserver.funai.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:tis_poligonais_portarias&outputFormat=application%2Fjson&CQL_FILTER=uf_sigla%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
    URL_FALLBACK: 'https://manuseiro.github.io/api/funai/tis_poligonais_portarias.json',
    NORDESTE_UFS: Object.freeze(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES']),
  }),

  /**
   * ICMBio — Unidades de Conservação (Arquivo Interno) via https://manuseiro.github.io/api/icmbio/.
   * Fallback para arquivo local se a URL externa falhar.
   * URL_PRIMARIA com FILTRO PIR UF: &CQL_FILTER=ufabrang%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)
   */
  ICMBIO: Object.freeze({
    URL_PRIMARIA: 'https://geoservicos.inde.gov.br/geoserver/ICMBio/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=limiteucsfederais_a&outputFormat=application%2Fjson&CQL_FILTER=ufabrang%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
    URL_FALLBACK: 'api/limiteucsfederais_a.json',
  }),

  /**
   * IBAMA — Áreas Embargadas (Arquivo Interno)
   * https://siscom.ibama.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=publica:vw_brasil_adm_embargo_a&outputFormat=application/json&maxFeatures=10000&CQL_FILTER=uf+IN+(\'MA\',\'PI\',\'CE\',\'RN\',\'PB\',\'PE\',\'AL\',\'SE\',\'BA\')
   * URL_PRIMARIA com FILTRO PIR UF: &CQL_FILTER=sig_uf%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)
  */
  IBAMA: Object.freeze({
    URL_PRIMARIA: 'https://siscom.ibama.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=publica:vw_brasil_adm_embargo_a&outputFormat=application/json&maxFeatures=10000&CQL_FILTER=sig_uf%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
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
    // API IBGE Estados, 
    //https://servicodados.ibge.gov.br/api/v3/malhas/estados/23?subnivel=biomas&formato=application/vnd.geo+json


    /**
     * CAR — Cadastro Ambiental Rural (SICAR)
     * Consulta pública por CPF/CNPJ ou código do imóvel
     */
    CAR_API: 'https://car.gov.br/#/consultar',

    /** Timeout para chamadas de API externas (ms) */
    TIMEOUT_MS: 15000,
  }),

  SICOR: Object.freeze({
    /** Base URL para os microdados brutos do BCB. O ano e a descompressão são tratados em sicor.js */
    URL_BASE: 'https://www.bcb.gov.br/htms/sicor/DadosBrutos/sicor_glebas_wkt_',
  }),

  BIOMA: Object.freeze({
    /** URL base */
    BASE_URL: 'https://geoservicos.ibge.gov.br/geoserver/ows?' +
      'service=WFS&version=1.0.0&request=GetFeature' +
      '&typeName=CGMAT:qg_2025_240_bioma' +
      '&outputFormat=application/json',

    /** Estados: Nordeste completo + MG + ES */
    ESTADOS: Object.freeze(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES']),

    /**
     * Bounding Box expandida (Nordeste + MG + ES)
     * Mais segura e cobre bem a região desejada
     */
    get CQL_FILTER() {
      return "INTERSECTS(geom,POLYGON((-52 -1,-30 -1,-30 -23,-52 -23,-52 -1)))";
    },

    /** URL Primária com filtro espacial otimizado */
    get URL_PRIMARIA() {
      return this.BASE_URL + '&CQL_FILTER=' + encodeURIComponent(this.CQL_FILTER) + '&maxFeatures=5000';
    },

    URL_FALLBACK: 'https://manuseiro.github.io/api/ibge/qg_2025_240_bioma_nordeste.json',
    // ↑ Sugiro gerar um novo fallback com Mapshaper incluindo MG e ES
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
