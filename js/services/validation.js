/**
 * @file validation.js
 * @description Validação pura de coordenadas de glebas (zero manipulação de DOM).
 *
 * Critérios BACEN/INCRA:
 *  1. Polígono fechado (primeiro == último ponto)
 *  2. Sem pontos consecutivos iguais
 *  3. Mínimo de 4 pontos
 *  4. Máximo de 4 municípios abrangidos
 *  5. Sem autointerseção (turf.kinks)
 *  6. Dentro dos limites geográficos do Nordeste
 *
 * Retorno padronizado:
 *   { valid: boolean, errors: string[], data: GlebaData[], fromCache: boolean }
 */

import { CONFIG } from '../utils/config.js';
import { state }  from '../utils/state.js';
import { log }    from '../components/ui.js';

const { NORDESTE, MIN_POINTS, MAX_MUNICIPIOS } = CONFIG.VALIDATION;

// ─── Hash djb2 para chave de cache ────────────────────────────────────────
// Usar o texto bruto como chave de Map pode consumir muita memória em textos
// grandes. O hash djb2 (32 bits) é rápido e colisões são improváveis na prática.

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ─── Índice espacial ──────────────────────────────────────────────────────

/**
 * Testa interseção entre dois bounding boxes [minLng, minLat, maxLng, maxLat].
 * Complexidade O(1) — pré-filtro antes de booleanPointInPolygon.
 */
function bboxIntersects([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) {
  return !(ax1 < bx0 || ax0 > bx1 || ay1 < by0 || ay0 > by1);
}

/**
 * Encontra os municípios que contêm os pontos de uma gleba.
 * Usa pré-filtro por bbox para reduzir chamadas de booleanPointInPolygon
 * de ~2000 para ~10-40 candidatos por ponto (melhoria de 50-200×).
 *
 * @param {number[][]} points  - [lon, lat][]
 * @param {number[]}   polyBbox - bbox [minLng, minLat, maxLng, maxLat]
 * @param {boolean}    validarPontos - quando false, pula validação de municípios
 * @returns {{ municipios: Set<string>|null, semiArido: boolean|null }}
 */
function findMunicipios(points, polyBbox, validarPontos) {
  if (!state.sudeneLoaded || !state.sudeneFeatures.length) {
    return { municipios: null, semiArido: null };
  }
  if (!validarPontos) {
    return { municipios: new Set(), semiArido: null };
  }

  // Candidatos cujo bbox intersecta com o da gleba
  const candidates = state.sudeneFeatures.filter(f =>
    bboxIntersects(polyBbox, f.bbox)
  );
  log(`Candidatos municipais: ${candidates.length}/${state.sudeneFeatures.length}`);

  const municipios = new Set();
  let semiArido = null;

  for (const [lon, lat] of points) {
    const pt = turf.point([lon, lat]);
    for (const feat of candidates) {
      try {
        if (turf.booleanPointInPolygon(pt, feat.feature)) {
          municipios.add(feat.id);
          // Detecta se algum ponto está em área semiárida
          if (feat.feature.properties?.ID_SMA === '1') semiArido = true;
          else if (semiArido === null) semiArido = false;
          break; // Ponto está em exatamente um município
        }
      } catch (_) { /* geometria inválida na SUDENE — ignorar */ }
    }
  }

  return { municipios, semiArido };
}

// ─── Parser ───────────────────────────────────────────────────────────────

/**
 * Converte o texto bruto em Map<glebaId, [lon, lat][]>.
 * @returns {{ errors: string[], glebaMap: Map<number, number[][]> }}
 */
function parseRawText(text) {
  const glebaMap = new Map();
  const errors   = [];

  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;

    const parts = line.split(/[\s,;]+/); // aceita espaço, vírgula ou ponto-e-vírgula
    if (parts.length < 4) {
      errors.push(`Linha ${i + 1}: esperado 4 valores (gleba ponto lat lon), encontrado ${parts.length}.`);
      return;
    }

    const [glebaId, , lat, lon] = parts.map(Number);
    if ([glebaId, lat, lon].some(isNaN)) {
      errors.push(`Linha ${i + 1}: valores não numéricos.`);
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      errors.push(`Linha ${i + 1}: lat/lon fora dos limites globais.`);
      return;
    }
    if (lat < NORDESTE.latMin || lat > NORDESTE.latMax ||
        lon < NORDESTE.lngMin || lon > NORDESTE.lngMax) {
      errors.push(
        `Linha ${i + 1}: [${lat}, ${lon}] fora do Nordeste ` +
        `(lat ${NORDESTE.latMin}..${NORDESTE.latMax}, lon ${NORDESTE.lngMin}..${NORDESTE.lngMax}).`
      );
      return;
    }

    if (!glebaMap.has(glebaId)) glebaMap.set(glebaId, []);
    glebaMap.get(glebaId).push([lon, lat]); // GeoJSON order
  });

  return { errors, glebaMap };
}

// ─── Validação individual por gleba ──────────────────────────────────────

/**
 * @param {number}    glebaId
 * @param {number[][]} points   - [lon, lat][]
 * @param {boolean}   validarPontos
 * @returns {{ errors: string[], glebaData: GlebaData|null }}
 */
