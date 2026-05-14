/**
 * @file config.js
 * @description Constantes e configurações centralizadas — v3.6.9.
 * Agora suporta sincronização dinâmica com o Ambiente Administrador.
 */

export const CONFIG = {
  /** URL do Proxy PHP para contornar CORS (usar caminho relativo para produção) */
  PROXY_URL: 'api/proxy.php?url=',

  MAP: {
    CENTER: [-9.5, -40.5],
    ZOOM: 6,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: 'Map data &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors',
    MAX_ZOOM: 18,
    FIT_PADDING: [60, 60],
  },

  VALIDATION: {
    NORDESTE: { latMin: -24, latMax: -1, lngMin: -52, lngMax: -34 },
    MIN_POINTS: 4,
    /** BACEN/SICOR: máximo de municípios por gleba */
    MAX_MUNICIPIOS: 4,
    /** Precisão decimal recomendada para bases SICAR/BACEN (evita truncamento) */
    COORD_PRECISION: 8,
    /** BACEN/SICOR: área mínima da gleba em hectares */
    AREA_MIN_HA: 0.01,
    /** BACEN/SICOR: área máxima por gleba para crédito rural geral */
    AREA_MAX_HA: 50000,
  },

  SUDENE: {
    URL: 'https://manuseiro.github.io/api/sudene/SUDENE_2021.json',
    STATE_COLORS: {
      AL: '#FF5733', BA: '#ffd740', CE: '#448aff', MA: '#FF33A1',
      PB: '#A133FF', PE: '#ff6e40', PI: '#e040fb', RN: '#5733FF',
      SE: '#33A1FF', MG: '#A1FF33', ES: '#FF33BD',
    },
    DEFAULT_COLOR: '#888888',
  },

  /**
   * Terras Indígenas — FUNAI via https://manuseiro.github.io/api/funai/.
   */
  TI: {
    URL_PRIMARIA: 'https://geoserver.funai.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:tis_poligonais_portarias&outputFormat=application%2Fjson&CQL_FILTER=uf_sigla%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
    URL_FALLBACK: 'https://manuseiro.github.io/api/funai/tis_poligonais_portarias.json',
    NORDESTE_UFS: ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES'],
  },

  ICMBIO: {
    URL_PRIMARIA: 'https://geoservicos.inde.gov.br/geoserver/ICMBio/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=limiteucsfederais_a&outputFormat=application%2Fjson&CQL_FILTER=ufabrang%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
    URL_FALLBACK: 'api/limiteucsfederais_a.json',
  },

  IBAMA: {
    URL_PRIMARIA: 'https://siscom.ibama.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=publica:vw_brasil_adm_embargo_a&outputFormat=application/json&maxFeatures=10000&CQL_FILTER=sig_uf%20IN%20(%27MA%27%2C%27PI%27%2C%27CE%27%2C%27RN%27%2C%27PB%27%2C%27PE%27%2C%27AL%27%2C%27SE%27%2C%27BA%27%2C%27ES%27%2C%27MG%27)',
    URL_FALLBACK: 'api/vw_brasil_adm_embargo_a.json',
  },

  CONFORMIDADE: {
    SICAR_API: 'https://www.car.gov.br/publico/municipios/downloads',
    PRODES_API: 'https://terrabrasilis.dpi.inpe.br/app/api/v1/',
    DETER_WMS: 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/wms',
    BIOMA_WFS: 'https://geoservicos.ibge.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=CGMAT:qg_2025_240_bioma&outputFormat=application/json',
    MAPBIOMAS_API: 'https://plataforma.alerta.mapbiomas.org/api/v1/alerts.json',
    CAR_API: 'https://car.gov.br/#/consultar',
    TIMEOUT_MS: 15000,
    CACHE_VERSION: 'v1.1',
  },

  SICOR: {
    URL_BASE: 'https://www.bcb.gov.br/htms/sicor/DadosBrutos/sicor_glebas_wkt_',
  },

  BIOMA: {
    BASE_URL: 'https://geoservicos.ibge.gov.br/geoserver/ows?' +
      'service=WFS&version=1.0.0&request=GetFeature' +
      '&typeName=CGMAT:qg_2025_240_bioma' +
      '&outputFormat=application/json',
    ESTADOS: ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES'],
    get CQL_FILTER() {
      return "INTERSECTS(geom,POLYGON((-52 -1,-30 -1,-30 -23,-52 -23,-52 -1)))";
    },
    get URL_PRIMARIA() {
      return this.BASE_URL + '&CQL_FILTER=' + encodeURIComponent(this.CQL_FILTER) + '&maxFeatures=5000';
    },
    URL_FALLBACK: 'https://manuseiro.github.io/api/ibge/qg_2025_240_bioma_nordeste.json',
  },

  STORAGE: { KEY: 'cgrn_project_v3' },

  UPLOAD: {
    MAX_CSV_BYTES: 10 * 1024 * 1024,
    MAX_TXT_BYTES: 10 * 1024 * 1024,
    MAX_KML_BYTES: 20 * 1024 * 1024,
    MAX_ZIP_BYTES: 50 * 1024 * 1024,
    WORKER_TIMEOUT_MS: 120_000,
  },

  EXAMPLE_COORDS: [
    '1 1 -6.24100000 -38.91400000',
    '1 2 -6.24100000 -38.89800000',
    '1 3 -6.22700000 -38.89800000',
    '1 4 -6.22700000 -38.91400000',
    '1 5 -6.24100000 -38.91400000',
  ].join('\n'),

  DEBUG: false,
};

