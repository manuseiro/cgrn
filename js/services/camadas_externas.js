/**
 * @file camadas_externas.js — v3.4
 * @description Carregamento e gerenciamento de camadas ambientais externas:
 *   - Unidades de Conservação (ICMBio)
 *   - Áreas Embargadas IBAMA
 *   - Biomas IBGE (para referência de marco legal)
 *   - CAR — Cadastro Ambiental Rural (SICAR)
 *
 * Estratégia:
 *   1. Camadas visuais via WMS (sem CORS — tiles de imagem)
 *   2. Verificação de interseção via API REST (WFS/GeoJSON)
 *   3. Cache local de resultados para evitar requisições repetidas
 *
 * Melhorias v3.4:
 *   - Cache por gleba com TTL de 30 min para checkCAR
 *   - Suporte a MultiPolygon no analyzeGlebaInCAR (via normalizarGeometriaCAR)
 *   - Campo uncoveredHa: hectares da gleba fora de qualquer CAR
 *   - Cobertura individual por imóvel (coverageIndividual)
 *   - Lógica multi-UF paralela corrigida e com logs detalhados
 *
 * Fontes:
 *   - ICMBio GEOSERVER: https://geoservices.icmbio.gov.br
 *   - IBAMA SIT:        https://siscom.ibama.gov.br
 *   - IBGE Biomas:      https://servicodados.ibge.gov.br
 *   - TerraBrasilis:    https://terrabrasilis.dpi.inpe.br
 *   - SICAR:            https://geoserver.car.gov.br
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn } from '../components/ui.js';

// ─── Constantes ────────────────────────────────────────────────────────────

const TIMEOUT = CONFIG.CONFORMIDADE.TIMEOUT_MS;

/** TTL do cache de CAR por gleba: 30 minutos em ms */
const CAR_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Cache de resultados do SICAR, por glebaId.
 * Estrutura: Map<glebaId, { ts: number, result: CARResult[] }>
 * Módulo-level: persiste entre verificações sem precisar tocar no state global.
 */
const _carCache = new Map();

/**
 * Categorias de UC: Proteção Integral (bloqueia crédito BACEN)
 * vs Uso Sustentável (permite crédito com condições).
 * Fonte: SNUC - Lei 9.985/2000
 */
const UC_PROTECAO_INTEGRAL = new Set([
  'Estação Ecológica', 'Reserva Biológica', 'Parque Nacional',
  'Parque Estadual', 'Parque Natural Municipal',
  'Monumento Natural', 'Refúgio de Vida Silvestre',
]);

const UC_USO_SUSTENTAVEL = new Set([
  'Área de Proteção Ambiental', 'Área de Relevante Interesse Ecológico',
  'Floresta Nacional', 'Floresta Estadual', 'Reserva Extrativista',
  'Reserva de Fauna', 'Reserva de Desenvolvimento Sustentável',
  'Reserva Particular do Patrimônio Natural',
]);

/** Biomas do Nordeste e sua regulação no BACEN/SICOR */
const BIOMA_REGULACAO = Object.freeze({
  'Caatinga': { reservaLegalPct: 20, marcoCorteLegal: null, bacenCritico: false },
  'Cerrado': { reservaLegalPct: 20, marcoCorteLegal: '2008-07-22', bacenCritico: true },
  'Mata Atlântica': { reservaLegalPct: 20, marcoCorteLegal: null, bacenCritico: true },
  'Amazônia': { reservaLegalPct: 80, marcoCorteLegal: '2008-07-22', bacenCritico: true },
});

/**
 * Mapa completo: primeiros 2 dígitos do código IBGE → sigla UF (minúsculas).
 * Os códigos IBGE de 7 dígitos seguem o padrão nacional — os 2 primeiros
 * identificam o estado de forma inequívoca (ex: "23" → Ceará).
 */
const IBGE_PREFIX_TO_UF = Object.freeze({
  '11': 'ro', '12': 'ac', '13': 'am', '14': 'rr', '15': 'pa', '16': 'ap', '17': 'to',
  '21': 'ma', '22': 'pi', '23': 'ce', '24': 'rn', '25': 'pb', '26': 'pe', '27': 'al',
  '28': 'se', '29': 'ba',
  '31': 'mg', '32': 'es', '33': 'rj', '35': 'sp',
  '41': 'pr', '42': 'sc', '43': 'rs',
  '50': 'ms', '51': 'mt', '52': 'go', '53': 'df',
});

