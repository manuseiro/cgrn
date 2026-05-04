/**
 * validation.js — Validação pura de coordenadas (sem manipulação de DOM).
 *
 * Retorna { valid: boolean, errors: string[], data: GlebaData[] }
 * Aplica regras do BACEN: polígono fechado, pontos distintos,
 * sem autointerseção, mínimo 4 pontos e máximo 4 municípios.
 *
 * v2 — Melhorias:
 *  - Validação de sentido do polígono (anti-horário recomendado)
 *  - Validação de precisão mínima das coordenadas
 *  - Diagnóstico granular por ponto
 *  - Mensagens mais amigáveis
 *  - Reprocessamento de gleba a partir de coordenadas brutas
 */

import { getSudeneIndex, generateId } from './state.js';
import {
  log, logError,
  NORDESTE_BOUNDS, GLOBAL_BOUNDS,
  MAX_MUNICIPIOS_POR_GLEBA, MIN_PONTOS_POLIGONO, VALORES_POR_LINHA,
  MIN_DECIMAL_PRECISION, DIAG_STATUS,
  countDecimals, isCounterClockwise, reverseCoords,
} from './utils.js';

/* global turf */

/**
 * Verifica se um ponto [lon, lat] está dentro do bounding box de uma feature.
 * @param {number} lon
 * @param {number} lat
 * @param {number[]} bbox — [minLon, minLat, maxLon, maxLat]
 * @returns {boolean}
 */
