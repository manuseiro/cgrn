/**
 * sudene.js — Carregamento da camada SUDENE com índice espacial.
 *
 * Carrega o GeoJSON de municípios da SUDENE, renderiza no mapa
 * e constrói um índice espacial (bounding boxes) para consultas rápidas.
 */

import { getMap, setSudeneLayer, setSudeneIndex, getSudeneIndex } from './state.js';
import { log, logError, SUDENE_URL, STATE_COLORS, SUDENE_OPACITY } from './utils.js';

/* global L, turf */

/**
 * Calcula o bounding box de um GeoJSON feature.
 * @param {object} feature
 * @returns {number[]} [minLon, minLat, maxLon, maxLat]
 */
function computeBBox(feature) {
  return turf.bbox(feature);
}

/**
 * Carrega a camada SUDENE do servidor e constrói o índice espacial.
 * @param {function} onStart — Callback chamado no início do carregamento
 * @param {function} onEnd — Callback chamado ao final (sucesso ou erro)
 * @returns {Promise<boolean>} — true se carregou com sucesso
 */
export async function loadSudeneLayer(onStart, onEnd) {
  const map = getMap();
  if (!map) {
    logError('sudene: mapa não inicializado');
    return false;
  }

  onStart?.();

  try {
    log('sudene: carregando dados...');
    const response = await fetch(SUDENE_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const sudeneData = await response.json();

    if (!sudeneData || !Array.isArray(sudeneData.features)) {
      throw new Error('Formato inválido: campo "features" ausente ou não é array');
    }

    log('sudene:', sudeneData.features.length, 'features carregadas');

    // ── Construir camada visual ──────────────────────────────────────
    const sudeneGroup = L.featureGroup();
    const spatialIndex = [];

    sudeneData.features.forEach(feature => {
      const uf = feature.properties.NM_ESTADO;
      const isSemiArido = feature.properties.ID_SMA === '1';
      const color = STATE_COLORS[uf] || '#888888';

      const layer = L.geoJSON(feature, {
        style: {
          color,
          weight: 0,
          fillOpacity: isSemiArido ? SUDENE_OPACITY.semiArido : SUDENE_OPACITY.normal,
        },
        onEachFeature(feat, lyr) {
          const nome = feat.properties.NM_MUNICIP;
          const estado = feat.properties.NM_ESTADO;
          const semiAridoText = feat.properties.ID_SMA === '1' ? 'Semiárido' : 'Fora do Semiárido';
          lyr.bindPopup(`<b>${nome}</b> – ${estado} (${semiAridoText})`);
        },
      });

      sudeneGroup.addLayer(layer);

      // Entrada do índice espacial
      spatialIndex.push({
        geometry: feature,
        bbox: computeBBox(feature),
        properties: feature.properties,
      });
    });

    // Salvar no estado
    setSudeneLayer(sudeneGroup);
    setSudeneIndex(spatialIndex);
    sudeneGroup.addTo(map);

    log('sudene: camada adicionada, índice com', spatialIndex.length, 'entradas');
    return true;

  } catch (error) {
    logError('sudene: erro ao carregar', error);
    return false;

  } finally {
    onEnd?.();
  }
}

/**
 * Identifica o município sob um ponto clicado no mapa.
 * Utiliza o índice espacial para performance.
 * @param {number} lat
 * @param {number} lon
 * @returns {{ nome: string, uf: string, semiArido: boolean } | null}
 */
export function identificarMunicipio(lat, lon) {
  const index = getSudeneIndex();
  if (!index || index.length === 0) return null;

  for (const entry of index) {
    const [minLon, minLat, maxLon, maxLat] = entry.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;

    if (turf.booleanPointInPolygon([lon, lat], entry.geometry)) {
      return {
        nome: entry.properties.NM_MUNICIP,
        uf: entry.properties.NM_ESTADO,
        semiArido: entry.properties.ID_SMA === '1',
      };
    }
  }

  return null;
}
