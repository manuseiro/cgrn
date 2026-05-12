/**
 * @file sicor.js
 * @description Serviço de consulta ao SICOR (BCB) para detectar glebas já financiadas.
 * Baseado no arquivo de microdados de glebas WKT/CSV do Banco Central.
 * Suporta download em background no boot e fallback de ano.
 */

import { CONFIG } from '../utils/config.js';
import { log, warn, updateSicorStatus } from '../components/ui.js';
import { bboxIntersects } from '../utils/geo.js';

/** Cache em memória dos dados do SICOR */
let _sicorPolygons = null;
let _isLoading = false;
let _loadPromise = null;

/**
 * Carrega e processa os dados do SICOR.
 * O arquivo é um CSV compactado em Gzip, processado via proxy com descompressão.
 */
export async function loadSicorData() {
  // Singleton — evita downloads paralelos e retorna cache se pronto
  if (_sicorPolygons !== null) return _sicorPolygons;
  if (_isLoading) return _loadPromise;

  _isLoading = true;
  _loadPromise = _doLoad();
  return _loadPromise;
}

/**
 * Execução real do carregamento.
 * @private
 */
async function _doLoad() {
  updateSicorStatus('loading');
  log('SICOR: carregando microdados BCB...');

  try {
    const year = new Date().getFullYear();
    let res = null;
    let usedYear = year;

    // Tenta o ano corrente, com fallback para o ano anterior (importante em Janeiro)
    for (const y of [year, year - 1]) {
      // URL oficial do BCB (microdados brutos)
      const baseUrl = `${CONFIG.SICOR.URL_BASE}${y}.gz`;
      const url = CONFIG.PROXY_URL + encodeURIComponent(baseUrl) + '&decompress=1';

      try {
        res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (res.ok) {
          usedYear = y;
          log(`SICOR: usando arquivo de ${y}`);
          break;
        }
      } catch (e) {
        warn(`SICOR: tentativa ano ${y} falhou:`, e.message);
      }
    }

    if (!res?.ok) throw new Error('Arquivo SICOR não disponível no BCB (404/Timeout)');

    const text = await res.text();
    const lines = text.split('\n');
    if (lines.length < 2) throw new Error('Arquivo SICOR vazio ou inválido');

    // Detecta colunas dinamicamente (BCB costuma mudar a ordem)
    const header = lines[0].split(';').map(h => h.trim().toUpperCase());
    const refIdx = header.findIndex(h => h.includes('REF_BACEN') || h === 'NU_ORDEM');
    const wktIdx = header.findIndex(h => h.includes('MULTIPOL') || h.includes('WKT') || h.includes('GEOM'));

    if (wktIdx === -1) {
      throw new Error(`Coluna de geometria não encontrada. Colunas: ${header.join(', ')}`);
    }

    log(`SICOR: colunas detectadas — ref[${refIdx}], wkt[${wktIdx}]`);

    const polygons = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      const ref = refIdx !== -1 ? (parts[refIdx]?.trim() ?? `L${i}`) : `L${i}`;
      const wktStr = parts[wktIdx]?.trim() ?? '';

      if (!wktStr || wktStr === 'MULTIPOLYGON EMPTY') continue;

      const poly = parseWKT(wktStr, { ref_bacen: ref });
      if (poly) {
        polygons.push({ ref, poly, bbox: turf.bbox(poly) });
      }
    }

    _sicorPolygons = polygons;
    updateSicorStatus('ok');
    log(`SICOR: ${polygons.length} operações carregadas ✅ (${usedYear})`);
    return _sicorPolygons;

  } catch (e) {
    warn('SICOR: falha crítica:', e.message);
    updateSicorStatus('error');
    _sicorPolygons = [];
    return [];
  } finally {
    _isLoading = false;
  }
}

/**
 * Parser WKT simplificado para POLYGON/MULTIPOLYGON.
 * @param {string} wkt 
 * @param {object} properties 
 * @returns {Feature|null}
 */
function parseWKT(wkt, properties) {
  try {
    // Limpeza e extração de coordenadas
    // Suporta MULTIPOLYGON(((...))) e POLYGON((...))
    const clean = wkt.replace(/MULTIPOLYGON|POLYGON/gi, '').trim();
    const rings = [];

    // Expressão para pegar o que está dentro de parênteses aninhados
    const matches = clean.match(/\(\(([^)]+)\)\)/g) || [clean];

    for (const m of matches) {
      const coords = m.replace(/[()]/g, '').split(',').map(pair => {
        const [lon, lat] = pair.trim().split(/\s+/).map(Number);
        return [lon, lat];
      });

      if (coords.length >= 4) {
        // Garante fechamento
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        rings.push(coords);
      }
    }

    if (rings.length === 0) return null;
    if (rings.length === 1) {
      return turf.polygon(rings, properties);
    } else {
      // B2: Cada ring é um polígono independente no MultiPolygon
      return turf.multiPolygon(rings.map(r => [r]), properties);
    }
  } catch (e) {
    return null;
  }
}

/**
 * Verifica se a gleba possui sobreposição com alguma operação ativa no SICOR.
 * 
 * @param {GlebaData} gleba 
 * @returns {Promise<Object[]>} Lista de operações encontradas
 */
export async function checkGlebaSicor(gleba) {
  // Se ainda estiver carregando, aguarda a promise singleton
  const allPolys = await (_sicorPolygons !== null ? _sicorPolygons : loadSicorData());
  if (!allPolys.length) return [];

  const glebaBbox = turf.bbox(gleba.turfPolygon);
  const found = [];

  for (const item of allPolys) {
    // C3: Filtro rápido por BBox (eficiente)
    if (!bboxIntersects(glebaBbox, item.bbox)) {
      continue;
    }

    // Interseção precisa
    try {
      if (turf.booleanIntersects(gleba.turfPolygon, item.poly)) {
        found.push({
          ref_bacen: item.ref,
          label: `Operação ${item.ref}`
        });
      }
    } catch (e) {
      // ignore geometries problemáticas
    }
  }

  return found;
}
