/**
 * @file sudene.js
 * @description Carregamento e gerenciamento da camada SUDENE.
 * Constrói índice espacial por bounding box ao carregar para
 * acelerar consultas de ponto-em-polígono.
 */

import { CONFIG } from '../utils/config.js';
import { state } from '../utils/state.js';
import { log, warn, setSudeneStatus } from '../components/ui.js';

const { STATE_COLORS, DEFAULT_COLOR } = CONFIG.SUDENE;

/**
 * Carrega os dados GeoJSON da SUDENE, constrói o índice espacial e
 * adiciona a camada visual ao mapa.
 * Deve ser chamada uma única vez durante a inicialização.
 */
export async function loadSudeneLayer() {
  setSudeneStatus('loading');

  // ── Busca dados com fallback local ────────────────────────────────────────
  // 1º tenta a URL externa (GitHub/gov) com timeout de 12s.
  // Se falhar por CORS, timeout ou HTTP error, usa o arquivo local (1.6MB).
  let sudeneData = null;

  try {
    const proxiedUrl = CONFIG.PROXY_URL + encodeURIComponent(CONFIG.SUDENE.URL);
    const response = await fetch(proxiedUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    sudeneData = await response.json();
    log(`SUDENE externa: ${sudeneData.features.length} features carregadas`);
  } catch (e1) {
    warn('SUDENE externa falhou:', e1.message, '— usando fallback local');
    try {
      const response2 = await fetch('api/SUDENE_2021.json');
      if (!response2.ok) throw new Error(`HTTP ${response2.status}`);
      sudeneData = await response2.json();
      log(`SUDENE fallback local: ${sudeneData.features.length} features carregadas`);
    } catch (e2) {
      warn('SUDENE fallback local também falhou:', e2.message);
      setSudeneStatus('error');
      return;
    }
  }

  if (!sudeneData?.features?.length) {
    warn('SUDENE: formato inválido (sem features)');
    setSudeneStatus('error');
    return;
  }

  try {
    // ── Construção do índice espacial ────────────────────────────────────
    // Para cada feature, pré-computa o bbox e armazena junto com o objeto GeoJSON.
    // Isso reduz o custo de validação de município de O(n) para O(k)
    // onde k << n (apenas features cujo bbox intersecta com a gleba).

    state.sudeneFeatures = sudeneData.features
      .filter(f => f?.geometry && f?.properties)
      .map(feature => {
        let bbox;
        try {
          bbox = turf.bbox(feature);
        } catch (_) {
          // Feature com geometria inválida — bbox impossível de calcular
          bbox = [-180, -90, 180, 90]; // fallback: sempre incluir
        }
        return {
          id: feature.properties.CD_GEOCMU || feature.properties.NM_MUNICIP,
          bbox,
          feature, // objeto GeoJSON original (usado no booleanPointInPolygon)
        };
      });

    log(`Índice espacial: ${state.sudeneFeatures.length} features indexadas`);

    // ── Criação da camada visual ─────────────────────────────────────────
    const sudeneGroup = L.featureGroup();

    sudeneData.features.forEach(feature => {
      const uf = feature.properties?.NM_ESTADO ?? '';
      const isSemiArido = feature.properties?.ID_SMA === '1';
      const color = STATE_COLORS[uf] ?? DEFAULT_COLOR;

      const layer = L.geoJSON(feature, {
        style: {
          color,
          weight: 0,                          // Sem bordas visíveis
          fillOpacity: isSemiArido ? 0.30 : 0.18, // Semiárido mais opaco
        },
        onEachFeature(feat, lyr) {
          const nome = feat.properties?.NM_MUNICIP ?? 'Desconhecido';
          const uf = feat.properties?.NM_ESTADO ?? '';
          const semiarid = feat.properties?.ID_SMA === '1' ? 'Semiárido' : 'Fora do Semiárido';
          lyr.bindPopup(
            `<strong>${nome}</strong> — ${uf}<br><span class="badge bg-secondary">${semiarid}</span>`
          );
        },
      });

      sudeneGroup.addLayer(layer);
    });

    state.sudeneLayer = sudeneGroup;
    state.sudeneLoaded = true;

    sudeneGroup.addTo(state.map);
    log('Camada SUDENE adicionada ao mapa');

    // ── Clique no mapa → popup do município ──────────────────────────────
    state.map.on('click', handleMapClick);

    setSudeneStatus('ok');

  } catch (error) {
    warn('Erro ao processar dados da SUDENE:', error);
    setSudeneStatus('error');
    // Não lança o erro — a aplicação pode funcionar parcialmente sem SUDENE
    // A validação de município mostrará erro descritivo ao usuário
  }
}

/**
 * Handler de clique no mapa: identifica município e exibe popup.
 * Usa o mesmo índice espacial para performance consistente.
 * @param {L.LeafletMouseEvent} e
 */
function handleMapClick(e) {
  // Se o clique foi em um polígono de gleba, não abre popup de município
  if (e.originalEvent._glebaClicked) return;

  const { lat, lng } = e.latlng;
  const pt = turf.point([lng, lat]);

  // Pré-filtro por bbox antes de booleanPointInPolygon
  let found = null;
  for (const feat of state.sudeneFeatures) {
    if (
      lng >= feat.bbox[0] && lng <= feat.bbox[2] &&
      lat >= feat.bbox[1] && lat <= feat.bbox[3]
    ) {
      try {
        if (turf.booleanPointInPolygon(pt, feat.feature)) {
          found = feat.feature;
          break;
        }
      } catch (_) { /* geometria inválida */ }
    }
  }

  const nome = found?.properties?.NM_MUNICIP ?? null;
  const uf = found?.properties?.NM_ESTADO ?? '';
  const semiarid = found?.properties?.ID_SMA === '1'
    ? '<i class="bi bi-cloud-slash-fill"></i> Semiárido'
    : '<i class="bi bi-cloud-rain-heavy-fill"></i> Fora do Semiárido';

  const content = nome
    ? `<strong>${nome}</strong> — ${uf}<br><small>${semiarid}</small>`
    : '<em>Fora da área da SUDENE</em>';

  L.popup({ className: 'cgrn-popup' })
    .setLatLng(e.latlng)
    .setContent(content)
    .openOn(state.map);
}