function validateSingleGleba(glebaId, points, validarPontos) {

  // 1. Mínimo de pontos
  if (points.length < MIN_POINTS) {
    return { errors: [`Gleba ${glebaId}: mínimo ${MIN_POINTS} pontos (${points.length} fornecido[s]).`], glebaData: null };
  }

  // 2. Polígono fechado
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  if (fx !== lx || fy !== ly) {
    return { errors: [`Gleba ${glebaId}: polígono não fechado — primeiro e último ponto devem ser iguais.`], glebaData: null };
  }

  // 3. Sem pontos consecutivos iguais (exceto fechamento)
  for (let i = 0; i < points.length - 2; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (ax === bx && ay === by) {
      return { errors: [`Gleba ${glebaId}: pontos consecutivos duplicados nas posições ${i + 1} e ${i + 2}.`], glebaData: null };
    }
  }

  // 4. Construção do polígono Turf
  let poly;
  try {
    poly = turf.polygon([points]);
  } catch (e) {
    return { errors: [`Gleba ${glebaId}: polígono inválido — ${e.message}.`], glebaData: null };
  }

  // 5. Sem autointerseção
  try {
    const kinks = turf.kinks(poly);
    if (kinks.features.length > 0) {
      return { errors: [`Gleba ${glebaId}: possui ${kinks.features.length} autointerseção(ões).`], glebaData: null };
    }
  } catch (_) {
    return { errors: [`Gleba ${glebaId}: erro ao verificar autointerseção.`], glebaData: null };
  }

  // 6. Municípios (usa índice espacial ou pula se validarPontos=false)
  if (!state.sudeneLoaded) {
    return { errors: [`Gleba ${glebaId}: SUDENE ainda não carregada — aguarde e tente novamente.`], glebaData: null };
  }

  const polyBbox = turf.bbox(poly);
  const { municipios, semiArido } = findMunicipios(points, polyBbox, validarPontos);

  if (municipios === null) {
    return { errors: [`Gleba ${glebaId}: não foi possível verificar municípios.`], glebaData: null };
  }

  if (validarPontos && municipios.size > MAX_MUNICIPIOS) {
    return {
      errors: [`Gleba ${glebaId}: abrange ${municipios.size} municípios (máximo: ${MAX_MUNICIPIOS}).`],
      glebaData: null,
    };
  }

  // 7. Métricas geográficas
  let area, centroid, perimeter;
  try {
    area      = turf.area(poly) / 10_000;                        // m² → hectares
    centroid  = turf.centroid(poly).geometry.coordinates;         // [lon, lat]
    perimeter = turf.length(turf.polygonToLine(poly), { units: 'meters' });
  } catch (e) {
    return { errors: [`Gleba ${glebaId}: erro ao calcular métricas — ${e.message}.`], glebaData: null };
  }

  /** @type {GlebaData} */
  const glebaData = {
    glebaId:      parseInt(glebaId, 10),
    coords:       points.map(([lon, lat]) => [lat, lon]),  // Leaflet [lat, lon]
    geoJsonCoords: points,                                  // GeoJSON [lon, lat]
    area,
    perimeter,
    centroid,                                               // [lon, lat]
    municipios:   Array.from(municipios),
    municipioCount: municipios.size,
    semiArido,                                              // boolean | null
    turfPolygon:  poly,
  };

  log(`Gleba ${glebaId}: ${area.toFixed(2)} ha, ${municipios.size} mun.`);
  return { errors: [], glebaData };
}

// ─── Função principal (pública) ───────────────────────────────────────────

/**
 * Valida o texto bruto de coordenadas.
 * Zero efeitos colaterais de DOM — apenas retorna resultado.
 *
 * @param {string} rawText
 * @param {object} [opts]
 * @param {boolean} [opts.validarPontos=true] - Validar cada ponto contra SUDENE
 * @returns {{ valid: boolean, errors: string[], data: GlebaData[], fromCache: boolean }}
 */
export function validateCoordinates(rawText, { validarPontos = true } = {}) {
  const text = rawText.trim();
  if (!text) {
    return { valid: false, errors: ['Nenhuma coordenada fornecida.'], data: [], fromCache: false };
  }

  // Cache hit (inclui validarPontos na chave para evitar false positives)
  const cacheKey = `${djb2(text)}_${validarPontos ? '1' : '0'}`;
  if (state.cache.has(cacheKey)) {
    log('Cache hit:', cacheKey);
    return { valid: true, errors: [], data: state.cache.get(cacheKey), fromCache: true };
  }

  const { errors: parseErrors, glebaMap } = parseRawText(text);
  if (parseErrors.length) return { valid: false, errors: parseErrors, data: [], fromCache: false };
  if (!glebaMap.size) return { valid: false, errors: ['Nenhuma gleba encontrada.'], data: [], fromCache: false };

  const allErrors = [];
  const allData   = [];

  for (const [glebaId, points] of glebaMap) {
    const { errors, glebaData } = validateSingleGleba(glebaId, points, validarPontos);
    if (errors.length) allErrors.push(...errors);
    else allData.push(glebaData);
  }

  if (allErrors.length) return { valid: false, errors: allErrors, data: [], fromCache: false };

  allData.sort((a, b) => a.glebaId - b.glebaId);
  state.cache.set(cacheKey, allData);
  return { valid: true, errors: [], data: allData, fromCache: false };
}
