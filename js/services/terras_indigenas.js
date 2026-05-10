/**
 * @file terras_indigenas.js — v3.0
 * @description Terras Indígenas do Nordeste (FUNAI/geobr).
 * Fallback:       terras_indigenas_nordeste.geojson (local)
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn, showToast } from '../components/ui.js';
import { bboxIntersects } from '../utils/geo.js';

const NORDESTE_UFS = new Set(CONFIG.TI.NORDESTE_UFS);

const FASE_STYLE = Object.freeze({
  'Regularizada': { color: '#1a7f4e', fill: '#22c55e', opacity: 0.42 },
  'Homologada': { color: '#1d4ed8', fill: '#3b82f6', opacity: 0.38 },
  'Declarada': { color: '#c2410c', fill: '#f97316', opacity: 0.40 },
  'Encaminhada RI': { color: '#92400e', fill: '#f59e0b', opacity: 0.38 },
  'Delimitada': { color: '#5b21b6', fill: '#8b5cf6', opacity: 0.35 },
});
const FASE_DEFAULT = { color: '#374151', fill: '#9ca3af', opacity: 0.30 };

// ─── Carregamento com fallback ─────────────────────────────────────────────

export async function loadTerrasIndigenas() {
  if (!state.map) { warn('TI: mapa não inicializado'); return; }
  updateTIStatus('loading');
  log('TI: tentando URL primária...');

  let geojson = null;

  // 1. Tenta URL primária (leosil21.github.io) via Proxy
  try {
    const url = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.TI.URL_PRIMARIA);
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    geojson = normalizeTISource(raw);
    log(`TI primária: ${geojson.features.length} features`);
  } catch (e) {
    warn('TI primária falhou:', e.message, '— usando fallback local');
    // 2. Fallback local
    try {
      const res2 = await fetch(CONFIG.TI.URL_FALLBACK);
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      geojson = await res2.json();
      log(`TI fallback: ${geojson?.features?.length} features`);
    } catch (e2) {
      warn('TI fallback também falhou:', e2.message);
      updateTIStatus('error');
      showToast('Camada de Terras Indígenas indisponível.', 'warning', 5000);
      return;
    }
  }

  if (!geojson?.features?.length) {
    updateTIStatus('error'); return;
  }

  // Filtra apenas Nordeste (se vier a base nacional)
  const features = geojson.features.filter(f =>
    NORDESTE_UFS.has(f.properties?.uf ?? f.properties?.uf_sigla ?? '')
  );
  log(`TI após filtro Nordeste: ${features.length} features`);

  // Índice espacial
  state.tiFeatures = features.map(feat => {
    let bbox;
    try { bbox = turf.bbox(feat); } catch (_) { bbox = [-180, -90, 180, 90]; }
    return { bbox, feature: feat, props: feat.properties };
  });

  // Camada visual
  buildTIMapLayer(features);
  state.tiLoaded = true;
  updateTIStatus('ok');
  log('TI pronta');
}

// ─── Normalização de fontes ────────────────────────────────────────────────

/**
 * Normaliza dados da URL primária (lista WKT) para GeoJSON padrão.
 * A URL leosil21 pode retornar array ou FeatureCollection.
 */
function normalizeTISource(raw) {
  let features = [];

  if (raw?.type === 'FeatureCollection') {
    features = raw.features;
  } else if (Array.isArray(raw)) {
    features = raw;
  }

  const normalized = features.map(item => {
    // Pode ser uma Feature GeoJSON ou um objeto simples da API
    const props = item.properties ?? item;
    const geom = item.geometry ?? (props.the_geom ? parseWKT(props.the_geom) : null);

    if (!geom) return null;

    return {
      type: 'Feature',
      properties: {
        codigo: props.terrai_codigo ?? props.terrai_cod ?? props.codigo ?? '—',
        nome: props.terrai_nome ?? props.nom_terrai ?? props.nome ?? 'Terra Indígena',
        etnia: props.etnia_nome ?? props.etnia ?? '—',
        municipio: props.municipio_nome ?? props.municipio ?? '—',
        uf: props.uf_sigla ?? props.uf ?? '—',
        area_ha: props.areahaalb ?? props.area_ha ?? 0,
        fase: props.fase_ti ?? props.fase ?? '—',
        modalidade: props.modalidade_ti ?? props.modalidade ?? '—',
        atualizado: props.criacaoato ?? props.atualizado ?? '—',
      },
      geometry: geom,
    };
  }).filter(Boolean);

  return { type: 'FeatureCollection', features: normalized };
}

const { COORD_PRECISION } = CONFIG.VALIDATION;

/** Parse simples de WKT POLYGON/MULTIPOLYGON → GeoJSON geometry */
function parseWKT(wkt) {
  const w = wkt.trim();
  const parseRing = s => s.trim().split(',').map(p => {
    const [lon, lat] = p.trim().split(/\s+/);
    const factor = Math.pow(10, COORD_PRECISION);
    const rnd = n => Math.round(parseFloat(n) * factor) / factor;
    return [rnd(lon), rnd(lat)];
  });
  const rings = s => [...s.matchAll(/\(([^()]+)\)/g)].map(m => parseRing(m[1]));

  if (w.startsWith('MULTIPOLYGON')) {
    const blocks = [...w.matchAll(/\((\([^)]+\)(?:,\s*\([^)]+\))*)\)/g)];
    return { type: 'MultiPolygon', coordinates: blocks.map(b => rings(b[1])) };
  }
  if (w.startsWith('POLYGON')) {
    return { type: 'Polygon', coordinates: rings(w) };
  }
  return null;
}

