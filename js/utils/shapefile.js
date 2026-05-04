/**
 * @file shapefile.js — v3.5
 * @description Integração com a biblioteca shpjs para suporte a Shapefiles (.zip).
 * 
 * Converte Shapefiles (que devem ser enviados em .zip contendo .shp e .dbf)
 * para o formato interno de coordenadas do CGRN.
 */

import { log, warn } from '../components/ui.js';

/**
 * Converte um ArrayBuffer de um arquivo .zip (Shapefile) para o formato de texto do CGRN.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{text: string, count: number, errors: string[]}>}
 */
export async function shapefileToCoordText(arrayBuffer) {
  const errors = [];
  const lines = [];
  let glebaId = 1;

  try {
    // A biblioteca shpjs deve estar carregada via CDN no index.html
    if (typeof shp === 'undefined') {
      throw new Error('Biblioteca de shapefile (shpjs) não carregada.');
    }

    // shp() pode receber um ArrayBuffer de um zip
    const geojson = await shp(arrayBuffer);
    
    // shpjs pode retornar um único FeatureCollection ou um array deles se houver múltiplos layers
    const layers = Array.isArray(geojson) ? geojson : [geojson];

    for (const layer of layers) {
      if (layer.type !== 'FeatureCollection') continue;

      for (const feature of layer.features) {
        const geometry = feature.geometry;
        if (!geometry) continue;

        // Tenta pegar atributos úteis do DBF
        const props = feature.properties || {};
        const nomeGleba = props.nome || props.NOME || props.NM_MUNICIPIO || props.ID || `Gleba ${glebaId}`;

        // Suporta Polygon e MultiPolygon
        const polygons = geometry.type === 'Polygon' 
          ? [geometry.coordinates] 
          : (geometry.type === 'MultiPolygon' ? geometry.coordinates : []);

        for (const polyCoords of polygons) {
          // No GeoJSON/shpjs, polyCoords[0] é o anel externo
          const ring = polyCoords[0];
          if (!ring || ring.length < 3) continue;

          // Formato CGRN: glebaId pontoId lat lon
          ring.forEach((coord, index) => {
            const [lon, lat] = coord;
            lines.push(`${glebaId} ${index + 1} ${lat.toFixed(6)} ${lon.toFixed(6)}`);
          });

          log(`Shapefile: Importada gleba ${glebaId} ("${nomeGleba}") com ${ring.length} pontos`);
          glebaId++;
        }
      }
    }

    if (glebaId === 1) {
      errors.push('Nenhum polígono válido encontrado no Shapefile.');
    }

    return {
      text: lines.join('\n'),
      count: glebaId - 1,
      errors
    };

  } catch (err) {
    warn('Erro ao processar Shapefile:', err);
    return {
      text: '',
      count: 0,
      errors: [`Erro no processamento do Shapefile: ${err.message}`]
    };
  }
}
