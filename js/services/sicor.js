/**
 * @file sicor.js
 * @description Serviço de consulta ao SICOR (BCB) para detectar glebas já financiadas.
 * Baseado no arquivo de microdados de glebas WKT/CSV do Banco Central.
 */

import { CONFIG } from '../utils/config.js';
import { log, warn } from '../components/ui.js';

/** Cache em memória dos dados do SICOR para evitar downloads repetidos na mesma sessão */
let _sicorPolygons = null;
let _isLoading = false;

/**
 * Carrega e processa os dados do SICOR.
 * O arquivo é um CSV compactado em Gzip via proxy.
 */
export async function loadSicorData() {
  if (_sicorPolygons) return _sicorPolygons;
  if (_isLoading) return new Promise(resolve => {
    const check = setInterval(() => {
      if (!_isLoading) { clearInterval(check); resolve(_sicorPolygons); }
    }, 100);
  });

  _isLoading = true;
  log('SICOR: Iniciando carregamento de microdados BCB...');

  try {
    const url = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.SICOR.URL) + '&decompress=1';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split('\n');
    const groups = new Map();

    // Pula o cabeçalho (i=1)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      if (parts.length < 7) continue;

      const ref = parts[0];       // #REF_BACEN
      const lat = parseFloat(parts[5]);
      const lon = parseFloat(parts[6]);

      if (isNaN(lat) || isNaN(lon)) continue;

      if (!groups.has(ref)) groups.set(ref, []);
      groups.get(ref).push([lon, lat]); // Turf usa [lon, lat]
    }

    const polygons = [];
    for (const [ref, pts] of groups) {
      if (pts.length < 4) continue; // Mínimo para um polígono fechado

      // Garante fechamento
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        pts.push([first[0], first[1]]);
      }

      try {
        const poly = turf.polygon([pts], { ref_bacen: ref });
        const bbox = turf.bbox(poly);
        polygons.push({ ref, poly, bbox });
      } catch (e) {
        // Ignora polígonos inválidos
      }
    }

    _sicorPolygons = polygons;
    log(`SICOR: ${polygons.length} operações carregadas.`);
    return _sicorPolygons;

  } catch (e) {
    warn('SICOR: Falha ao carregar microdados:', e.message);
    _sicorPolygons = [];
    return [];
  } finally {
    _isLoading = false;
  }
}

/**
 * Verifica se a gleba possui sobreposição com alguma operação ativa no SICOR.
 * 
 * @param {GlebaData} gleba 
 * @returns {Promise<Object[]>} Lista de operações encontradas
 */
export async function checkGlebaSicor(gleba) {
  const allPolys = await loadSicorData();
  if (!allPolys.length) return [];

  const glebaBbox = turf.bbox(gleba.turfPolygon);
  const found = [];

  for (const item of allPolys) {
    // Filtro rápido por BBox
    if (!turf.booleanIntersects(turf.bboxPolygon(glebaBbox), turf.bboxPolygon(item.bbox))) {
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
      // ignore
    }
  }

  return found;
}