function inBBox(lon, lat, bbox) {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/**
 * Encontra os municípios que contêm os pontos de uma gleba,
 * usando índice espacial com pré-filtro por bounding box.
 * @param {Array<[number, number]>} points — [lon, lat]
 * @returns {Set<string>} — Códigos GEOCMU
 */
function findMunicipios(points) {
  const index = getSudeneIndex();
  const municipios = new Set();

  for (const pt of points) {
    const [lon, lat] = pt;
    for (const entry of index) {
      // Pré-filtro rápido por bounding box
      if (!inBBox(lon, lat, entry.bbox)) continue;
      // Teste preciso de ponto-em-polígono
      if (turf.booleanPointInPolygon([lon, lat], entry.geometry)) {
        municipios.add(entry.properties.CD_GEOCMU);
        break; // Um ponto só está em um município
      }
    }
  }

  return municipios;
}

/**
 * Encontra os nomes dos municípios a partir dos códigos GEOCMU.
 * @param {string[]} geocmus
 * @returns {string[]}
 */
export function getMunicipioNames(geocmus) {
  const index = getSudeneIndex();
  return geocmus.map(code => {
    const entry = index.find(e => e.properties.CD_GEOCMU === code);
    return entry ? `${entry.properties.NM_MUNICIP} (${entry.properties.NM_ESTADO})` : code;
  });
}

/**
 * Reprocessa uma gleba a partir de coordenadas brutas [lon, lat].
 * Calcula área, perímetro, centroide e municípios.
 * @param {Array<[number, number]>} rawCoords — [lon, lat] (polígono fechado)
 * @param {number} glebaNum — Número da gleba
 * @returns {GlebaData|null}
 */
export function reprocessGlebaCoords(rawCoords, glebaNum) {
  try {
    const turfPolygon = turf.polygon([rawCoords]);
    const areaM2 = turf.area(turfPolygon);
    const areaHa = areaM2 / 10000;
    const perimeterLine = turf.lineString(rawCoords);
    const perimeterM = turf.length(perimeterLine, { units: 'meters' });
    const centroid = turf.centroid(turfPolygon);

    const index = getSudeneIndex();
    let municipios = [];
    if (index && index.length > 0) {
      municipios = Array.from(findMunicipios(rawCoords));
    }

    return {
      id: null, // caller should set
      gleba: glebaNum,
      coords: rawCoords.map(([lon, lat]) => [lat, lon]),
      rawCoords,
      area: areaHa,
      perimeter: perimeterM,
      centroid: centroid.geometry.coordinates,
      municipios,
    };
  } catch (e) {
    logError('validation: erro ao reprocessar gleba', e);
    return null;
  }
}

/**
 * Valida um bloco de texto de coordenadas conforme regras BACEN/CGRN.
 *
 * @param {string} coordenadasText — Texto bruto de coordenadas
 * @returns {{ valid: boolean, errors: string[], warnings: string[], data: GlebaData[] }}
 */
export function validarCoordenadas(coordenadasText) {
  log('validation: início');

  if (!coordenadasText || !coordenadasText.trim()) {
    return {
      valid: false,
      errors: ['Digite pelo menos uma coordenada ou desenhe uma gleba.'],
      warnings: [],
      data: [],
    };
  }

  const texto = coordenadasText.trim();
  const linhas = texto.split('\n');
  const glebaMap = new Map();
  const errors = [];
  const warnings = [];

  // ── Fase 1: Parse das linhas ──────────────────────────────────────────
  linhas.forEach((linha, idx) => {
    const valores = linha.trim().split(/\s+/);
    if (valores.length !== VALORES_POR_LINHA) {
      errors.push(`Linha ${idx + 1}: Deve conter exatamente ${VALORES_POR_LINHA} valores (gleba, ponto, latitude, longitude). Encontrado: ${valores.length}.`);
      return;
    }

    const [glebaStr, pontoStr, latStr, lonStr] = valores;
    const gleba = Number(glebaStr);
    const latitude = Number(latStr);
    const longitude = Number(lonStr);

    if (isNaN(gleba) || gleba < 1) {
      errors.push(`Linha ${idx + 1}: Número da gleba inválido ("${glebaStr}"). Use números inteiros positivos.`);
      return;
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      errors.push(`Linha ${idx + 1}: Coordenadas devem ser numéricas. Verifique "${latStr}" e "${lonStr}".`);
      return;
    }

    if (latitude < GLOBAL_BOUNDS.latMin || latitude > GLOBAL_BOUNDS.latMax ||
        longitude < GLOBAL_BOUNDS.lonMin || longitude > GLOBAL_BOUNDS.lonMax) {
      errors.push(`Linha ${idx + 1}: Coordenadas fora dos limites globais (lat: ${latitude}, lon: ${longitude}).`);
      return;
    }

    if (latitude > NORDESTE_BOUNDS.latMax || latitude < NORDESTE_BOUNDS.latMin ||
        longitude > NORDESTE_BOUNDS.lonMax || longitude < NORDESTE_BOUNDS.lonMin) {
      errors.push(`Linha ${idx + 1}: Coordenada fora do Nordeste brasileiro (lat: ${latitude}, lon: ${longitude}). Limites: lat [${NORDESTE_BOUNDS.latMin}, ${NORDESTE_BOUNDS.latMax}], lon [${NORDESTE_BOUNDS.lonMin}, ${NORDESTE_BOUNDS.lonMax}].`);
      return;
    }

    // Aviso de precisão
    const latDecimals = countDecimals(latitude);
    const lonDecimals = countDecimals(longitude);
    if (latDecimals < MIN_DECIMAL_PRECISION || lonDecimals < MIN_DECIMAL_PRECISION) {
      warnings.push(`Linha ${idx + 1}: Precisão baixa (${latDecimals}/${lonDecimals} casas decimais). Recomendado: mínimo ${MIN_DECIMAL_PRECISION} casas.`);
    }

    if (!glebaMap.has(gleba)) glebaMap.set(gleba, []);
    glebaMap.get(gleba).push([longitude, latitude]);
  });

  if (errors.length > 0) {
    return { valid: false, errors, warnings, data: [] };
  }

  // ── Fase 2: Validação por gleba ───────────────────────────────────────
  const data = [];

  for (const [gleba, points] of glebaMap) {
    log(`validation: gleba ${gleba}, ${points.length} pontos`);

    // Mínimo de pontos
    if (points.length < MIN_PONTOS_POLIGONO) {
      errors.push(`Gleba ${gleba}: Deve possuir no mínimo ${MIN_PONTOS_POLIGONO} pontos (encontrado: ${points.length}). Um polígono válido precisa de pelo menos 3 vértices + ponto de fechamento.`);
      continue;
    }

    // Polígono fechado
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      errors.push(`Gleba ${gleba}: O polígono não está fechado. O primeiro ponto (${first[1]}, ${first[0]}) e o último (${last[1]}, ${last[0]}) devem ser idênticos.`);
      continue;
    }

    // Pontos consecutivos distintos (exceto fechamento)
    let hasDuplicateError = false;
    const seenCoords = new Set();
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const coordKey = `${current[0]},${current[1]}`;

      if (i < points.length - 2 && current[0] === next[0] && current[1] === next[1]) {
        errors.push(`Gleba ${gleba}: Pontos consecutivos ${i + 1} e ${i + 2} são idênticos (${current[1]}, ${current[0]}). Remova a duplicata.`);
        hasDuplicateError = true;
        break;
      }

      if (seenCoords.has(coordKey) && i !== points.length - 2) {
        errors.push(`Gleba ${gleba}: Coordenada duplicada na posição ${i + 1} (${current[1]}, ${current[0]}), fora do ponto de fechamento.`);
        hasDuplicateError = true;
        break;
      }
      seenCoords.add(coordKey);
    }
    if (hasDuplicateError) continue;

    // Sem autointerseção
    let turfPolygon;
    try {
      turfPolygon = turf.polygon([points]);
      if (turf.kinks(turfPolygon).features.length > 0) {
        errors.push(`Gleba ${gleba}: O polígono possui linhas que se cruzam (autointerseção), formando uma geometria inválida. Reorganize os vértices.`);
        continue;
      }
    } catch (e) {
      errors.push(`Gleba ${gleba}: Erro ao validar geometria do polígono. Verifique as coordenadas.`);
      logError('validation: erro turf.polygon/kinks', e);
      continue;
    }

    // Verificação de sentido (anti-horário recomendado)
    if (!isCounterClockwise(points)) {
      warnings.push(`Gleba ${gleba}: O polígono está em sentido horário. Para padrão GeoJSON, recomenda-se sentido anti-horário. O sistema corrigirá automaticamente o cálculo.`);
    }

    // Municípios (com índice espacial)
    const index = getSudeneIndex();
    if (!index || index.length === 0) {
      errors.push('A camada de municípios da SUDENE ainda não foi carregada. Aguarde o carregamento e tente novamente.');
      continue;
    }

    const municipios = findMunicipios(points);
    log(`validation: gleba ${gleba} → ${municipios.size} municípios`);

    if (municipios.size > MAX_MUNICIPIOS_POR_GLEBA) {
      errors.push(`Gleba ${gleba}: Abrange ${municipios.size} municípios, excedendo o limite de ${MAX_MUNICIPIOS_POR_GLEBA} municípios por gleba (regra BACEN). Divida a gleba em polígonos menores.`);
      continue;
    }

    if (municipios.size === 0) {
      warnings.push(`Gleba ${gleba}: Nenhum município identificado. A gleba pode estar fora da área de cobertura da SUDENE.`);
    }

    // Cálculo de área e perímetro
    try {
      const areaM2 = turf.area(turfPolygon);
      const areaHa = areaM2 / 10000;
      const perimeterLine = turf.lineString(points);
      const perimeterM = turf.length(perimeterLine, { units: 'meters' });
      const centroid = turf.centroid(turfPolygon);

      data.push({
        id: generateId(),
        gleba,
        coords: points.map(([lon, lat]) => [lat, lon]),  // [lat, lon] para Leaflet
        rawCoords: points,  // [lon, lat] para GeoJSON/Turf
        area: areaHa,
        perimeter: perimeterM,
        centroid: centroid.geometry.coordinates, // [lon, lat]
        municipios: Array.from(municipios),
      });

      log(`validation: gleba ${gleba} OK — ${areaHa.toFixed(2)} ha, ${perimeterM.toFixed(0)} m`);
    } catch (e) {
      errors.push(`Gleba ${gleba}: Erro ao calcular área/perímetro. Verifique as coordenadas.`);
      logError('validation: erro cálculo', e);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, data: [] };
  }

  return { valid: true, errors: [], warnings, data };
}