// ─── Camada visual ─────────────────────────────────────────────────────────

function buildTIMapLayer(features) {
  const group = L.featureGroup();
  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style(feat) {
      const s = FASE_STYLE[feat.properties?.fase] ?? FASE_DEFAULT;
      return {
        color: s.color, weight: 1.5, opacity: 0.9, fillColor: s.fill,
        fillOpacity: s.opacity, dashArray: '5 3'
      };
    },
    onEachFeature(feat, lyr) {
      lyr.bindPopup(buildTIPopup(feat.properties), { maxWidth: 300 });
      lyr.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: Math.min((FASE_STYLE[feat.properties?.fase]?.opacity ?? 0.3) + 0.2, 0.75) });
        this.bringToFront();
      });
      lyr.on('mouseout', function () { geoLayer.resetStyle(this); });
    },
  });
  group.addLayer(geoLayer);
  state.tiLayer = group;
}

// ─── Interseção gleba × TI ────────────────────────────────────────────────

export function checkGlebaTI(gleba) {
  if (!state.tiLoaded || !state.tiFeatures.length) return [];
  const polyBbox = turf.bbox(gleba.turfPolygon);
  const results = [];

  for (const ti of state.tiFeatures) {
    if (!bboxIntersects(polyBbox, ti.bbox)) continue;
    try {
      if (turf.booleanIntersects(gleba.turfPolygon, ti.feature)) {
        let areaHa = null;
        try {
          const inter = turf.intersect(gleba.turfPolygon, ti.feature);
          if (inter) areaHa = turf.area(inter) / 10_000;
        } catch (_) { }
        results.push({
          nome: ti.props.nome, etnia: ti.props.etnia,
          fase: ti.props.fase, uf: ti.props.uf,
          municipio: ti.props.municipio, areaHa
        });
      }
    } catch (_) { }
  }
  return results;
}

// ─── Toggle visibilidade ───────────────────────────────────────────────────

export function setTerrasIndigenasVisible(visible) {
  if (!state.tiLayer || !state.map) return;
  state.showTI = visible;
  if (visible) { state.tiLayer.addTo(state.map); state.tiLayer.bringToBack(); }
  else state.map.removeLayer(state.tiLayer);
}

// ─── Legenda ───────────────────────────────────────────────────────────────

export function buildTILegend() {
  const items = Object.entries(FASE_STYLE).map(([fase, s]) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${s.fill};border-color:${s.color}"></span>
      <span>${fase}</span>
    </div>`).join('');
  return `<div class="ti-legend-inner">
    <div class="legend-title"><i class="bi bi-feather text-danger"></i> TERRAS INDÍGENAS</div>
    ${items}
    <div class="legend-source">Fonte: FUNAI 2023</div>
  </div>`;
}

// ─── Utilitários ──────────────────────────────────────────────────────────

function buildTIPopup(p) {
  const s = FASE_STYLE[p?.fase_ti] ?? FASE_DEFAULT;
  const area = p?.areahaalb ? parseFloat(p.areahaalb).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' ha' : '—';
  return `<div class="cgrn-popup" style="min-width:210px">
    <div class="d-flex align-items-start gap-2 mb-2">
      <span style="font-size:1.3em"><i class="bi bi-feather text-danger"></i></span>
      <div><strong>${p?.terrai_nome ?? 'Terra Indígena'}</strong><br>
        <small class="text-muted">${p?.etnia ?? ''}</small></div>
    </div>
    <span class="badge" style="background:${s.fill}">${p?.fase_ti ?? '—'}</span>
    <table class="popup-table mt-2">
      <tr><td>Município</td><td>${p?.municipio_nome ?? '—'} / ${p?.uf_sigla ?? ''}</td></tr>
      <tr><td>Área</td><td>${area}</td></tr>
      <tr><td>Modalidade</td><td>${p?.modalidade_ti ?? '—'}</td></tr>
      <tr><td>Criação Ato</td><td>${p?.criacaoato ?? '—'}</td></tr>
    </table>
  </div>`;
}

function updateTIStatus(status) {
  const el = document.getElementById('tiStatus');
  if (!el) return;
  const m = {
    loading: { cls: 'text-warning', txt: 'TERRA INDÍGENA...' },
    ok: { cls: 'text-success', txt: 'TERRA INDÍGENA' },
    error: { cls: 'text-warning', txt: 'TERRA INDÍGENA OFF' }
  };
  const { cls, txt } = m[status] ?? m.loading;
  const icon = status === 'ok' ? '<i class="bi bi-check-circle-fill me-1"></i>'
    : status === 'loading' ? '<span class="spinner-border spinner-border-sm me-1" role="status"></span>'
      : '<i class="bi bi-exclamation-triangle-fill me-1"></i>';
  el.className = `status-item small ${cls}`;
  el.innerHTML = `${icon}${txt}`;
}
