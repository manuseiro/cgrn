/**
 * @file ibama.js
 * @description Áreas Embargadas (IBAMA) internas.
 * Arquivo: are_embargo_ibama.json
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn, showToast } from '../components/ui.js';
import { bboxIntersects } from '../utils/geo.js';

export async function loadIBAMA() {
  if (!state.map) { warn('IBAMA: mapa não inicializado'); return; }
  updateIbamaStatus('loading');
  log('IBAMA: carregando arquivo local de embargos...');

  let geojson = null;

  try {
    // Tenta URL Primária (se configurada)
    if (CONFIG.IBAMA.URL_PRIMARIA) {
      try {
        const url = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.IBAMA.URL_PRIMARIA);
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        geojson = await res.json();
        log(`IBAMA primária: ${geojson?.features?.length} features`);
      } catch (e1) {
        warn('IBAMA primária falhou:', e1.message, '— usando fallback local');
      }
    }

    // Fallback local se a primária falhar ou não existir
    if (!geojson) {
      const res2 = await fetch(CONFIG.IBAMA.URL_FALLBACK, {
        signal: AbortSignal.timeout(30000)
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      geojson = await res2.json();
      log(`IBAMA fallback local: ${geojson?.features?.length} features`);
    }

  } catch (e) {
    warn('IBAMA falhou ao carregar:', e.message);
    updateIbamaStatus('error');
    showToast('Camada IBAMA (Embargos) indisponível.', 'warning', 5000);
    return;
  }

  if (!geojson?.features?.length) {
    updateIbamaStatus('error'); return;
  }

  // Índice espacial (Turf BBox)
  // Features sem geometria (registros alfanuméricos puros) recebem bbox nulo
  // e são verificados apenas pelos metadados — não por interseção geométrica.
  state.ibamaFeatures = geojson.features.map(feat => {
    const hasGeom = feat?.geometry?.type != null;
    let bbox = null;
    if (hasGeom) {
      try { bbox = turf.bbox(feat); } catch (_) { bbox = null; }
    }
    return { bbox, hasGeom, feature: feat, props: feat.properties };
  });

  // Camada visual (apenas features com geometria)
  const comGeom = geojson.features.filter(f => f?.geometry?.type != null);
  if (comGeom.length) buildIbamaMapLayer(comGeom);
  else log('IBAMA: dados sem geometria — camada visual omitida');

  state.ibamaLoaded = true;
  updateIbamaStatus('ok');
  log(`IBAMA pronta (${geojson.features.length} registros, ${comGeom.length} com geometria)`);
}

// ─── Camada visual ─────────────────────────────────────────────────────────

function buildIbamaMapLayer(features) {
  const group = L.featureGroup();
  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style() {
      return {
        color: '#dc2626', // red
        weight: 1.5, opacity: 0.9,
        fillColor: '#ef4444', fillOpacity: 0.5,
        dashArray: '3 3'
      };
    },
    onEachFeature(feat, lyr) {
      lyr.bindPopup(buildIbamaPopup(feat.properties), { maxWidth: 300 });
      lyr.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: 0.7 });
        this.bringToFront();
      });
      lyr.on('mouseout', function () { geoLayer.resetStyle(this); });
    },
  });
  group.addLayer(geoLayer);
  state.ibamaLayer = group;
}

export function setIbamaVisible(visible) {
  if (!state.ibamaLayer || !state.map) return;
  state.showIbama = visible;
  if (visible) { state.ibamaLayer.addTo(state.map); state.ibamaLayer.bringToBack(); }
  else state.map.removeLayer(state.ibamaLayer);
}

// ─── Interseção gleba × IBAMA ─────────────────────────────────────────────

export async function checkGlebaIbama(gleba) {
  if (!state.ibamaLoaded || !state.ibamaFeatures.length) {
    throw new Error('Camada IBAMA não está carregada.');
  }

  const polyBbox = turf.bbox(gleba.turfPolygon);
  // Extrai UF e município da gleba para cruzamento alfanumérico (registros sem geometria)
  const glebaUFs = new Set((gleba.municipios ?? []).map(m => m.uf).filter(Boolean));
  const results = [];

  for (const ibama of state.ibamaFeatures) {
    const props = ibama.props;

    if (ibama.hasGeom && ibama.bbox) {
      // ── Registro com geometria: interseção espacial precisa ──────────────
      if (!bboxIntersects(polyBbox, ibama.bbox)) continue;
      try {
        if (!turf.booleanIntersects(gleba.turfPolygon, ibama.feature)) continue;
      } catch (_) { continue; }
    } else {
      // ── Registro alfanumérico (geometry: null): cruzamento por UF ────────
      // Só inclui se a UF do embargo coincide com alguma UF da gleba.
      // Sem UF na gleba (não calculado ainda), omite esses registros.
      if (!glebaUFs.size) continue;
      if (!glebaUFs.has(props.uf)) continue;
    }
    // mapeamento corrigido:
    results.push({
      numAI: props.num_auto_infracao ?? '—',
      cpfCnpj: props.cpf_cnpj_infrator ?? '—',
      nome: props.nom_pessoa ?? '—',
      municipio: props.nom_municipio ?? '—',
      uf: props.sig_uf ?? '—',
      situacao: props.status_tad ?? 'Ativo',
      dataEmissao: props.data_tad ?? '—',
      infracao: props.des_infracao ?? '—',   // ← novo
      processo: props.processo_tad ?? '—',   // ← novo
      area: props.qtd_area_desmatada ?? '—',
    });
  }
  return results;
}

// ─── Utilitários ──────────────────────────────────────────────────────────

function buildIbamaPopup(p) {
  const numAI = p?.numero_ai ?? p?.num_ai ?? 'Área Embargada';
  const municipio = p?.municipio ?? '—';
  const uf = p?.uf ?? '';
  const cpfCnpj = p?.cpf_cnpj ?? '—';
  const situacao = p?.situacao ?? 'Ativo';
  const dataEmissao = p?.data_emissao ?? p?.data_tad ?? '—';
  const nomeUC = p?.nome_uc ?? '—';
  const area = p?.area && p.area !== '0' ? p.area + ' ha' : '—';

  return `<div class="cgrn-popup" style="min-width:220px">
    <div class="d-flex align-items-start gap-2 mb-2">
      <span style="font-size:1.3em"><i class="bi bi-x-octagon-fill text-danger"></i></span>
      <div><strong>Embargo IBAMA</strong></div>
    </div>
    <span class="badge bg-danger mb-2">${situacao}</span>
    <table class="popup-table">
      <tr><td>Nº do AI</td><td>${numAI}</td></tr>
      <tr><td>CPF/CNPJ</td><td>${cpfCnpj}</td></tr>
      <tr><td>Município</td><td>${municipio} — ${uf}</td></tr>
      <tr><td>UC</td><td>${nomeUC}</td></tr>
      <tr><td>Área</td><td>${area}</td></tr>
      <tr><td>Data</td><td>${dataEmissao}</td></tr>
    </table>
  </div>`;
}

function updateIbamaStatus(status) {
  const el = document.getElementById('ibamaStatus');
  if (!el) return;
  const m = {
    loading: { cls: 'text-warning', icon: 'spinner-border spinner-border-sm', txt: 'IBAMA...' },
    ok: { cls: 'text-success', icon: 'bi bi-check-circle-fill', txt: 'IBAMA' },
    error: { cls: 'text-warning', icon: 'bi bi-exclamation-triangle-fill', txt: 'IBAMA OFF' },
  };
  const { cls, icon, txt } = m[status] ?? m.loading;
  const iconHtml = status === 'loading'
    ? `<span class="${icon} me-1" role="status"></span>`
    : `<i class="${icon} me-1"></i>`;
  el.className = `status-item small ${cls}`;
  el.innerHTML = `${iconHtml}${txt}`;
}
