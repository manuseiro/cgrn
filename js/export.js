/**
 * export.js — Funções de exportação (CSV, GeoJSON, imagem do mapa).
 */

import { getGlebas, getMap } from './state.js';
import { log, logError, formatArea, formatPerimeter } from './utils.js';
import { getMunicipioNames } from './validation.js';

/* global turf, leafletImage */

/**
 * Dispara download de um arquivo no navegador.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta glebas para CSV.
 * @param {Array} [glebas] — Se não informado, usa o estado global
 */
export function exportToCSV(glebas) {
  const data = glebas || getGlebas();
  if (!data || data.length === 0) {
    log('export: nenhuma gleba para exportar CSV');
    return;
  }

  log('export: exportando CSV,', data.length, 'glebas');

  const header = 'Gleba,Área (ha),Perímetro,Municípios';
  const rows = data.map(g => {
    const munNames = getMunicipioNames(g.municipios);
    return `${g.gleba},${g.area.toFixed(2)},${formatPerimeter(g.perimeter)},"${munNames.join('; ')}"`;
  });

  const csvContent = [header, ...rows].join('\n');
  downloadFile('cgrn_glebas.csv', csvContent, 'text/csv;charset=utf-8');
}

/**
 * Exporta glebas para GeoJSON (FeatureCollection).
 * @param {Array} [glebas] — Se não informado, usa o estado global
 */
export function exportToGeoJSON(glebas) {
  const data = glebas || getGlebas();
  if (!data || data.length === 0) {
    log('export: nenhuma gleba para exportar GeoJSON');
    return;
  }

  log('export: exportando GeoJSON,', data.length, 'glebas');

  const features = data.map(g => ({
    type: 'Feature',
    properties: {
      gleba: g.gleba,
      area_ha: parseFloat(g.area.toFixed(2)),
      perimeter_m: parseFloat(g.perimeter.toFixed(0)),
      municipios: g.municipios,
      municipio_names: getMunicipioNames(g.municipios),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [g.rawCoords],
    },
  }));

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  const content = JSON.stringify(geojson, null, 2);
  downloadFile('cgrn_glebas.geojson', content, 'application/geo+json');
}

/**
 * Exporta imagem PNG do mapa atual.
 * @returns {Promise<void>}
 */
export function exportMapImage() {
  const map = getMap();
  if (!map) {
    logError('export: mapa não disponível para exportar imagem');
    return;
  }

  log('export: exportando imagem do mapa');

  return new Promise((resolve, reject) => {
    leafletImage(map, (err, canvas) => {
      if (err) {
        logError('export: erro ao gerar imagem', err);
        reject(err);
        return;
      }

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'cgrn_mapa.png';
      link.click();
      resolve();
    });
  });
}