/**
 * Faz parse de CSV/TXT de coordenadas.
 * Aceita formatos:
 *  - gleba ponto lat lon (espaço/tab)
 *  - gleba,ponto,lat,lon (vírgula)
 *  - gleba;ponto;lat;lon (ponto e vírgula)
 *
 * @param {string} fileContent
 * @returns {string} — Texto normalizado no formato "gleba ponto lat lon"
 */
export function parseFileContent(fileContent) {
  const lines = fileContent.trim().split('\n');
  const normalized = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    // Detecta separador
    let parts;
    if (trimmed.includes(';')) {
      parts = trimmed.split(';');
    } else if (trimmed.includes(',')) {
      parts = trimmed.split(',');
    } else {
      parts = trimmed.split(/\s+/);
    }

    parts = parts.map(p => p.trim()).filter(Boolean);

    // Se tem cabeçalho (primeira linha não numérica), pula
    if (parts.length >= VALORES_POR_LINHA && isNaN(Number(parts[0]))) continue;

    if (parts.length === VALORES_POR_LINHA) {
      normalized.push(parts.join(' '));
    }
  }

  return normalized.join('\n');
}

/**
 * Tenta fazer parse de arquivo GeoJSON.
 * @param {string} content
 * @returns {string|null} — Texto normalizado ou null
 */