// ─── WMS — Camadas Visuais ─────────────────────────────────────────────────

/**
 * Cria e retorna camada WMS das Unidades de Conservação (ICMBio).
 * A camada é VISUAL apenas — para intersection check usa-se checkUCIntersection().
 */
export function createUCLayer() {
  return L.tileLayer.wms(
    'https://geoservices.icmbio.gov.br/arcgis/services/portal/NGIT_UNIDADES_CONSERVACAO/MapServer/WMSServer',
    {
      layers: '0',
      format: 'image/png',
      transparent: true,
      opacity: 0.55,
      attribution: 'ICMBio — Unidades de Conservação',
      updateWhenIdle: true,
      updateWhenZooming: false,
    }
  );
}

/** Camada WMS IBAMA — Áreas Embargadas. */
export function createIBAMALayer() {
  return L.tileLayer.wms(
    'https://siscom.ibama.gov.br/geoserver/ows',
    {
      layers: 'ibama:embargo_ibama',
      format: 'image/png',
      transparent: true,
      opacity: 0.65,
      attribution: 'IBAMA — Áreas Embargadas',
      updateWhenIdle: true,
      updateWhenZooming: false,
    }
  );
}

/** Camada WMS Biomas IBGE. */
export function createBiomaLayer() {
  return L.tileLayer.wms(
    'https://apisidra.ibge.gov.br/wms/biomas',
    {
      layers: 'biomas',
      format: 'image/png',
      transparent: true,
      opacity: 0.30,
      attribution: 'IBGE — Biomas',
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
    }
  );
}

// ─── API — Verificação de Interseção ─────────────────────────────────────────

/**
 * Verifica se uma gleba intercepta Unidades de Conservação via API ICMBio.
 * @param {GlebaData} gleba
 * @returns {Promise<UCResult[]>}
 */
export async function checkUCIntersection(gleba) {
  const url = new URL(
    'https://geoservices.icmbio.gov.br/arcgis/rest/services/portal/NGIT_UNIDADES_CONSERVACAO/MapServer/0/query'
  );
  url.searchParams.set('geometry', JSON.stringify(gleba.turfPolygon.geometry));
  url.searchParams.set('geometryType', 'esriGeometryPolygon');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'NM_UC,CATEGORIA_UC,GRUPO_UC,DS_ESFERA,NO_ORGAO');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'geojson');

  try {
    const res = await fetchWithTimeout(url.toString(), TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return (data.features ?? []).map(f => ({
      nome: f.properties.NM_UC ?? '—',
      categoria: f.properties.CATEGORIA_UC ?? '—',
      grupo: f.properties.GRUPO_UC ?? '—',
      esfera: f.properties.DS_ESFERA ?? '—',
      protecaoIntegral: UC_PROTECAO_INTEGRAL.has(f.properties.CATEGORIA_UC ?? ''),
    }));
  } catch (e) {
    warn('UC API erro:', e.message);
    return [];
  }
}

/**
 * Verifica embargos IBAMA ativos para a área da gleba.
 * @param {GlebaData} gleba
 * @returns {Promise<EmbargoResult[]>}
 */
