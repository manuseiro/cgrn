/**
 * @file bioma.js
 * @description Camada de Biomas (IBGE) — padrão WFS via proxy com fallback local.
 * Arquivo local: api/qg_2025_240_bioma_nordeste.json
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn, showToast } from '../components/ui.js';
import { bboxIntersects } from '../utils/geo.js';
import { detectarUF } from './camadas_externas.js';
/* Bios que abrange o Nordeste
Caatinga - Bioma predominante (interior nordestino)
Mata Atlântica - Litoral nordestino
Cerrado - Oeste da Bahia e sul de Maranhão/Piauí
Amazônia - Transição norte do Maranhão
Ecossistemas costeiros - Manguezais e restingas*/
const BIOMA_CORES = Object.freeze({
  'Caatinga': { color: '#d4a017', fill: '#f5d87a' },
  'Cerrado': { color: '#5a8a3c', fill: '#a8d57a' },
  'Mata Atlântica': { color: '#1e6e42', fill: '#5db87a' },
  'Amazônia': { color: '#0e4d2e', fill: '#3a9e60' },
  'Pampa': { color: '#8b6914', fill: '#c9a84c' },
  'Pantanal': { color: '#1a6080', fill: '#4da8cc' },
});

/** Biomas do Nordeste e sua regulação no BACEN/SICOR */
export const BIOMA_REGULACAO = Object.freeze({
  'Caatinga': { reservaLegalPct: 20, marcoCorteLegal: null, bacenCritico: false },
  'Cerrado': { reservaLegalPct: 20, marcoCorteLegal: '2008-07-22', bacenCritico: true },
  'Mata Atlântica': { reservaLegalPct: 20, marcoCorteLegal: null, bacenCritico: true },
  'Amazônia': { reservaLegalPct: 80, marcoCorteLegal: '2008-07-22', bacenCritico: true },
});

