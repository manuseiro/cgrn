/**
 * @file terras_indigenas.js
 * @description Módulo de carregamento, visualização e consulta das
 * Terras Indígenas do Nordeste brasileiro (FUNAI/IBGE).
 *
 * Fonte: FUNAI — Coordenação de Geoprocessamento, via arquivo
 * terras_indigenas_br.json convertido para GeoJSON local.
 *
 * Fases (status jurídico):
 *   Regularizada   → verde-escuro  (processo completo)
 *   Homologada     → azul          (decreto presidencial)
 *   Declarada      → laranja       (portaria declaratória)
 *   Encaminhada RI → amarelo-ocre  (relatório enviado à PRES/FUNAI)
 *   Delimitada     → cinza-roxo    (relatório aprovado)
 *
 * Performance:
 *   - Bbox pré-computado por feature (mesmo padrão do SUDENE)
 *   - Verificação de interseção TI × gleba em O(k) vs O(n)
 */

import { state } from './state.js';
import { log, warn, showToast } from './ui.js';

// ─── Constantes ────────────────────────────────────────────────────────────

/** Cores por fase jurídica — visual semafórico intuitivo */
const FASE_STYLE = Object.freeze({
  'Regularizada': { color: '#1a7f4e', fill: '#22c55e', opacity: 0.42 },
  'Homologada': { color: '#1d4ed8', fill: '#3b82f6', opacity: 0.38 },
  'Declarada': { color: '#c2410c', fill: '#f97316', opacity: 0.40 },
  'Encaminhada RI': { color: '#92400e', fill: '#f59e0b', opacity: 0.38 },
  'Delimitada': { color: '#5b21b6', fill: '#8b5cf6', opacity: 0.35 },
});

const FASE_DEFAULT = { color: '#374151', fill: '#9ca3af', opacity: 0.30 };

/** URL do GeoJSON local (relativo ao index.html) */
const TI_GEOJSON_URL = 'terras_indigenas_nordeste.geojson';

// ─── Carregamento ──────────────────────────────────────────────────────────

/**
 * Carrega e exibe as Terras Indígenas do Nordeste no mapa.
 * Constrói índice espacial (bbox) para consultas de interseção rápidas.
 * Deve ser chamada uma única vez durante a inicialização.
 */
