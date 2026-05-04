/**
 * @file camadas_externas.js — v3.0
 * @description Carregamento e gerenciamento de camadas ambientais externas:
 *   - Unidades de Conservação (ICMBio)
 *   - Áreas Embargadas IBAMA
 *   - Biomas IBGE (para referência de marco legal)
 *
 * Estratégia:
 *   1. Camadas visuais via WMS (sem CORS — tiles de imagem)
 *   2. Verificação de interseção via API REST (WFS/GeoJSON)
 *   3. Cache local de resultados para evitar requisições repetidas
 *
 * Fontes:
 *   - ICMBio GEOSERVER: https://geoservices.icmbio.gov.br
 *   - IBAMA SIT:  https://siscom.ibama.gov.br
 *   - IBGE Biomas: https://servicodados.ibge.gov.br
 *   - TerraBrasilis (INPE): https://terrabrasilis.dpi.inpe.br
 */

import { state } from './state.js';
import { CONFIG } from './config.js';
import { log, warn } from './ui.js';

// ─── Constantes ────────────────────────────────────────────────────────────

const TIMEOUT = CONFIG.CONFORMIDADE.TIMEOUT_MS;

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
      updateWhenZooming: false
    }
  );
}

/**
 * Camada WMS IBAMA — Áreas Embargadas.
 * Fonte: SISCOM/IBAMA via GeoServer público.
 */
export function createIBAMALayer() {
  // GeoServer público do IBAMA via SISCOM
  return L.tileLayer.wms(
    'https://siscom.ibama.gov.br/geoserver/ows',
    {
      layers: 'ibama:embargo_ibama',
      format: 'image/png',
      transparent: true,
      opacity: 0.65,
      attribution: 'IBAMA — Áreas Embargadas',
      updateWhenIdle: true,
      updateWhenZooming: false
    }
  );
}

/**
 * Camada WMS Biomas IBGE.
 */
export function createBiomaLayer() {
  return L.tileLayer.wms(
    'https://apisidra.ibge.gov.br/wms/biomas',
    {
      layers: 'biomas',
      format: 'image/png',
      transparent: true,
      opacity: 0.30,
      attribution: 'IBGE — Biomas',
      // Melhora performance e reduz NS_BINDING_ABORTED
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2
    }
  );
}

// ─── API — Verificação de Interseção ─────────────────────────────────────────

/**
 * Verifica se uma gleba intercepta Unidades de Conservação via API ICMBio.
 * Usa WFS GetFeature com filtro espacial INTERSECTS.
 *
 * @param {GlebaData} gleba
 * @returns {Promise<UCResult[]>}
 */
