/**
 * @file export.js
 * @description Funcionalidades de exportação: CSV, GeoJSON e imagem do mapa.
 *
 * Bug corrigido: no código original, exportImage estava sendo atribuído como
 * referência de função em vez de ser chamado: `() => exportMapImage` (errado)
 * vs `() => exportMapImage()` (correto). Corrigido aqui e no main.js.
 */

import { state } from './state.js';
import { log, warn, showMessage } from './ui.js';

// ─── Utilitário de download ───────────────────────────────────────────────

/**
 * Dispara o download de um arquivo a partir de uma URL de dados.
 * @param {string} dataUrl - data: URL ou blob URL
 * @param {string} filename
 */
function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  log('Download disparado:', filename);
}

// ─── Exportar CSV ─────────────────────────────────────────────────────────

/**
 * Exporta os resultados das glebas para CSV.
 * @param {GlebaData[]} glebas
 */
export function exportToCSV(glebas) {
  if (!glebas.length) {
    showMessage('Nenhuma gleba para exportar.', 'warning');
    return;
  }

  const headers = ['Gleba', 'Área (ha)', 'Perímetro (m)', 'Municípios', 'Centroid Lat', 'Centroid Lon'];

  const rows = glebas.map(g => [
    g.glebaId,
    g.area.toFixed(6),
    g.perimeter.toFixed(2),
    g.municipioCount,
    g.centroid[1].toFixed(8),
    g.centroid[0].toFixed(8),
  ]);

  // Adiciona linha de total
  const totalArea = glebas.reduce((s, g) => s + g.area, 0);
  rows.push(['TOTAL', totalArea.toFixed(6), '', glebas.length + ' gleba(s)', '', '']);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  // BOM para compatibilidade com Excel (UTF-8)
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), `glebas_${timestamp()}.csv`);
}

// ─── Exportar GeoJSON ─────────────────────────────────────────────────────

/**
 * Exporta as glebas como FeatureCollection GeoJSON.
 * @param {GlebaData[]} glebas
 */
export function exportToGeoJSON(glebas) {
  if (!glebas.length) {
    showMessage('Nenhuma gleba para exportar.', 'warning');
    return;
  }

  /** @type {GeoJSON.FeatureCollection} */
  const featureCollection = {
    type: 'FeatureCollection',
    name: 'CGRN_Glebas',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features: glebas.map(g => ({
      type: 'Feature',
      properties: {
        gleba_id: g.glebaId,
        area_ha: parseFloat(g.area.toFixed(6)),
        perimetro_m: parseFloat(g.perimeter.toFixed(2)),
        municipios: g.municipioCount,
        centroid_lat: g.centroid[1],
        centroid_lon: g.centroid[0],
        exportado_em: new Date().toISOString(),
        sistema: 'GlebasNord — Cálculo e análise de glebas da Região Nordeste',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [g.geoJsonCoords], // [[lon, lat], ...]
      },
    })),
  };

  const json = JSON.stringify(featureCollection, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), `glebas_${timestamp()}.geojson`);
  log('GeoJSON exportado:', featureCollection.features.length, 'features');
}

// ─── Exportar imagem ──────────────────────────────────────────────────────

/**
 * Exporta o mapa como imagem PNG usando leaflet-image.
 *
 * BUG ORIGINAL CORRIGIDO:
 *   document.getElementById('exportImage').onclick = () => exportMapImage; // ❌ referência sem chamar
 *   A versão correta está em main.js:
 *   btnExportImage.addEventListener('click', () => exportMapImage());      // ✅
 */
export function exportMapImage() {
  if (!window.leafletImage) {
    showMessage('Biblioteca leaflet-image não carregada.', 'danger');
    return;
  }

  log('Iniciando exportação de imagem...');

  leafletImage(state.map, (err, canvas) => {
    if (err) {
      warn('Erro leaflet-image:', err);
      showMessage('Erro ao gerar imagem do mapa: ' + err, 'danger');
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      triggerDownload(dataUrl, `mapa_glebas_${timestamp()}.png`);
    } catch (e) {
      warn('Erro ao converter canvas:', e);
      showMessage('Erro ao salvar imagem. Verifique as permissões CORS dos tiles.', 'danger');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Gera string de timestamp para nomes de arquivo.
 * @returns {string} Ex: "20240125_143022"
 */
function timestamp() {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yr}${mo}${dy}_${hh}${mm}${ss}`;
}