export async function loadTerrasIndigenas() {
  if (!state.map) { warn('Terras Indígenas: mapa não inicializado'); return; }

  log('Terras Indígenas: carregando...');
  try {
    const res = await fetch(TI_GEOJSON_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    if (!geojson?.features?.length) throw new Error('GeoJSON sem features');
    log(`TI: ${geojson.features.length} features recebidas`);

    // ── Índice espacial (mesmo padrão do sudene.js) ────────────────────
    state.tiFeatures = geojson.features
      .filter(f => f?.geometry?.coordinates?.length)
      .map(feat => {
        let bbox;
        try { bbox = turf.bbox(feat); }
        catch (_) { bbox = [-180, -90, 180, 90]; }
        return { bbox, feature: feat, props: feat.properties };
      });

    log(`Terras Indígenas: índice com ${state.tiFeatures.length} features`);

    // ── Camada visual ──────────────────────────────────────────────────
    const tiGroup = L.featureGroup();

    L.geoJSON(geojson, {
      style(feat) {
        const s = FASE_STYLE[feat.properties?.fase] ?? FASE_DEFAULT;
        return {
          color: s.color,
          weight: 1.5,
          opacity: 0.85,
          fillColor: s.fill,
          fillOpacity: s.opacity,
          dashArray: '4 3',
        };
      },
      onEachFeature(feat, lyr) {
        const p = feat.properties;
        lyr.bindPopup(buildTIPopup(p), { maxWidth: 300 });

        lyr.on('mouseover', function () {
          this.setStyle({ weight: 2.5, fillOpacity: Math.min((FASE_STYLE[p?.fase]?.opacity ?? .3) + .18, .75) });
          this.bringToFront();
        });
        lyr.on('mouseout', function () {
          tiLayer.resetStyle(this);
        });
      },
    }).addTo(tiGroup);

    // Referência para resetStyle funcionar
    const tiLayer = tiGroup.getLayers()[0];

    state.tiLayer = tiGroup;
    state.tiLoaded = true;

    // Começa OCULTA — usuário ativa via checkbox
    log('Terras Indígenas: camada pronta (oculta por padrão)');
    updateTIStatus('ok');

  } catch (err) {
    warn('Terras Indígenas: erro ao carregar:', err);
    updateTIStatus('error');
    showToast('Terras Indígenas: erro ao carregar dados.', 'warning', 5000);
  }
}

// ─── Visibilidade ──────────────────────────────────────────────────────────

/**
 * Exibe ou oculta a camada de Terras Indígenas no mapa.
 * @param {boolean} visible
 */
export function setTerrasIndigenasVisible(visible) {
  if (!state.tiLayer || !state.map) return;
  state.showTI = visible;

  if (visible) {
    if (!state.map.hasLayer(state.tiLayer)) {
      state.tiLayer.addTo(state.map);
    }
    // Garante que ficam abaixo dos polígonos de gleba
    state.tiLayer.bringToBack();
    log('Terras Indígenas: visível');
  } else {
    state.map.removeLayer(state.tiLayer);
    log('Terras Indígenas: oculta');
  }
}

// ─── Verificação de interseção gleba × TI ─────────────────────────────────

/**
 * Verifica se uma gleba intersecta com alguma Terra Indígena.
 * Usa pré-filtro por bbox antes de booleanIntersects.
 *
 * @param {GlebaData} gleba
 * @returns {TIIntersecao[]} Lista de TIs que intersectam
 */
export function checkGlebaTI(gleba) {
  if (!state.tiLoaded || !state.tiFeatures?.length) return [];

  const polyBbox = turf.bbox(gleba.turfPolygon);
  const results = [];

  for (const ti of state.tiFeatures) {
    // Pré-filtro O(1) por bbox
    if (!bboxIntersects(polyBbox, ti.bbox)) continue;

    try {
      if (turf.booleanIntersects(gleba.turfPolygon, ti.feature)) {
        // Calcula a área de sobreposição
        let areaHa = null;
        try {
          const inter = turf.intersect(
            turf.featureCollection([gleba.turfPolygon, ti.feature])
          );
          if (inter) areaHa = turf.area(inter) / 10_000;
        } catch (_) { /* sobreposição não calculável */ }

        results.push({
          nome: ti.props.nome,
          etnia: ti.props.etnia,
          fase: ti.props.fase,
          uf: ti.props.uf,
          municipio: ti.props.municipio,
          areaHa,
        });
      }
    } catch (_) { /* geometria inválida */ }
  }

  return results;
}

// ─── Utilitários privados ──────────────────────────────────────────────────

/**
 * Testa interseção por bbox — mesma implementação de validation.js.
 * @param {number[]} a - [minLng, minLat, maxLng, maxLat]
 * @param {number[]} b
 */
function bboxIntersects([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) {
  return !(ax1 < bx0 || ax0 > bx1 || ay1 < by0 || ay0 > by1);
}

/**
 * Constrói HTML do popup da Terra Indígena.
 * @param {object} p - properties da feature
 */
function buildTIPopup(p) {
  const s = FASE_STYLE[p?.fase] ?? FASE_DEFAULT;
  const badge = `<span class="badge" style="background:${s.fill};color:#fff;font-size:.72em">
                   ${p?.fase ?? 'Indefinida'}
                 </span>`;
  const area = p?.area_ha
    ? `${parseFloat(p.area_ha).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ha`
    : '—';

  return `
    <div style="min-width:210px;font-size:.83rem">
      <div class="d-flex align-items-start gap-2 mb-2">
        <span style="font-size:1.3em;line-height:1"><i class="bi bi-heart-arrow"></i></span>
        <div>
          <strong style="font-size:.9rem">${p?.nome ?? 'Terra Indígena'}</strong><br>
          <small class="text-muted">${p?.etnia ?? ''}</small>
        </div>
      </div>
      ${badge}
      <table style="width:100%;border-collapse:collapse;margin-top:.5rem">
        <tr>
          <td style="color:#888;width:42%;font-size:.78em">Município</td>
          <td style="font-size:.78em">${p?.municipio ?? '—'} / ${p?.uf ?? ''}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:.78em">Área</td>
          <td style="font-size:.78em">${area}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:.78em">Modalidade</td>
          <td style="font-size:.78em">${p?.modalidade ?? '—'}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:.78em">Atualização</td>
          <td style="font-size:.78em">${p?.atualizado ?? '—'}</td>
        </tr>
      </table>
    </div>`;
}

/**
 * Atualiza o badge de status das TI na UI.
 * @param {'loading'|'ok'|'error'} status
 */
function updateTIStatus(status) {
  const el = document.getElementById('tiStatus');
  if (!el) return;
  const map = {
    loading: { cls: 'text-warning', txt: 'Terra Indíginas carregando...' },
    ok: { cls: 'text-success', txt: 'Terra Indíginas' },//<i class="bi bi-heart-arrow"></i> Terra Indíginas
    error: { cls: 'text-warning', txt: 'Terra Indíginas indisponível' },
  };
  const { cls, txt } = map[status] ?? map.loading;
  el.className = `navbar-text small ${cls}`;
  el.textContent = txt;
}

// ─── Legenda ───────────────────────────────────────────────────────────────

/**
 * Retorna HTML da legenda das Terras Indígenas para exibição no mapa.
 * @returns {string}
 */
export function buildTILegend() {
  const items = Object.entries(FASE_STYLE)
    .map(([fase, s]) =>
      `<div class="d-flex align-items-center gap-2 mb-1">
         <span style="width:14px;height:14px;border-radius:3px;
                      background:${s.fill};border:2px solid ${s.color};
                      display:inline-block;flex-shrink:0"></span>
         <span style="font-size:.75rem">${fase}</span>
       </div>`
    ).join('');

  return `
    <div class="ti-legend">
      <div class="fw-semibold mb-2" style="font-size:.78rem;letter-spacing:.04em">
        STATUS JURÍDICO
      </div>
      ${items}
      <div style="font-size:.68rem;color:#888;margin-top:.5rem">Fonte: FUNAI 2026</div>
    </div>`;
}
