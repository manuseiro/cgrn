/**
 * @file kml.js — v3.5
 * @description Import e export de arquivos KML para o formato interno da aplicação.
 *
 * KML é o formato padrão do Google Earth e amplamente aceito por receptores
 * GPS e SIG. Implementado sem dependências externas (DOM Parser nativo).
 *
 * Import: KML → coordenadas no formato textarea (glebaId pontoId lat lon)
 * Export: GlebaData[] → KML com estilo visual e dados das glebas
 */

import { CONFIG } from './config.js';
import { log, warn, showToast, setCoordText } from '../components/ui.js';

const { COORD_PRECISION } = CONFIG.VALIDATION;

// ─── KML IMPORT ──────────────────────────────────────────────────────────────

/**
 * Converte um arquivo KML para o formato de textarea da aplicação.
 * Suporta Placemark > Polygon, MultiPolygon, MultiGeometry.
 * Extrai nomes e trata altitudes.
 *
 * @param {string} kmlText - Conteúdo do arquivo KML
 * @returns {{ text: string, count: number, errors: string[] }}
 */
export function kmlToCoordText(kmlText) {
  const errors = [];
  const lines = [];
  let glebaId = 1;

  let doc;
  try {
    doc = new DOMParser().parseFromString(kmlText, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML inválido: ' + parseError.textContent.slice(0, 100));
  } catch (e) {
    return { text: '', count: 0, errors: [`Erro ao parsear KML: ${e.message}`] };
  }

  // Suporta Placemarks que podem conter Polygons ou MultiGeometry
  const placemarks = [...doc.querySelectorAll('Placemark')];
  if (!placemarks.length) {
    // Tenta procurar Polygons soltos caso não haja Placemarks (raro mas possível)
    const directPolygons = [...doc.querySelectorAll('Polygon')];
    if (!directPolygons.length) {
      return { text: '', count: 0, errors: ['Nenhum polígono encontrado no KML.'] };
    }
    // Cria placemarks virtuais para os polígonos soltos
    directPolygons.forEach(p => processPolygon(p, `Gleba ${glebaId}`));
  } else {
    for (const pm of placemarks) {
      const nome = pm.querySelector('name')?.textContent?.trim() || `Gleba ${glebaId}`;

      // Coleta todos os polígonos dentro do Placemark (suporta MultiGeometry)
      const polygons = [...pm.querySelectorAll('Polygon')];
      if (!polygons.length) continue;

      for (const poly of polygons) {
        processPolygon(poly, nome);
      }
    }
  }

  function processPolygon(poly, nome) {
    const coordEl = poly.querySelector('outerBoundaryIs coordinates, coordinates');
    if (!coordEl) return;

    const rawCoords = coordEl.textContent.trim();
    // Split por espaços ou quebras de linha
    const pairs = rawCoords.split(/[\s\n\r]+/);
    const pontos = [];

    for (const pair of pairs) {
      if (!pair.trim()) continue;
      const parts = pair.split(',');
      if (parts.length < 2) continue;

      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      // Ignora altitude se houver (parts[2])

      if (isNaN(lon) || isNaN(lat)) continue;
      pontos.push([lat, lon]);
    }

    if (pontos.length < 3) {
      errors.push(`Placemark "${nome}": polígono com menos de 3 pontos, ignorado.`);
      return;
    }

    // Fecha o polígono se necessário para o formato interno
    const [f0lat, f0lon] = pontos[0];
    const [flLat, flLon] = pontos[pontos.length - 1];
    if (Math.abs(f0lat - flLat) > 1e-8 || Math.abs(f0lon - flLon) > 1e-8) {
      pontos.push([f0lat, f0lon]);
    }

    // Gera linhas no formato: glebaId pontoId lat lon
    pontos.forEach(([lat, lon], i) => {
      lines.push(`${glebaId} ${i + 1} ${lat.toFixed(COORD_PRECISION)} ${lon.toFixed(COORD_PRECISION)}`);
    });

    log(`KML: gleba ${glebaId} "${nome}" com ${pontos.length} pontos`);
    glebaId++;
  }

  if (glebaId === 1) {
    return { text: '', count: 0, errors: ['Nenhum polígono válido encontrado no KML.'] };
  }

  return { text: lines.join('\n'), count: glebaId - 1, errors };
}

// ─── KML EXPORT ──────────────────────────────────────────────────────────────

/**
 * Gera conteúdo KML a partir das GlebaData[].
 * Inclui metadados detalhados e estilo visual inteligente.
 *
 * @param {GlebaData[]} glebas
 * @param {string}      [projectName] - Nome do projeto
 * @returns {string} KML completo
 */
export function glebesToKML(glebas, projectName = 'Glebas CGRN') {
  if (!glebas.length) return '';

  const now = new Date().toLocaleString('pt-BR');

  // ── Estilos (Cores Profissionais) ──────────────────────────────────────
  const styles = `
  <Style id="glebaOk">
    <LineStyle><color>ff4CAF50</color><width>2</width></LineStyle>
    <PolyStyle><color>444CAF50</color></PolyStyle>
  </Style>
  <Style id="glebaAlerta">
    <LineStyle><color>ff00C8FF</color><width>2.5</width></LineStyle>
    <PolyStyle><color>4400C8FF</color></PolyStyle>
  </Style>
  <Style id="glebaConflito">
    <LineStyle><color>ff5252FF</color><width>3</width></LineStyle>
    <PolyStyle><color>665252FF</color></PolyStyle>
  </Style>`.trim();

  // ── Placemarks ─────────────────────────────────────────────────────────
  const placemarks = glebas.map(g => {
    // Determina estilo baseado nos flags de conformidade e TI
    const tiOk = !g.tiIntersecoes?.length;
    const conf = g.conformidade;
    const isReprovada = conf?.reprovada;
    const temAlerta = conf?.temAlerta;

    const styleId = isReprovada || !tiOk ? 'glebaConflito'
      : temAlerta ? 'glebaAlerta'
        : 'glebaOk';

    // Coordenadas KML: lon,lat,altitude
    const coords = g.geoJsonCoords
      .map(([lon, lat]) => `${lon.toFixed(COORD_PRECISION)},${lat.toFixed(COORD_PRECISION)},0`)
      .join('\n          ');

    // Metadados para o balão
    const carItem = conf?.itens?.find(i => i.id === 'car');
    const coverage = carItem?.coverage ?? 0;
    const carArea = carItem?.carAreaHa ? `${carItem.carAreaHa.toFixed(2)} ha` : 'N/A';

    const tiInfo = g.tiIntersecoes?.length
      ? `<tr style="color:#d32f2f"><td>Terras Indígenas:</td><td><b>${g.tiIntersecoes.map(t => t.nome).join(', ')}</b></td></tr>` : '';

    const statusText = isReprovada ? 'REPROVADA' : temAlerta ? 'RESSALVAS' : 'APROVADA';
    const statusColor = isReprovada ? '#d32f2f' : temAlerta ? '#f57c00' : '#388e3c';

    const desc = `<![CDATA[
      <div style="font-family: sans-serif; min-width: 250px;">
        <h3 style="margin-top:0; color:#333;">Gleba ${g.glebaId}</h3>
        <p style="font-size:14px; font-weight:bold; color:${statusColor}; border-bottom:1px solid #eee; padding-bottom:5px;">
          STATUS: ${statusText}
        </p>
        <table border="0" cellpadding="3" style="font-size:12px; width:100%;">
          <tr><td style="color:#666">Área Total:</td><td><b>${g.area.toFixed(4)} ha</b></td></tr>
          <tr><td style="color:#666">Perímetro:</td><td>${(g.perimeter / 1000).toFixed(3)} km</td></tr>
          <tr><td style="color:#666">Municípios:</td><td>${g.municipioCount}</td></tr>
          <tr><td style="color:#666">Cobertura CAR:</td><td>${coverage}%</td></tr>
          <tr><td style="color:#666">Área no CAR:</td><td>${carArea}</td></tr>
          <tr><td style="color:#666">Semiárido:</td><td>${g.semiArido ? 'Sim' : 'Não'}</td></tr>
          ${tiInfo}
        </table>
        <div style="margin-top:10px; font-size:10px; color:#999; border-top:1px solid #eee; pt-5px;">
          Exportado pelo GlebasNord em ${now}<br>
          Coordenadas: ${g.centroid[1].toFixed(5)}, ${g.centroid[0].toFixed(5)}
        </div>
      </div>
    ]]>`;

    return `
  <Placemark>
    <name>Gleba ${g.glebaId} - ${g.area.toFixed(2)}ha</name>
    <description>${desc}</description>
    <styleUrl>#${styleId}</styleUrl>
    <ExtendedData>
      <Data name="ID"><value>${g.glebaId}</value></Data>
      <Data name="AREA_HA"><value>${g.area.toFixed(6)}</value></Data>
      <Data name="PERIM_M"><value>${g.perimeter.toFixed(2)}</value></Data>
      <Data name="MUNICIPIOS"><value>${g.municipioCount}</value></Data>
      <Data name="COBERTURA_CAR"><value>${coverage}</value></Data>
      <Data name="SEMIARIDO"><value>${g.semiArido ? 'SIM' : 'NAO'}</value></Data>
      <Data name="STATUS"><value>${statusText}</value></Data>
    </ExtendedData>
    <Polygon>
      <tessellate>1</tessellate>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
          ${coords}
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`.trim();
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(projectName)}</name>
    <description>Glebas exportadas pelo CGRN — ${now}</description>
    ${styles}
    ${placemarks}
  </Document>
</kml>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