export function parseGeoJSONContent(content) {
  try {
    const geojson = JSON.parse(content);
    const lines = [];
    let glebaNum = 0;

    const processFeature = (feature) => {
      if (!feature.geometry) return;
      const type = feature.geometry.type;

      if (type === 'Polygon') {
        glebaNum++;
        const ring = feature.geometry.coordinates[0];
        ring.forEach((coord, idx) => {
          const [lon, lat] = coord;
          lines.push(`${glebaNum} ${idx + 1} ${lat} ${lon}`);
        });
      } else if (type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          glebaNum++;
          const ring = polygon[0];
          ring.forEach((coord, idx) => {
            const [lon, lat] = coord;
            lines.push(`${glebaNum} ${idx + 1} ${lat} ${lon}`);
          });
        });
      }
    };

    if (geojson.type === 'FeatureCollection') {
      geojson.features.forEach(processFeature);
    } else if (geojson.type === 'Feature') {
      processFeature(geojson);
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      processFeature({ geometry: geojson });
    }

    return lines.length > 0 ? lines.join('\n') : null;
  } catch {
    return null;
  }
}

// ── Diagnóstico detalhado ───────────────────────────────────────────────────

/**
 * @typedef {Object} PointDiagnostic
 * @property {number} index — Índice do ponto
 * @property {number} lat
 * @property {number} lon
 * @property {string} status — 'ok', 'warning', 'error'
 * @property {string[]} issues — Lista de problemas encontrados
 */

/**
 * @typedef {Object} GlebaDiagnostic
 * @property {number} gleba — Número da gleba
 * @property {PointDiagnostic[]} points — Diagnóstico de cada ponto
 * @property {string[]} globalIssues — Problemas globais da gleba
 * @property {string} overallStatus — 'ok', 'warning', 'error'
 * @property {boolean} canAutoFix — Se pode ser corrigido automaticamente
 * @property {string|null} fixDescription — Descrição da correção automática
 */

/**
 * Executa diagnóstico detalhado das glebas (texto bruto).
 * @param {string} coordenadasText
 * @returns {{ glebas: GlebaDiagnostic[], summary: object }}
 */
