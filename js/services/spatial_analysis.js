/**
 * @file spatial_analysis.js
 * @description Lógica de análise espacial e processamento de geometrias.
 */

import { log, warn } from '../components/ui.js';

/**
 * Normaliza qualquer geometria GeoJSON (Polygon ou MultiPolygon) em um único
 * Feature Turf compatível com todas as operações espaciais.
 *
 * @param {object} geometry  - GeoJSON geometry object
 * @returns {Feature|null}
 */
export function normalizarGeometriaCAR(geometry) {
  if (!geometry) return null;
  try {
    if (geometry.type === 'Polygon') {
      return turf.feature(geometry);
    }

    if (geometry.type === 'MultiPolygon') {
      const colecao = turf.flatten(turf.feature(geometry));
      if (colecao.features.length === 0) return null;
      if (colecao.features.length === 1) return colecao.features[0];

      log(`normalizarGeometriaCAR: Unindo ${colecao.features.length} polígonos de MultiPolygon...`);
      
      // Une polígonos um a um, tratando possíveis erros topológicos
      let acc = colecao.features[0];
      for (let i = 1; i < colecao.features.length; i++) {
        try {
          const union = turf.union(acc, colecao.features[i]);
          if (union) acc = union;
          else warn(`Falha ao unir parte ${i} do MultiPolygon — geometria ignorada.`);
        } catch (err) {
          warn(`Erro topológico na união do MultiPolygon (parte ${i}):`, err.message);
        }
      }
      return acc;
    }

    warn('normalizarGeometriaCAR: tipo de geometria não suportado:', geometry.type);
    return null;
  } catch (e) {
    warn('normalizarGeometriaCAR erro:', e.message);
    return null;
  }
}

/**
 * Analisa a relação espacial entre a gleba e os imóveis do CAR encontrados.
 * 
 * @param {GlebaData}   gleba
 * @param {CARResult[]} carFeatures
 * @returns {object}
 */
export function analyzeGlebaInCAR(gleba, carFeatures) {
  if (!carFeatures || carFeatures.length === 0) {
    return {
      status: 'bloqueio',
      mensagem: 'Nenhum Cadastro Ambiental Rural (CAR) localizado para esta geometria.',
      dados: [],
      coverage: 0,
      coverageMelhorCAR: 0,
      uncoveredHa: turf.area(gleba.turfPolygon) / 10000,
      carAreaHa: 0,
      nCARs: 0,
    };
  }

  const glebaPoly = gleba.turfPolygon;
  const glebaAreaM2 = turf.area(glebaPoly);
  const glebaAreaHa = glebaAreaM2 / 10000;

  const featuresNormalizadas = carFeatures.map(car => ({
    ...car,
    _featNorm: car.geometry ? normalizarGeometriaCAR(car.geometry) : null,
  }));

  const featuresComGeo = featuresNormalizadas.filter(f => f._featNorm !== null);

  if (featuresComGeo.length === 0) {
    const maisDeUm = carFeatures.length > 1;
    return {
      status: maisDeUm ? 'alerta' : 'ok',
      mensagem: maisDeUm
        ? `Gleba abrange ${carFeatures.length} imóveis CAR (geometria indisponível).`
        : `Imóvel Rural localizado: ${carFeatures[0].codigo} (geometria indisponível).`,
      dados: carFeatures,
      coverage: 100,
      coverageMelhorCAR: 100,
      uncoveredHa: 0,
      carAreaHa: carFeatures.reduce((s, c) => s + (c.areaHa || 0), 0),
      nCARs: carFeatures.length,
    };
  }

  try {
    const analiseIndividual = featuresComGeo.map(car => {
      try {
        const intersecao = turf.intersect(glebaPoly, car._featNorm);
        const areaIntersM2 = intersecao ? turf.area(intersecao) : 0;
        const covRaw = (areaIntersM2 / glebaAreaM2) * 100;
        const cov = covRaw > 99.9 ? 100 : Math.round(covRaw * 10) / 10;
        return { ...car, _featNorm: undefined, coverageIndividual: cov };
      } catch (err) {
        return { ...car, _featNorm: undefined, coverageIndividual: 0 };
      }
    });

    const semGeo = featuresNormalizadas
      .filter(f => f._featNorm === null)
      .map(car => ({ ...car, _featNorm: undefined, coverageIndividual: 0 }));

    const todosComAnalise = [...analiseIndividual, ...semGeo];
    todosComAnalise.sort((a, b) => b.coverageIndividual - a.coverageIndividual);

    const melhorCAR = todosComAnalise[0];
    const nCARs = todosComAnalise.length;

    let carUnion = featuresComGeo[0]._featNorm;
    for (let i = 1; i < featuresComGeo.length; i++) {
      try {
        const u = turf.union(carUnion, featuresComGeo[i]._featNorm);
        if (u) carUnion = u;
      } catch (_) {}
    }

    const intersTotal = turf.intersect(glebaPoly, carUnion);
    const covTotalRaw = intersTotal ? (turf.area(intersTotal) / glebaAreaM2) * 100 : 0;
    const coverageTotal = covTotalRaw > 99.9 ? 100 : Math.round(covTotalRaw * 10) / 10;
    const uncoveredHa = Math.max(0, glebaAreaHa * (1 - coverageTotal / 100));

    let status, mensagem;
    const listaCAR = todosComAnalise
      .map(c => `${c.codigo}${c.coverageIndividual > 0 ? ` (${c.coverageIndividual}%)` : ''}`)
      .join(', ');

    if (nCARs === 1) {
      const cov = melhorCAR.coverageIndividual;
      if (cov >= 98) {
        status = 'ok';
        mensagem = `Gleba em conformidade com o CAR ${melhorCAR.codigo}.`;
      } else if (cov >= 10) {
        status = 'alerta';
        mensagem = `Gleba parcialmente fora do CAR ${melhorCAR.codigo} (${cov}%).`;
      } else {
        status = 'bloqueio';
        mensagem = `Gleba com baixa cobertura no CAR ${melhorCAR.codigo} (${cov}%).`;
      }
    } else {
      if (melhorCAR.coverageIndividual >= 98) {
        status = 'alerta';
        mensagem = `Gleba contida no CAR ${melhorCAR.codigo}, mas há sobreposição com outros imóveis.`;
      } else if (coverageTotal >= 98) {
        status = 'alerta';
        mensagem = `Gleba dividida entre ${nCARs} imóveis (cruza fronteiras).`;
      } else {
        status = 'bloqueio';
        mensagem = `Gleba parcialmente fora dos ${nCARs} CARs detectados.`;
      }
    }

    return {
      status,
      mensagem,
      dados: todosComAnalise,
      coverage: coverageTotal,
      coverageMelhorCAR: melhorCAR.coverageIndividual,
      uncoveredHa: parseFloat(uncoveredHa.toFixed(4)),
      carAreaHa: todosComAnalise.reduce((s, f) => s + (f.areaHa || 0), 0),
      nCARs,
    };
  } catch (e) {
    warn('analyzeGlebaInCAR: erro inesperado:', e.message);
    return { status: 'info', mensagem: 'Erro no cálculo espacial.', dados: carFeatures, coverage: 0, coverageMelhorCAR: 0, uncoveredHa: glebaAreaHa, carAreaHa: 0, nCARs: 0 };
  }
}