export async function loadBioma() {
  if (!state.map) { warn('Bioma: mapa não inicializado'); return; }
  updateBiomaStatus('loading');

  let geojson = null;

  try {
    // Primária: WFS via proxy (filtrado para Nordeste pelo CQL bbox)
    if (CONFIG.BIOMA?.URL_PRIMARIA) {
      try {
        const url = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.BIOMA.URL_PRIMARIA);
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        geojson = await res.json();
        log(`Bioma WFS: ${geojson?.features?.length} features`);
      } catch (e1) {
        warn('Bioma WFS falhou:', e1.message, '— usando fallback local');
      }
    }

    // Fallback: arquivo local pré-filtrado
    if (!geojson) {
      const res2 = await fetch(CONFIG.BIOMA.URL_FALLBACK, {
        signal: AbortSignal.timeout(15000)
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      geojson = await res2.json();
      log(`Bioma fallback local: ${geojson?.features?.length} features`);
    }

  } catch (e) {
    warn('Bioma: falha total ao carregar:', e.message);
    updateBiomaStatus('error');
    return;
  }

  if (!geojson?.features?.length) {
    warn('Bioma: nenhuma feature recebida');
    updateBiomaStatus('error');
    return;
  }

  // Pré-processa bounding boxes para interseção rápida (mesmo padrão IBAMA/ICMBio)
  state.biomaFeatures = geojson.features.map(f => {
    const coords = f.geometry?.coordinates?.[0]?.[0] ?? f.geometry?.coordinates?.[0] ?? [];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return {
      nome: f.properties?.nm_bioma ?? f.properties?.bioma ?? 'Bioma',
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      feature: f,
    };
  });

  // Cria a camada GeoJSON com estilo por bioma
  state.biomaLayer = L.geoJSON(geojson, {
    style: feature => {
      const nome = feature.properties?.nm_bioma ?? '';
      const cor = BIOMA_CORES[nome] ?? { color: '#888', fill: '#ccc' };
      return {
        color: cor.color,
        weight: 1.5,
        opacity: 0.8,
        fillColor: cor.fill,
        fillOpacity: 0.20,
      };
    },
    onEachFeature: (feature, layer) => {
      const nome = feature.properties?.nm_bioma ?? 'Bioma';
      layer.bindTooltip(nome, { sticky: true, className: 'bioma-tooltip' });
    },
  });

  state.biomaLoaded = true;
  updateBiomaStatus('ok');
  log('Bioma carregado ✅');
}

export function setBiomaVisible(visible) {
  if (!state.biomaLayer) return;
  if (visible) {
    state.biomaLayer.addTo(state.map);
    state.biomaLayer.bringToBack();
  } else {
    state.map.removeLayer(state.biomaLayer);
  }
}

/** Retorna o nome do bioma que contém o ponto (lat, lon) — uso interno. */
export function getBiomaLocal(lat, lon) {
  if (!state.biomaFeatures?.length) return null;
  const pt = [lon, lat];
  for (const b of state.biomaFeatures) {
    if (!bboxIntersects([pt[0], pt[1], pt[0], pt[1]], b.bbox)) continue;
    if (turf.booleanPointInPolygon(turf.point(pt), b.feature)) return b.nome;
  }
  return null;
}

/**
 * Identifica o bioma predominante da gleba.
 * Estratégia: 
 *  1. Cache espacial (state.biomaFeatures)
 *  2. WFS Oficial (Geoserver IBGE)
 *  3. API de Localidades IBGE
 *  4. Fallback por UF
 * 
 * @param {GlebaData} gleba
 * @returns {Promise<string>}
 */
export async function getBiomaGleba(gleba) {
  const [lon, lat] = gleba.centroid;

  // 1. Tenta via cache espacial local (se carregado)
  const local = getBiomaLocal(lat, lon);
  if (local) {
    log(`Bioma local: "${local}" detectado via cache.`);
    return local;
  }

  // 2. Tenta via WFS (usando a URL de interseção de ponto se existir)
  const wfsBase = CONFIG.CONFORMIDADE?.BIOMA_WFS;
  if (wfsBase) {
    try {
      const url = `${wfsBase}&CQL_FILTER=INTERSECTS(geom, POINT(${lon} ${lat}))`;
      const res = await fetch(CONFIG.PROXY_URL + encodeURIComponent(url));
      if (res.ok) {
        const data = await res.json();
        const bioma = data.features?.[0]?.properties?.nm_bioma ?? data.features?.[0]?.properties?.bioma;
        if (bioma) return bioma;
      }
    } catch (e) {
      warn('Bioma WFS point-check erro:', e.message);
    }
  }

  // 3. Fallback: API de Localidades (Ponto)
  const urlApi = `https://servicodados.ibge.gov.br/api/v1/localidades/biomas?lat=${lat}&lng=${lon}`;
  try {
    const res = await fetch(urlApi);
    if (res.ok) {
      const data = await res.json();
      const nome = data?.nome ?? data?.[0]?.nome;
      if (nome) return nome;
    }
  } catch (e) {
    warn('IBGE bioma API erro:', e.message);
  }

  // 4. Fallback final: UF
  return inferBiomaByUF(gleba);
}

/** Fallback: infere bioma predominante pela UF. */
function inferBiomaByUF(gleba) {
  const ufBioma = {
    ma: 'Cerrado', pi: 'Caatinga', ce: 'Caatinga', rn: 'Caatinga',
    pb: 'Caatinga', pe: 'Caatinga', al: 'Mata Atlântica',
    se: 'Mata Atlântica', ba: 'Caatinga',
  };
  return ufBioma[detectarUF(gleba)] ?? 'Caatinga';
}

function updateBiomaStatus(status) {
  const el = document.getElementById('biomaStatus');
  if (!el) return;
  const m = {
    loading: { cls: 'text-warning', icon: 'spinner-border spinner-border-sm', txt: 'Bioma...' },
    ok: { cls: 'text-success', icon: 'bi bi-tree-fill', txt: 'Bioma' },
    error: { cls: 'text-warning', icon: 'bi bi-exclamation-triangle-fill', txt: 'Bioma OFF' },
  };
  const s = m[status] ?? m.loading;
  const iconHtml = status === 'loading'
    ? `<span class="${s.icon} me-1" role="status"></span>`
    : `<i class="${s.icon} me-1"></i>`;
  el.className = `status-item small ${s.cls}`;
  el.innerHTML = `${iconHtml}${s.txt}`;
}