/**
 * Busca as configurações do banco de dados e atualiza o objeto CONFIG.
 * Deve ser chamado antes da inicialização principal da aplicação.
 */
export async function syncConfig() {
  try {
    const response = await fetch('api/get_config.php');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    
    const result = await response.json();

    if (result.status === 'success' && result.data) {
      const d = result.data;
      
      // Mapeamento: Banco -> Objeto CONFIG
      if (d.AREA_MIN_HA) CONFIG.VALIDATION.AREA_MIN_HA = parseFloat(d.AREA_MIN_HA);
      if (d.AREA_MAX_HA) CONFIG.VALIDATION.AREA_MAX_HA = parseFloat(d.AREA_MAX_HA);
      if (d.MAX_MUNICIPIOS) CONFIG.VALIDATION.MAX_MUNICIPIOS = parseInt(d.MAX_MUNICIPIOS);
      if (d.COORD_PRECISION) CONFIG.VALIDATION.COORD_PRECISION = parseInt(d.COORD_PRECISION);
      if (d.PROXY_URL) CONFIG.PROXY_URL = d.PROXY_URL;
      if (d.API_TIMEOUT_MS) CONFIG.CONFORMIDADE.TIMEOUT_MS = parseInt(d.API_TIMEOUT_MS);
      
      // 1. Cores dos Estados (SUDENE)
      const ufs = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
      ufs.forEach(uf => {
        const key = `STATE_COLOR_${uf}`;
        if (d[key]) CONFIG.SUDENE.STATE_COLORS[uf] = d[key];
      });

      // 1. Estilos das Glebas
      CONFIG.GLEBA_STYLES = {
        OK:     { color: d.GLEBA_COLOR_OK || '#27AD60', opacity: parseFloat(d.GLEBA_OPACITY_OK || '0.6') },
        REJECT: { color: d.GLEBA_COLOR_REJECT || '#C0392B', opacity: parseFloat(d.GLEBA_OPACITY_REJECT || '0.6') },
        WARN:   { color: d.GLEBA_COLOR_WARN || '#F1C40F', opacity: parseFloat(d.GLEBA_OPACITY_WARN || '0.6') }
      };

      // 4. Limites de Upload (MB -> Bytes)
      if (d.MAX_UPLOAD_CSV_MB) CONFIG.UPLOAD.MAX_CSV_BYTES = parseInt(d.MAX_UPLOAD_CSV_MB) * 1024 * 1024;
      if (d.MAX_UPLOAD_KML_MB) CONFIG.UPLOAD.MAX_KML_BYTES = parseInt(d.MAX_UPLOAD_KML_MB) * 1024 * 1024;
      if (d.MAX_UPLOAD_ZIP_MB) CONFIG.UPLOAD.MAX_ZIP_BYTES = parseInt(d.MAX_UPLOAD_ZIP_MB) * 1024 * 1024;
      
      // Configurações do Mapa
      if (d.MAP_TILE_URL) CONFIG.MAP.TILE_URL = d.MAP_TILE_URL;
      if (d.MAP_TILE_ATTR) CONFIG.MAP.TILE_ATTRIBUTION = d.MAP_TILE_ATTR;
      if (d.MAP_CENTER_LAT && d.MAP_CENTER_LNG) {
        CONFIG.MAP.CENTER = [parseFloat(d.MAP_CENTER_LAT), parseFloat(d.MAP_CENTER_LNG)];
      }
      if (d.MAP_ZOOM_DEFAULT) CONFIG.MAP.ZOOM = parseInt(d.MAP_ZOOM_DEFAULT);

      console.log('✅ CGRN: Configurações sincronizadas com o banco de dados.');
    }
  } catch (err) {
    console.warn('⚠️ CGRN: Falha ao carregar config do DB. Usando fallback local.', err.message);
  }
}