export function diagnosticarCoordenadas(coordenadasText) {
  const result = {
    glebas: [],
    summary: { total: 0, ok: 0, warnings: 0, errors: 0 },
  };

  if (!coordenadasText || !coordenadasText.trim()) {
    return result;
  }

  const texto = coordenadasText.trim();
  const linhas = texto.split('\n');
  const glebaMap = new Map();

  // Parse
  linhas.forEach((linha, idx) => {
    const valores = linha.trim().split(/\s+/);
    if (valores.length !== VALORES_POR_LINHA) return;

    const gleba = Number(valores[0]);
    const lat = Number(valores[2]);
    const lon = Number(valores[3]);

    if (isNaN(gleba) || isNaN(lat) || isNaN(lon)) return;

    if (!glebaMap.has(gleba)) glebaMap.set(gleba, []);
    glebaMap.get(gleba).push({ lat, lon, lineIdx: idx });
  });

  for (const [glebaNum, rawPoints] of glebaMap) {
    const diag = {
      gleba: glebaNum,
      points: [],
      globalIssues: [],
      overallStatus: DIAG_STATUS.OK,
      canAutoFix: false,
      fixDescription: null,
    };

    const points = rawPoints.map((p, idx) => {
      const issues = [];
      let status = DIAG_STATUS.OK;

      // Verificar limites
      if (p.lat < NORDESTE_BOUNDS.latMin || p.lat > NORDESTE_BOUNDS.latMax ||
          p.lon < NORDESTE_BOUNDS.lonMin || p.lon > NORDESTE_BOUNDS.lonMax) {
        issues.push('Fora do Nordeste');
        status = DIAG_STATUS.ERROR;
      }

      // Verificar precisão
      const latDecimals = countDecimals(p.lat);
      const lonDecimals = countDecimals(p.lon);
      if (latDecimals < MIN_DECIMAL_PRECISION || lonDecimals < MIN_DECIMAL_PRECISION) {
        issues.push(`Baixa precisão (${Math.min(latDecimals, lonDecimals)} casas)`);
        if (status === DIAG_STATUS.OK) status = DIAG_STATUS.WARNING;
      }

      // Verificar duplicatas consecutivas
      if (idx > 0 && idx < rawPoints.length - 1) {
        const prev = rawPoints[idx - 1];
        if (p.lat === prev.lat && p.lon === prev.lon) {
          issues.push('Duplicata consecutiva');
          status = DIAG_STATUS.ERROR;
        }
      }

      // Verificar duplicatas não-consecutivas (exceto fechamento)
      if (idx < rawPoints.length - 1) {
        for (let j = 0; j < idx; j++) {
          if (rawPoints[j].lat === p.lat && rawPoints[j].lon === p.lon) {
            issues.push(`Duplicata do ponto ${j + 1}`);
            if (status === DIAG_STATUS.OK) status = DIAG_STATUS.WARNING;
            break;
          }
        }
      }

      return {
        index: idx + 1,
        lat: p.lat,
        lon: p.lon,
        status,
        issues: issues.length > 0 ? issues : ['✓ Válido'],
      };
    });

    diag.points = points;

    // Verificações globais
    const coords = rawPoints.map(p => [p.lon, p.lat]);

    // Polígono fechado?
    if (coords.length >= 2) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        diag.globalIssues.push('Polígono não está fechado (primeiro ≠ último ponto)');
        diag.canAutoFix = true;
        diag.fixDescription = 'Adicionar ponto de fechamento automaticamente';
      }
    }

    // Mínimo de pontos
    if (coords.length < MIN_PONTOS_POLIGONO) {
      diag.globalIssues.push(`Poucos pontos: ${coords.length} (mínimo: ${MIN_PONTOS_POLIGONO})`);
    }

    // Sentido do polígono
    if (coords.length >= MIN_PONTOS_POLIGONO) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      const isClosed = first[0] === last[0] && first[1] === last[1];

      if (isClosed) {
        if (!isCounterClockwise(coords)) {
          diag.globalIssues.push('Polígono em sentido horário (recomendado: anti-horário)');
          diag.canAutoFix = true;
          diag.fixDescription = (diag.fixDescription ? diag.fixDescription + ' + ' : '') + 'Inverter para anti-horário';
        }

        // Autointerseção
        try {
          const turfPoly = turf.polygon([coords]);
          if (turf.kinks(turfPoly).features.length > 0) {
            diag.globalIssues.push('O polígono possui autointerseção');
          }
        } catch {
          diag.globalIssues.push('Geometria inválida');
        }

        // Municípios
        const municipios = findMunicipios(coords);
        if (municipios.size > MAX_MUNICIPIOS_POR_GLEBA) {
          diag.globalIssues.push(`Abrange ${municipios.size} municípios (máx: ${MAX_MUNICIPIOS_POR_GLEBA})`);
        }
      }
    }

    // Determinar status geral
    const hasError = points.some(p => p.status === DIAG_STATUS.ERROR) || diag.globalIssues.some(i => i.includes('autointerseção') || i.includes('inválida'));
    const hasWarning = points.some(p => p.status === DIAG_STATUS.WARNING) || diag.globalIssues.length > 0;

    if (hasError) diag.overallStatus = DIAG_STATUS.ERROR;
    else if (hasWarning) diag.overallStatus = DIAG_STATUS.WARNING;
    else diag.overallStatus = DIAG_STATUS.OK;

    result.glebas.push(diag);
  }

  // Summary
  result.summary.total = result.glebas.length;
  result.summary.ok = result.glebas.filter(g => g.overallStatus === DIAG_STATUS.OK).length;
  result.summary.warnings = result.glebas.filter(g => g.overallStatus === DIAG_STATUS.WARNING).length;
  result.summary.errors = result.glebas.filter(g => g.overallStatus === DIAG_STATUS.ERROR).length;

  return result;
}