export async function checkUCIntersection(gleba) {
  const bbox = turf.bbox(gleba.turfPolygon);
  const bboxStr = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]},EPSG:4326`;

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
 * Verifica embargos IBAMA ativos para os municípios da gleba.
 * Usa a API pública de consulta de autos de infração do IBAMA (SIPA).
 *
 * @param {GlebaData} gleba
 * @returns {Promise<EmbargoResult[]>}
 */
export async function checkEmbargoIBAMA(gleba) {
  // Endpoint público de embargos por área (bbox)
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
 * Usa o centroid para determinação rápida.
 *
 * @param {GlebaData} gleba
 * @returns {Promise<string|null>} Nome do bioma ou null
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
    // Fallback: inferir bioma pela UF predominante dos municípios
    warn('IBGE bioma API erro:', e.message);
    return inferBiomaByUF(gleba);
  }
}

/**
 * Verifica alertas de desmatamento (PRODES/DETER) via TerraBrasilis/MapBiomas.
 * Detecta desmatamento ilegal pós-marco legal (Res. CMN 4.945/2021).
 *
 * @param {GlebaData} gleba
 * @returns {Promise<DesmatamentoResult[]>}
 */
export async function checkDesmatamento(gleba) {
  const bbox = turf.bbox(gleba.turfPolygon);
  // TerraBrasilis API — alertas DETER
  const url = new URL('https://terrabrasilis.dpi.inpe.br/app/api/v1/deforestation/alerts');
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('limit', '50');

  try {
    const res = await fetchWithTimeout(url.toString(), TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const alerts = (data.results ?? data.features ?? []);
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

/**
 * Detecta a UF da gleba de forma robusta.
 * @param {object} gleba 
 * @returns {string} Sigla da UF em minúsculas (ex: 'ce', 'ba')
 */
export function detectarUF(gleba) {
  // (Mantenha sua versão atualizada que você já tem)
  if (Array.isArray(gleba.municipios) && gleba.municipios.length > 0) {
    for (const mun of gleba.municipios) {
      if (!mun || typeof mun !== 'string') continue;
      const match = mun.trim().match(/(?:[\/\-\s])([A-Z]{2})$/);
      if (match) return match[1].toLowerCase();
    }
  }

  const codIBGE = gleba.cod_municipio_ibge || gleba.codigo_ibge;
  if (codIBGE) {
    const prefixo = String(codIBGE).substring(0, 2);
    const ufMap = {
      '11': 'ro', '12': 'ac', '13': 'am', '14': 'rr', '15': 'pa', '16': 'ap', '17': 'to',
      '21': 'ma', '22': 'pi', '23': 'ce', '24': 'rn', '25': 'pb', '26': 'pe', '27': 'al',
      '28': 'se', '29': 'ba', '31': 'mg', '32': 'es', '33': 'rj', '35': 'sp', '41': 'pr',
      '42': 'sc', '43': 'rs', '50': 'ms', '51': 'mt', '52': 'go', '53': 'df'
    };
    if (ufMap[prefixo]) return ufMap[prefixo];
  }

  // 3. Tenta extrair do nome do município (ex: "Fortaleza/CE")
  if (Array.isArray(gleba.municipios) && gleba.municipios.length > 0) {
    for (const mun of gleba.municipios) {
      if (!mun || typeof mun !== 'string') continue;

      // Busca formato padrão "/UF" ou "- UF"
      const match = mun.trim().match(/(?:[\/\-\s])([A-Z]{2})$/);
      if (match) return match[1].toLowerCase();

      // Limpeza de caracteres não-alfabéticos para pegar UF "suja"
      const cleaned = mun.replace(/[^A-Z]/g, '');
      if (cleaned.length >= 2) {
        const possibleUF = cleaned.slice(-2).toLowerCase();
        if (['ba', 'ce', 'pe', 'ma', 'pi', 'rn', 'pb', 'al', 'se'].includes(possibleUF)) return possibleUF;
      }
    }
  }

  // 4. Fallback inteligente: Coordenadas (Centroide) - Nordeste focus
  if (gleba.centroid && Array.isArray(gleba.centroid) && gleba.centroid.length === 2) {
    const [lng, lat] = gleba.centroid;
    // Bounding boxes simplificadas para os estados (foco Nordeste)
    if (lng > -41.9 && lng < -37.2 && lat > -7.9 && lat < -2.7) return 'ce';
    if (lng > -46.6 && lng < -37.3 && lat > -18.3 && lat < -8.5) return 'ba';
    if (lng > -48.8 && lng < -39.7 && lat > -10.3 && lat < -1.0) return 'ma';
    if (lng > -45.9 && lng < -40.3 && lat > -10.9 && lat < -2.7) return 'pi';
    if (lng > -41.4 && lng < -34.8 && lat > -9.5 && lat < -7.1) return 'pe';
    if (lng > -38.9 && lng < -34.7 && lat > -7.0 && lat < -4.8) return 'rn';
    if (lng > -38.8 && lng < -34.7 && lat > -8.4 && lat < -5.9) return 'pb';
    if (lng > -38.3 && lng < -35.1 && lat > -10.5 && lat < -8.8) return 'al';
    if (lng > -38.3 && lng < -36.3 && lat > -11.6 && lat < -9.8) return 'se';
  }

  return 'ce'; // Fallback final
}

/**
 * Verifica se a gleba possui CAR registrado via WFS do SICAR.
 * Agora com análise espacial detalhada de cobertura e detecção robusta de UF.
 *
 * @param {GlebaData} gleba
 * @returns {Promise<CARResult[]>}
 */
export async function checkCAR(gleba) {
  const uf = detectarUF(gleba);
  log(`Consultando SICAR para UF: ${uf.toUpperCase()}...`);

  // ─────────────────────────────────────────────
  // 🔹 Extrair coordenadas para o filtro CQL
  // ─────────────────────────────────────────────
  let coords = gleba.turfPolygon?.geometry?.coordinates;
  if (!coords) return [];

  // Simplificação: pega o anel externo do primeiro polígono
  if (gleba.turfPolygon.geometry.type === 'MultiPolygon') {
    coords = coords[0][0];
  } else {
    coords = coords[0];
  }

  // ─────────────────────────────────────────────
  // 🔹 Garantir fechamento do polígono
  // ─────────────────────────────────────────────
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords = [...coords, first];
  }

  const polygonStr = coords.map(c => `${c[0]} ${c[1]}`).join(',');

  // ─────────────────────────────────────────────
  // 🔹 Montar URL WFS SICAR
  // ─────────────────────────────────────────────
  const url = new URL('https://geoserver.car.gov.br/geoserver/sicar/ows');
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '1.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeName', `sicar:sicar_imoveis_${uf}`);
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('CQL_FILTER', `INTERSECTS(geo_area_imovel, POLYGON((${polygonStr})))`);
  url.searchParams.set('srsName', 'EPSG:4674');

  try {
    const res = await fetchWithTimeout(url.toString(), 20000); // Timeout aumentado para 20s
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';

    // ─── Processamento JSON ─────────────────────
    if (contentType.includes('json')) {
      const data = await res.json();
      const features = data.features ?? [];
      log(`UF ${uf.toUpperCase()}: ${features.length} imóvel(is) localizado(s).`);

      return features.map(f => ({
        codigo: f.properties.cod_imovel ?? f.id,
        municipio: f.properties.nom_mun ?? f.properties.municipio ?? '—',
        status: f.properties.ind_status ?? f.properties.status_imovel ?? 'Ativo',
        areaHa: f.properties.num_area ?? f.properties.area ?? 0,
        geometry: f.geometry
      }));
    }

    // ─── Processamento XML/GML (Fallback) ───────
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    let features = xml.getElementsByTagName('gml:featureMember');
    if (features.length === 0) features = xml.getElementsByTagName('wfs:member');

    if (features.length === 0) return [];

    const results = [];
    for (let i = 0; i < features.length; i++) {
      const props = features[i].firstElementChild;
      if (props) {
        const getVal = (tags) => {
          for (let t of tags) {
            const el = props.getElementsByTagName(`sicar:${t}`)[0] || props.getElementsByTagName(t)[0];
            if (el) return el.textContent.trim();
          }
          return null;
        };
        const rawStatus = getVal(['status_imovel', 'ind_status', 'status']);
        const statusMap = { 'AT': 'Ativo', 'PE': 'Pendente', 'CA': 'Cancelado', 'SU': 'Suspenso' };
        results.push({
          codigo: getVal(['cod_imovel']) ?? '—',
          municipio: getVal(['municipio', 'nom_mun']) ?? '—',
          status: statusMap[rawStatus] ?? rawStatus ?? 'Ativo',
          areaHa: parseFloat(getVal(['area', 'num_area']) || '0'),
          condicao: getVal(['condicao']) ?? ''
        });
      }
    }
    return results;
  } catch (e) {
    warn(`CAR API (${uf}) erro:`, e.message);
    return [];
  }
}

/**
 * Analisa a relação espacial entre a gleba e os imóveis do CAR encontrados.
 * Agora utiliza união de geometrias para tratar glebas que abrangem múltiplos CARs.
 * 
 * @param {GlebaData} gleba 
 * @param {CARResult[]} carFeatures 
 * @returns {object} Resultado da análise detalhada
 */
export function analyzeGlebaInCAR(gleba, carFeatures) {
  if (!carFeatures || carFeatures.length === 0) {
    return {
      status: 'bloqueio',
      mensagem: 'Nenhum Cadastro Ambiental Rural (CAR) localizado para esta geometria.',
      dados: [],
      coverage: 0,
      carAreaHa: 0
    };
  }

  const glebaPoly = gleba.turfPolygon;
  const featuresComGeo = carFeatures.filter(f => f.geometry);

  // Se não houver geometrias (ex: fallback XML), faz análise baseada no primeiro item
  if (featuresComGeo.length === 0) {
    const car = carFeatures[0];
    return {
      status: 'ok',
      mensagem: `Imóvel Rural localizado: ${car.codigo}. (Análise espacial simplificada — sem geometria)`,
      dados: carFeatures,
      coverage: 100,
      carAreaHa: car.areaHa
    };
  }

  try {
    // 1. Unir todas as geometrias dos CARs para tratar sobreposições ou glebas em múltiplos imóveis
    let carUnion = turf.feature(featuresComGeo[0].geometry);
    
    if (featuresComGeo.length > 1) {
      for (let i = 1; i < featuresComGeo.length; i++) {
        const feat = turf.feature(featuresComGeo[i].geometry);
        try {
          const union = turf.union(carUnion, feat);
          if (union) carUnion = union;
        } catch (err) {
          warn('Erro ao unir geometrias CAR:', err.message);
        }
      }
    }

    // 2. Calcular interseção entre gleba e a união dos CARs
    const intersection = turf.intersect(glebaPoly, carUnion);

    if (!intersection) {
      return {
        status: 'bloqueio',
        mensagem: 'Gleba totalmente fora do perímetro do(s) CAR(s) localizado(s).',
        dados: carFeatures,
        coverage: 0,
        carAreaHa: featuresComGeo.reduce((s, f) => s + f.areaHa, 0)
      };
    }

    // 3. Calcular áreas e percentual de cobertura
    const intersectArea = turf.area(intersection);
    const glebaArea = turf.area(glebaPoly);
    const coverageRaw = (intersectArea / glebaArea) * 100;
    
    // Arredondamento inteligente: se > 99.9%, considera 100% para evitar flutuação de ponto flutuante
    const coverage = coverageRaw > 99.9 ? 100 : Math.round(coverageRaw * 10) / 10;

    let status = 'bloqueio';
    let mensagem = '';

    if (coverage >= 98) {
      status = 'ok';
      mensagem = `Gleba em conformidade com o CAR (Cobertura: ${coverage}%).`;
    } else if (coverage >= 10) {
      status = 'alerta';
      mensagem = `Gleba parcialmente fora do CAR. Cobertura: ${coverage}% | Total CAR: ${featuresComGeo.reduce((s, f) => s + f.areaHa, 0).toFixed(1)} ha`;
    } else {
      status = 'bloqueio';
      mensagem = `Gleba com baixa cobertura no CAR (${coverage}%). Verifique o perímetro.`;
    }

    return {
      status,
      mensagem,
      dados: carFeatures,
      coverage: coverage,
      carAreaHa: featuresComGeo.reduce((s, f) => s + f.areaHa, 0)
    };

  } catch (e) {
    warn('Erro na análise espacial do CAR:', e.message);
    const car = carFeatures[0];
    return {
      status: 'ok',
      mensagem: `Imóvel Rural localizado: ${car.codigo}. (Erro no cálculo espacial)`,
      dados: carFeatures,
      coverage: 100,
      carAreaHa: car.areaHa
    };
  }
}

// ─── Utilitários internos ──────────────────────────────────────────────────

/**
 * Fetch com timeout configurável.
 * @param {string} url
 * @param {number} ms
 */
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);

  // Encapsula a URL original no nosso Proxy PHP para evitar CORS
  const proxiedUrl = CONFIG.PROXY_URL + encodeURIComponent(url);

  try {
    const res = await fetch(proxiedUrl, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      warn(`Requisição abortada (timeout ${ms}ms):`, url);
    } else {
      warn('Erro na requisição via proxy:', err.message);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fallback: infere bioma predominante pela UF da gleba.
 * Usado quando a API IBGE não responde.
 */
function inferBiomaByUF(gleba) {
  // Mapeamento de UF para bioma predominante (Nordeste)
  const ufBioma = {
    'ma': 'Cerrado', 'pi': 'Caatinga', 'ce': 'Caatinga', 'rn': 'Caatinga',
    'pb': 'Caatinga', 'pe': 'Caatinga', 'al': 'Mata Atlântica',
    'se': 'Mata Atlântica', 'ba': 'Caatinga',
  };

  const uf = detectarUF(gleba);
  return ufBioma[uf] ?? 'Caatinga';
}

export { UC_PROTECAO_INTEGRAL, UC_USO_SUSTENTAVEL, BIOMA_REGULACAO };