export async function checkEmbargoIBAMA(gleba) {
  const bbox = turf.bbox(gleba.turfPolygon);
  const url = new URL('https://ibama.gov.br/api/embargo/geometria');
  url.searchParams.set('xmin', bbox[0]);
  url.searchParams.set('ymin', bbox[1]);
  url.searchParams.set('xmax', bbox[2]);
  url.searchParams.set('ymax', bbox[3]);

  try {
    const res = await fetchWithTimeout(url.toString(), TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return (data.embargos ?? data.features ?? [])
      .filter(e => e.ativo !== false)
      .map(e => ({
        numAI: e.num_ai ?? e.properties?.num_ai ?? '—',
        cpfCnpj: e.cpf_cnpj ?? e.properties?.cpf_cnpj ?? '—',
        municipio: e.municipio ?? e.properties?.municipio ?? '—',
        bioma: e.bioma ?? e.properties?.bioma ?? '—',
        situacao: e.situacao ?? e.properties?.situacao ?? 'Ativo',
        dataEmissao: e.data_emissao ?? e.properties?.data_emissao ?? '—',
      }));
  } catch (e) {
    warn('IBAMA embargo API erro:', e.message);
    return [];
  }
}

/**
 * Identifica o bioma predominante da gleba via IBGE API.
 * @param {GlebaData} gleba
 * @returns {Promise<string|null>}
 */
export async function getBiomaGleba(gleba) {
  const [lon, lat] = gleba.centroid;
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/biomas?lat=${lat}&lng=${lon}`;

  try {
    const res = await fetchWithTimeout(url, TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.nome ?? data?.[0]?.nome ?? null;
  } catch (e) {
    warn('IBGE bioma API erro:', e.message);
    return inferBiomaByUF(gleba);
  }
}

/**
 * Verifica alertas de desmatamento (PRODES/DETER) via TerraBrasilis.
 * @param {GlebaData} gleba
 * @returns {Promise<DesmatamentoResult[]>}
 */
export async function checkDesmatamento(gleba) {
  const bbox = turf.bbox(gleba.turfPolygon);
  const url = new URL('https://terrabrasilis.dpi.inpe.br/app/api/v1/deforestation/alerts');
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('limit', '50');

  try {
    const res = await fetchWithTimeout(url.toString(), TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const alerts = data.results ?? data.features ?? [];
    const dentro = alerts.filter(a => {
      try {
        const pt = a.geometry ?? a.centroid;
        return pt && turf.booleanIntersects(gleba.turfPolygon, turf.feature(pt));
      } catch (_) { return false; }
    });

    return dentro.map(a => ({
      id: a.id ?? a.properties?.id ?? '—',
      data: a.data_deteccao ?? a.properties?.date ?? '—',
      areaHa: a.area_ha ?? a.properties?.area_ha ?? null,
      bioma: a.bioma ?? a.properties?.biome ?? '—',
      source: 'DETER/PRODES',
    }));
  } catch (e) {
    warn('TerraBrasilis API erro:', e.message);
    return [];
  }
}

// ─── Detecção de UF ────────────────────────────────────────────────────────

/**
 * Detecta a UF primária da gleba em ordem de confiabilidade:
 *  1. Código IBGE de 7 dígitos (CD_GEOCMU da SUDENE)
 *  2. Nome de município com sigla UF ao final (ex: "Fortaleza/CE")
 *  3. Bounding box do centroid (fallback geográfico)
 *
 * @param {GlebaData} gleba
 * @returns {string} Sigla UF em minúsculas (ex: 'ce')
 */
export function detectarUF(gleba) {

  // 1. Código IBGE puro (7 dígitos numéricos)
  if (Array.isArray(gleba.municipios)) {
    for (const mun of gleba.municipios) {
      if (!mun) continue;
      const str = String(mun).trim();
      if (/^\d{7}$/.test(str)) {
        const uf = IBGE_PREFIX_TO_UF[str.substring(0, 2)];
        if (uf) {
          log(`detectarUF: IBGE "${str}" → ${uf.toUpperCase()}`);
          return uf;
        }
      }
    }
  }

  // 2. Nome com sigla UF ao final (ex: "Fortaleza/CE" ou "Fortaleza - CE")
  if (Array.isArray(gleba.municipios)) {
    for (const mun of gleba.municipios) {
      if (!mun || typeof mun !== 'string') continue;
      const match = mun.trim().match(/[/\-\s]([A-Z]{2})$/);
      if (match) {
        const uf = match[1].toLowerCase();
        if (Object.values(IBGE_PREFIX_TO_UF).includes(uf)) return uf;
      }
    }
  }

  // 3. Bounding box do centroid para estados do Nordeste + PA/MA
  if (Array.isArray(gleba.centroid) && gleba.centroid.length === 2) {
    const [lng, lat] = gleba.centroid;
    if (lat > -7.87 && lat < -2.78 && lng > -41.36 && lng < -37.25) return 'ce';
    if (lat > -18.35 && lat < -8.53 && lng > -46.62 && lng < -37.34) return 'ba';
    if (lat > -10.25 && lat < -1.04 && lng > -48.75 && lng < -41.82) return 'ma';
    if (lat > -10.93 && lat < -2.74 && lng > -45.98 && lng < -40.37) return 'pi';
    if (lat > -9.48 && lat < -7.15 && lng > -41.36 && lng < -34.83) return 'pe';
    if (lat > -6.98 && lat < -4.83 && lng > -38.58 && lng < -34.97) return 'rn';
    if (lat > -8.32 && lat < -6.03 && lng > -38.81 && lng < -34.77) return 'pb';
    if (lat > -10.50 && lat < -8.81 && lng > -38.25 && lng < -35.13) return 'al';
    if (lat > -11.57 && lat < -9.52 && lng > -38.23 && lng < -36.37) return 'se';
  }

  warn('detectarUF: UF indeterminada — fallback "ce"');
  return 'ce';
}

/**
 * Detecta TODAS as UFs abrangidas pela gleba.
 * Essencial para glebas que cruzam fronteiras estaduais.
 *
 * @param {GlebaData} gleba
 * @returns {string[]} Array de siglas UF únicas em minúsculas, ex: ['ce', 'ba']
 */
export function detectarTodasUFs(gleba) {
  const ufs = new Set();

  if (Array.isArray(gleba.municipios)) {
    for (const mun of gleba.municipios) {
      const str = String(mun ?? '').trim();
      if (/^\d{7}$/.test(str)) {
        const uf = IBGE_PREFIX_TO_UF[str.substring(0, 2)];
        if (uf) ufs.add(uf);
      }
    }
  }

  // Fallback: usa detectarUF (que tem fallback por coordenadas)
  if (ufs.size === 0) ufs.add(detectarUF(gleba));

  return [...ufs];
}

// ─── CAR — Cadastro Ambiental Rural ────────────────────────────────────────

/**
 * Gera a chave de cache para uma gleba.
 * Usa glebaId se disponível; senão usa centroid arredondado.
 * @param {GlebaData} gleba
 * @returns {string}
 */
function _carCacheKey(gleba) {
  if (gleba.glebaId != null) return `car_g${gleba.glebaId}`;
  const [lon, lat] = gleba.centroid ?? [0, 0];
  return `car_${lon.toFixed(5)}_${lat.toFixed(5)}`;
}

/**
 * Verifica se a gleba possui CAR registrado via WFS do SICAR.
 *
 * Estratégia:
 *   1. Verifica cache com TTL de 30 min → retorna imediatamente se válido
 *   2. Detecta todas as UFs da gleba (suporte a glebas multi-estado)
 *   3. Consulta o SICAR em paralelo para cada UF via Promise.allSettled
 *   4. Consolida os resultados e armazena em cache
 *
 * @param {GlebaData} gleba
 * @returns {Promise<CARResult[]>}
 */
export async function checkCAR(gleba) {
  // ── 1. Cache com TTL ───────────────────────────────────────────────────
  const cacheKey = _carCacheKey(gleba);
  const cached = _carCache.get(cacheKey);

  if (cached && (Date.now() - cached.ts) < CAR_CACHE_TTL_MS) {
    const idadeMin = Math.round((Date.now() - cached.ts) / 60000);
    log(`CAR cache hit — Gleba ${gleba.glebaId ?? '?'} (${idadeMin} min atrás, `
      + `${cached.result.length} imóvel(is))`);
    return cached.result;
  }

  // ── 2. Detecta todas as UFs (suporte multi-estado) ────────────────────
  const ufs = detectarTodasUFs(gleba);
  log(`SICAR: consultando UF(s) ${ufs.map(u => u.toUpperCase()).join(', ')} `
    + `para Gleba ${gleba.glebaId ?? '?'}...`);

  // ── 3. Consultas paralelas por UF ─────────────────────────────────────
  const resultados = await Promise.allSettled(
    ufs.map(uf => checkCARporUF(gleba, uf))
  );

  const todos = resultados.flatMap(r => {
    if (r.status === 'fulfilled') return r.value;
    warn('SICAR: consulta falhou para uma UF:', r.reason?.message ?? r.reason);
    return [];
  });

  log(`SICAR: ${todos.length} imóvel(is) consolidado(s) no total `
    + `(${ufs.length} UF(s) consultada(s))`);

  // ── 4. Armazena em cache ───────────────────────────────────────────────
  _carCache.set(cacheKey, { ts: Date.now(), result: todos });

  return todos;
}

/**
 * Invalida o cache CAR de uma gleba específica ou de todas.
 * Útil quando o usuário edita a gleba manualmente.
 *
 * @param {number|null} glebaId  - Se null, limpa todo o cache CAR
 */
export function invalidarCacheCAR(glebaId = null) {
  if (glebaId == null) {
    _carCache.clear();
    log('Cache CAR invalidado (todas as glebas).');
  } else {
    _carCache.delete(`car_g${glebaId}`);
    log(`Cache CAR invalidado — Gleba ${glebaId}.`);
  }
}

/**
 * Consulta o SICAR para uma UF específica via WFS.
 * Usa CQL_FILTER com INTERSECTS para precisão espacial no servidor.
 *
 * @param {GlebaData} gleba
 * @param {string}    uf     - Sigla em minúsculas, ex: 'ce'
 * @returns {Promise<CARResult[]>}
 */
async function checkCARporUF(gleba, uf) {
  log(`SICAR: consultando sicar:sicar_imoveis_${uf}...`);

  // Extrai anel externo do polígono da gleba
  let coords = gleba.turfPolygon?.geometry?.coordinates;
  if (!coords) return [];

  if (gleba.turfPolygon.geometry.type === 'MultiPolygon') {
    coords = coords[0][0];
  } else {
    coords = coords[0];
  }

  // Garante fechamento do anel
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords = [...coords, first];
  }

  // WKT: "lon lat,lon lat,..."
  const polygonStr = coords.map(c => `${c[0]} ${c[1]}`).join(',');

  const url = new URL('https://geoserver.car.gov.br/geoserver/sicar/ows');
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '1.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeName', `sicar:sicar_imoveis_${uf}`);
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('CQL_FILTER', `INTERSECTS(geo_area_imovel, POLYGON((${polygonStr})))`);
  url.searchParams.set('srsName', 'EPSG:4674');

  try {
    const res = await fetchWithTimeout(url.toString(), 20000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';

    // ── Resposta JSON ──────────────────────────────────────────────────
    if (contentType.includes('json')) {
      const data = await res.json();
      const features = data.features ?? [];
      log(`SICAR ${uf.toUpperCase()}: ${features.length} imóvel(is) localizado(s)`);

      return features.map(f => ({
        codigo: f.properties.cod_imovel ?? f.id,
        municipio: f.properties.nom_mun ?? f.properties.municipio ?? '—',
        status: f.properties.ind_status ?? f.properties.status_imovel ?? 'Ativo',
        areaHa: f.properties.num_area ?? f.properties.area ?? 0,
        geometry: f.geometry,
      }));
    }

    // ── Resposta XML/GML (fallback) ───────────────────────────────────
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    let features = xml.getElementsByTagName('gml:featureMember');
    if (features.length === 0) features = xml.getElementsByTagName('wfs:member');
    if (features.length === 0) return [];

    log(`SICAR ${uf.toUpperCase()}: ${features.length} imóvel(is) via XML/GML`);

    const results = [];
    for (let i = 0; i < features.length; i++) {
      const props = features[i].firstElementChild;
      if (!props) continue;

      const getVal = (...tags) => {
        for (const t of tags) {
          const el = props.getElementsByTagNameNS('*', t)[0];
          if (el?.textContent) return el.textContent.trim();
        }
        return null;
      };

      const rawStatus = getVal('status_imovel', 'ind_status', 'status');
      const statusMap = { AT: 'Ativo', PE: 'Pendente', CA: 'Cancelado', SU: 'Suspenso' };

      results.push({
        codigo: getVal('cod_imovel') ?? '—',
        municipio: getVal('municipio', 'nom_mun') ?? '—',
        status: statusMap[rawStatus] ?? rawStatus ?? 'Ativo',
        areaHa: parseFloat(getVal('area', 'num_area') ?? '0'),
        geometry: null, // XML não retorna geometria parseável facilmente
      });
    }
    return results;

  } catch (e) {
    warn(`SICAR (${uf.toUpperCase()}) erro:`, e.message);
    return [];
  }
}

// ─── Análise Espacial do CAR ───────────────────────────────────────────────

/**
 * Normaliza qualquer geometria GeoJSON (Polygon ou MultiPolygon) em um único
 * Feature Turf compatível com todas as operações espaciais.
 *
 * Para MultiPolygon: une todos os polígonos internos em um único Feature.
 * Isso evita falhas silenciosas em turf.intersect / turf.union com MultiPolygon.
 *
 * @param {object} geometry  - GeoJSON geometry object
 * @returns {Feature|null}
 */
function normalizarGeometriaCAR(geometry) {
  if (!geometry) return null;
  try {
    if (geometry.type === 'Polygon') {
      return turf.feature(geometry);
    }

    if (geometry.type === 'MultiPolygon') {
      // Achata em Polygons individuais via turf.flatten
      const colecao = turf.flatten(turf.feature(geometry));
      if (colecao.features.length === 0) return null;
      if (colecao.features.length === 1) return colecao.features[0];

      // Une todos os polígonos do MultiPolygon em um único Feature
      return colecao.features.reduce((acc, feat) => {
        try {
          return turf.union(acc, feat) ?? acc;
        } catch (_) {
          return acc; // polígono inválido — ignora
        }
      });
    }

    warn('normalizarGeometriaCAR: tipo de geometria não suportado:', geometry.type);
    return null;
  } catch (e) {
    warn('normalizarGeometriaCAR erro:', e.message);
    return null;
  }
}

/**
 * Analisa a relação espacial entre a gleba e os imóveis do CAR encontrados.
 *
 * Regra de negócio (Res. CMN 5.081/2023):
 *   Uma gleba de crédito rural deve estar contida em UM único imóvel rural.
 *   Múltiplos CARs — mesmo com cobertura total de 100% — indicam que a gleba
 *   cruza fronteiras de propriedades, gerando alerta obrigatório.
 *
 * Suporte a MultiPolygon via normalizarGeometriaCAR().
 *
 * Campos retornados:
 *   status             — 'ok' | 'alerta' | 'bloqueio' | 'info'
 *   mensagem           — texto descritivo
 *   dados              — array de CARResult com campo coverageIndividual adicionado
 *   coverage           — % da gleba coberta pela UNIÃO de todos os CARs (0–100)
 *   coverageMelhorCAR  — % coberta pelo melhor CAR individual (0–100)
 *   uncoveredHa        — hectares da gleba fora de qualquer CAR
 *   carAreaHa          — soma das áreas dos CARs detectados (ha)
 *   nCARs              — número de imóveis CAR detectados
 *
 * @param {GlebaData}   gleba
 * @param {CARResult[]} carFeatures  - Array retornado por checkCAR()
 * @returns {object}
 */
export function analyzeGlebaInCAR(gleba, carFeatures) {

  // ── 0. Nenhum CAR encontrado ───────────────────────────────────────────
  if (!carFeatures || carFeatures.length === 0) {
    return {
      status: 'bloqueio',
      mensagem: 'Nenhum Cadastro Ambiental Rural (CAR) localizado para esta geometria. '
        + 'O CAR é obrigatório para concessão de crédito rural (Cód. Florestal Art. 29).',
      dados: [],
      coverage: 0,
      coverageMelhorCAR: 0,
      uncoveredHa: turf.area(gleba.turfPolygon) / 10000,
      carAreaHa: 0,
      nCARs: 0,
    };
  }

  const glebaPoly = gleba.turfPolygon;
  const glebaAreaM2 = turf.area(glebaPoly);
  const glebaAreaHa = glebaAreaM2 / 10000;

  // Normaliza geometrias: converte cada CAR para Feature compatível com Turf
  const featuresNormalizadas = carFeatures.map(car => ({
    ...car,
    _featNorm: car.geometry ? normalizarGeometriaCAR(car.geometry) : null,
  }));

  const featuresComGeo = featuresNormalizadas.filter(f => f._featNorm !== null);

  // ── 1. Sem geometria (fallback XML sem coordenadas) ───────────────────
  if (featuresComGeo.length === 0) {
    const maisDeUm = carFeatures.length > 1;
    log(`analyzeGlebaInCAR: sem geometria — análise simplificada (${carFeatures.length} CAR(s))`);
    return {
      status: maisDeUm ? 'alerta' : 'ok',
      mensagem: maisDeUm
        ? `Gleba abrange ${carFeatures.length} imóveis CAR: `
        + `${carFeatures.map(c => c.codigo).join(', ')}. `
        + `Verificar limites entre propriedades. (geometria indisponível — análise aproximada)`
        : `Imóvel Rural localizado: ${carFeatures[0].codigo}. `
        + `(Geometria não retornada pelo servidor — análise simplificada)`,
      dados: carFeatures,
      coverage: 100,
      coverageMelhorCAR: 100,
      uncoveredHa: 0,
      carAreaHa: carFeatures.reduce((s, c) => s + (c.areaHa || 0), 0),
      nCARs: carFeatures.length,
    };
  }

  try {
    // ── 2. Cobertura INDIVIDUAL de cada CAR sobre a gleba ─────────────
    //
    // Métrica central: quanto da gleba está dentro de CADA imóvel separadamente.
    // Ordenamos do maior para menor para identificar o "melhor match".
    //
    const analiseIndividual = featuresComGeo.map(car => {
      try {
        const intersecao = turf.intersect(glebaPoly, car._featNorm);
        const areaIntersM2 = intersecao ? turf.area(intersecao) : 0;
        const covRaw = (areaIntersM2 / glebaAreaM2) * 100;
        const cov = covRaw > 99.9 ? 100 : Math.round(covRaw * 10) / 10;
        return { ...car, _featNorm: undefined, coverageIndividual: cov };
      } catch (err) {
        warn(`analyzeGlebaInCAR: erro ao analisar CAR ${car.codigo}:`, err.message);
        return { ...car, _featNorm: undefined, coverageIndividual: 0 };
      }
    });

    // Adiciona CARs sem geometria ao final (com coverageIndividual: 0)
    const semGeo = featuresNormalizadas
      .filter(f => f._featNorm === null)
      .map(car => ({ ...car, _featNorm: undefined, coverageIndividual: 0 }));

    const todosComAnalise = [...analiseIndividual, ...semGeo];
    todosComAnalise.sort((a, b) => b.coverageIndividual - a.coverageIndividual);

    const melhorCAR = todosComAnalise[0];
    const nCARs = todosComAnalise.length;

    // ── 3. Cobertura TOTAL (união) ─────────────────────────────────────
    //
    // Usada apenas para detectar se há área da gleba completamente descoberta.
    // NÃO é usada como critério de conformidade (ver Regras de Negócio abaixo).
    //
    let carUnion = featuresComGeo[0]._featNorm;
    for (let i = 1; i < featuresComGeo.length; i++) {
      try {
        const u = turf.union(carUnion, featuresComGeo[i]._featNorm);
        if (u) carUnion = u;
      } catch (_) { /* geometria inválida — ignora */ }
    }

    const intersTotal = turf.intersect(glebaPoly, carUnion);
    const covTotalRaw = intersTotal ? (turf.area(intersTotal) / glebaAreaM2) * 100 : 0;
    const coverageTotal = covTotalRaw > 99.9 ? 100 : Math.round(covTotalRaw * 10) / 10;

    // Hectares descobertos = área da gleba fora de QUALQUER CAR
    const uncoveredHa = Math.max(0, glebaAreaHa * (1 - coverageTotal / 100));

    log(`analyzeGlebaInCAR: ${nCARs} CAR(s) | cobertura total ${coverageTotal}% | `
      + `melhor individual ${melhorCAR.coverageIndividual}% | `
      + `descoberto ${uncoveredHa.toFixed(2)} ha`);

    // ── 4. Regras de negócio ───────────────────────────────────────────
    //
    // Uma gleba de crédito rural deve estar contida em UM único imóvel rural.
    // Cruzar fronteiras de propriedades é ressalva independente da cobertura.
    //
    let status, mensagem;
    const listaCAR = todosComAnalise
      .map(c => `${c.codigo}${c.coverageIndividual > 0 ? ` (${c.coverageIndividual}%)` : ''}`)
      .join(', ');

    if (nCARs === 1) {
      // ── Caso simples: apenas um imóvel ──────────────────────────────
      const cov = melhorCAR.coverageIndividual;
      if (cov >= 98) {
        status = 'ok';
        mensagem = `Gleba em conformidade com o CAR ${melhorCAR.codigo} `
          + `(${melhorCAR.municipio} · Cobertura: ${cov}%).`;
      } else if (cov >= 10) {
        status = 'alerta';
        mensagem = `Gleba parcialmente fora do CAR ${melhorCAR.codigo}. `
          + `Cobertura: ${cov}% — ${uncoveredHa.toFixed(2)} ha da gleba estão `
          + `fora do imóvel registrado. Verificar delimitação.`;
      } else {
        status = 'bloqueio';
        mensagem = `Gleba com baixa cobertura no CAR ${melhorCAR.codigo} (${cov}%). `
          + `${uncoveredHa.toFixed(2)} ha (${(100 - cov).toFixed(1)}%) fora do imóvel. `
          + `O CAR localizado não abrange a área da gleba pretendida.`;
      }

    } else {
      // ── Múltiplos imóveis ─────────────────────────────────────────
      const adjacentes = todosComAnalise.slice(1).map(c => c.codigo).join(', ');

      if (melhorCAR.coverageIndividual >= 98) {
        // Um único CAR já contém a gleba; os demais são apenas adjacentes/sobrepostos
        status = 'alerta';
        mensagem = `Gleba contida no CAR ${melhorCAR.codigo} (${melhorCAR.coverageIndividual}%), `
          + `porém ${nCARs - 1} imóvel(is) adjacente(s) interceptam a área: ${adjacentes}. `
          + `Confirme que a operação de crédito se refere exclusivamente ao imóvel ${melhorCAR.codigo}.`;

      } else if (coverageTotal >= 98) {
        // Gleba só é coberta quando somados 2+ imóveis — cruza fronteiras de propriedades
        status = 'alerta';
        mensagem = `Gleba dividida entre ${nCARs} imóveis distintos do CAR `
          + `(cobertura total: ${coverageTotal}% · melhor imóvel individual: `
          + `${melhorCAR.coverageIndividual}%). `
          + `Para crédito rural, a gleba deve estar contida em um único imóvel. `
          + `CARs: ${listaCAR}.`;

      } else {
        // Nem a união cobre adequadamente — área descoberta real
        status = 'bloqueio';
        mensagem = `Gleba parcialmente fora dos ${nCARs} CARs detectados. `
          + `Cobertura total: ${coverageTotal}% — `
          + `${uncoveredHa.toFixed(2)} ha (${(100 - coverageTotal).toFixed(1)}%) descobertos. `
          + `CARs: ${listaCAR}.`;
      }
    }

    return {
      status,
      mensagem,
      dados: todosComAnalise,   // cada item tem coverageIndividual
      coverage: coverageTotal,
      coverageMelhorCAR: melhorCAR.coverageIndividual,
      uncoveredHa: parseFloat(uncoveredHa.toFixed(4)),
      carAreaHa: todosComAnalise.reduce((s, f) => s + (f.areaHa || 0), 0),
      nCARs,
    };

  } catch (e) {
    warn('analyzeGlebaInCAR: erro inesperado na análise espacial:', e.message);
    return {
      status: 'info',
      mensagem: `CAR localizado: ${carFeatures[0].codigo}. `
        + `Erro no cálculo espacial — verifique manualmente em car.gov.br.`,
      dados: carFeatures,
      coverage: 0,
      coverageMelhorCAR: 0,
      uncoveredHa: glebaAreaHa,
      carAreaHa: carFeatures.reduce((s, f) => s + (f.areaHa || 0), 0),
      nCARs: carFeatures.length,
    };
  }
}

// ─── Utilitários internos ──────────────────────────────────────────────────

/**
 * Fetch com timeout configurável e proxy CORS.
 * @param {string} url
 * @param {number} ms
 */
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);

  const proxiedUrl = CONFIG.PROXY_URL + encodeURIComponent(url);

  try {
    return await fetch(proxiedUrl, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json, application/xml, text/xml' },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      warn(`Timeout (${ms}ms):`, url);
    } else {
      warn('Erro via proxy:', err.message);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fallback: infere bioma predominante pela UF.
 * Usado quando a API IBGE não responde.
 * @param {GlebaData} gleba
 * @returns {string}
 */
function inferBiomaByUF(gleba) {
  const ufBioma = {
    ma: 'Cerrado', pi: 'Caatinga', ce: 'Caatinga', rn: 'Caatinga',
    pb: 'Caatinga', pe: 'Caatinga', al: 'Mata Atlântica',
    se: 'Mata Atlântica', ba: 'Caatinga',
  };
  return ufBioma[detectarUF(gleba)] ?? 'Caatinga';
}

export { UC_PROTECAO_INTEGRAL, UC_USO_SUSTENTAVEL, BIOMA_REGULACAO };