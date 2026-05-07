/**
 * @file icmbio.js
 * @description Unidades de Conservação (ICMBio) internas.
 * Arquivo local gerado via Mapshaper: limiteucsfederais_a.json
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn, showToast } from '../components/ui.js';
import { UC_PROTECAO_INTEGRAL, UC_USO_SUSTENTAVEL } from './camadas_externas.js';
import { bboxIntersects } from '../utils/geo.js';

export async function loadICMBIO() {
  if (!state.map) { warn('ICMBio: mapa não inicializado'); return; }
  updateUCStatus('loading');
  log('ICMBio: carregando arquivo local...');

  let geojson = null;

  try {
    const url = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.ICMBIO.URL_PRIMARIA);
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    geojson = await res.json();
    log(`ICMBio primária: ${geojson?.features?.length} features`);
  } catch (e) {
    warn('ICMBio primária falhou:', e.message, '— usando fallback local');
    try {
      const res2 = await fetch(CONFIG.ICMBIO.URL_FALLBACK);
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      geojson = await res2.json();
      log(`ICMBio fallback local: ${geojson?.features?.length} features`);
    } catch (e2) {
      warn('ICMBio fallback falhou ao carregar:', e2.message);
      updateUCStatus('error');
      showToast('Camada ICMBio indisponível.', 'warning', 5000);
      return;
    }
  }

  if (!geojson?.features?.length) {
    updateUCStatus('error'); return;
  }

  // Índice espacial (Turf BBox)
  state.ucFeatures = geojson.features.map(feat => {
    let bbox;
    try { bbox = turf.bbox(feat); } catch (_) { bbox = [-180, -90, 180, 90]; }
    return { bbox, feature: feat, props: feat.properties };
  });

  // Camada visual
  buildUCMapLayer(geojson.features);
  state.ucLoaded = true;
  updateUCStatus('ok');
  log('ICMBio pronta');
}

// ─── Camada visual ─────────────────────────────────────────────────────────

function buildUCMapLayer(features) {
  const group = L.featureGroup();
  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style(feat) {
      const cat = feat.properties?.siglacateg ?? feat.properties?.categoria_uc ?? '';
      const isIntegral = UC_PROTECAO_INTEGRAL.has(cat);
      const isSustentavel = UC_USO_SUSTENTAVEL.has(cat);

      let color = '#3b82f6'; // default blue
      let fill = '#93c5fd';

      if (isIntegral) {
        color = '#dc2626'; // red
        fill = '#f87171';
      } else if (isSustentavel) {
        color = '#16a34a'; // green
        fill = '#4ade80';
      }

      return {
        color: color, weight: 1.5, opacity: 0.9, fillColor: fill,
        fillOpacity: 0.4, dashArray: '4 4'
      };
    },
    onEachFeature(feat, lyr) {
      lyr.bindPopup(buildUCPopup(feat.properties), { maxWidth: 300 });
      lyr.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: 0.6 });
        this.bringToFront();
      });
      lyr.on('mouseout', function () { geoLayer.resetStyle(this); });
    },
  });
  group.addLayer(geoLayer);
  state.ucLayer = group;
}

export function setICMBioVisible(visible) {
  if (!state.ucLayer || !state.map) return;
  state.showUC = visible;
  if (visible) { state.ucLayer.addTo(state.map); state.ucLayer.bringToBack(); }
  else state.map.removeLayer(state.ucLayer);
}

// ─── Interseção gleba × UC ────────────────────────────────────────────────

export async function checkGlebaICMBio(gleba) {
  if (!state.ucLoaded || !state.ucFeatures.length) return [];
  const polyBbox = turf.bbox(gleba.turfPolygon);
  const results = [];

  for (const uc of state.ucFeatures) {
    if (!bboxIntersects(polyBbox, uc.bbox)) continue;  // era bboxOk
    try {
      if (turf.booleanIntersects(gleba.turfPolygon, uc.feature)) {
        const nome = uc.props.nomeuc ?? uc.props.nm_uc ?? uc.props.nome ?? '—';
        const categoria = uc.props.siglacateg ?? uc.props.categoria_uc ?? uc.props.categoria ?? '—';
        const grupo = uc.props.grupouc ?? uc.props.grupo_uc ?? uc.props.grupo ?? '—';
        const esfera = uc.props.esferaadm ?? uc.props.ds_esfera ?? uc.props.esfera ?? '—';

        results.push({
          nome,
          categoria,
          grupo,
          esfera,
          protecaoIntegral: UC_PROTECAO_INTEGRAL.has(categoria),
        });
      }
    } catch (_) { }
  }
  return results;
}

// ─── Utilitários ──────────────────────────────────────────────────────────

function buildUCPopup(p) {
  // mapeamento corrigido:
  const nome = p.nomeuc ?? '—';
  const categoria = p.siglacateg ?? '—';
  const grupo = p.grupouc ?? '—';
  const esfera = p.esferaadm ?? '—';
  // Campos adicionais disponíveis:
  const ano = p.criacaoano ?? '—';
  const cnuc = p.cnuc ?? '—';
  const biomas = p.biomas ?? '—';
  const demarcacao = p.demarcacao ?? '—';

  return `<div class="cgrn-popup" style="min-width:210px">
    <div class="d-flex align-items-start gap-2 mb-2">
      <span style="font-size:1.3em"><i class="bi bi-tree-fill text-success"></i></span>
      <div><strong>${nome}</strong></div>
    </div>
    <span class="badge bg-secondary mb-2">${categoria}</span>
    <table class="popup-table">
      <tr><td>Grupo</td><td>${grupo}</td></tr>
      <tr><td>Esfera</td><td>${esfera}</td></tr>
      <tr><td>Ano Criação</td><td>${ano}</td></tr>
      <tr><td>CNUC</td><td>${cnuc}</td></tr>
      <tr><td>Biomas</td><td>${biomas}</td></tr>
      <tr><td>Demarcação</td><td>${demarcacao}</td></tr>
    </table>
  </div>`;
}

function updateUCStatus(status) {
  const el = document.getElementById('ucStatus');
  if (!el) return;
  const m = {
    loading: { cls: 'text-warning', txt: 'ICMBIO...' },
    ok: { cls: 'text-success', txt: 'ICMBIO' },
    error: { cls: 'text-warning', txt: 'ICMBIO OFF' }
  };
  const { cls, txt } = m[status] ?? m.loading;
  const icon = status === 'ok' ? '<i class="bi bi-check-circle-fill me-1"></i>'
    : status === 'loading' ? '<span class="spinner-border spinner-border-sm me-1" role="status"></span>'
      : '<i class="bi bi-exclamation-triangle-fill me-1"></i>';
  el.className = `status-item small ${cls}`;
  el.innerHTML = `${icon}${txt}`;
}
