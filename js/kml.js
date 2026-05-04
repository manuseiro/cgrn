/**
 * @file kml.js — v3.0
 * @description Import e export de arquivos KML para o formato interno da aplicação.
 *
 * KML é o formato padrão do Google Earth e amplamente aceito por receptores
 * GPS e SIG. Implementado sem dependências externas (DOM Parser nativo).
 *
 * Import: KML → coordenadas no formato textarea (glebaId pontoId lat lon)
 * Export: GlebaData[] → KML com estilo visual e dados das glebas
 */

import { log, warn, showToast, setCoordText } from './ui.js';

// ─── KML IMPORT ──────────────────────────────────────────────────────────────

/**
 * Converte um arquivo KML para o formato de textarea da aplicação.
 * Suporta Placemark > Polygon > outerBoundaryIs > coordinates.
 * Múltiplos Placemarks viram múltiplas glebas.
 *
 * @param {string} kmlText - Conteúdo do arquivo KML
 * @returns {{ text: string, count: number, errors: string[] }}
 */
export function kmlToCoordText(kmlText) {
  const errors = [];
  const lines  = [];
  let glebaId  = 1;

  let doc;
  try {
    doc = new DOMParser().parseFromString(kmlText, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML inválido: ' + parseError.textContent.slice(0, 100));
  } catch (e) {
    return { text: '', count: 0, errors: [`Erro ao parsear KML: ${e.message}`] };
  }

  // Suporta Polygon direto e MultiGeometry com Polygons
  const placemarks = [...doc.querySelectorAll('Placemark')];
  if (!placemarks.length) {
    return { text: '', count: 0, errors: ['Nenhum Placemark encontrado no KML.'] };
  }

  for (const pm of placemarks) {
    // Pega o nome do placemark para informação
    const nome = pm.querySelector('name')?.textContent?.trim() ?? `Gleba ${glebaId}`;

    // Coleta todos os polígonos (pode ser MultiGeometry)
    const polygons = [...pm.querySelectorAll('Polygon')];
    if (!polygons.length) continue; // Ignora pontos/linhas

    for (const poly of polygons) {
      const coordEl = poly.querySelector('outerBoundaryIs coordinates, coordinates');
      if (!coordEl) continue;

      const rawCoords = coordEl.textContent.trim();
      const pairs = rawCoords.split(/\s+/);
      const pontos = [];

      for (const pair of pairs) {
        if (!pair.trim()) continue;
        const parts = pair.split(',');
        if (parts.length < 2) continue;
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (isNaN(lon) || isNaN(lat)) continue;
        pontos.push([lat, lon]);
      }

      if (pontos.length < 3) {
        errors.push(`Placemark "${nome}": polígono com menos de 3 pontos, ignorado.`);
        continue;
      }

      // Fecha o polígono se necessário
      const [f0lat, f0lon] = pontos[0];
      const [flLat, flLon] = pontos[pontos.length - 1];
      if (f0lat !== flLat || f0lon !== flLon) {
        pontos.push([f0lat, f0lon]);
      }

      // Gera linhas no formato: glebaId pontoId lat lon
      pontos.forEach(([lat, lon], i) => {
        lines.push(`${glebaId} ${i + 1} ${lat.toFixed(6)} ${lon.toFixed(6)}`);
      });

      log(`KML: gleba ${glebaId} "${nome}" com ${pontos.length} pontos`);
      glebaId++;
    }
  }

  if (glebaId === 1) {
    return { text: '', count: 0, errors: ['Nenhum polígono válido encontrado no KML.'] };
  }

  return { text: lines.join('\n'), count: glebaId - 1, errors };
}

// ─── KML EXPORT ──────────────────────────────────────────────────────────────

/**
 * Gera conteúdo KML a partir das GlebaData[].
 * Inclui metadados (área, perímetro, municípios, TI, conformidade) e estilo visual.
 *
 * @param {GlebaData[]} glebas
 * @param {string}      [projectName] - Nome do projeto (para Document/name)
 * @returns {string} KML completo como string
 */
export function glebesToKML(glebas, projectName = 'Glebas CGRN') {
  if (!glebas.length) return '';

  const now = new Date().toISOString();

  // ── Estilos ────────────────────────────────────────────────────────────
  const styles = `
  <Style id="glebaOk">
    <LineStyle><color>ff4287f5</color><width>2</width></LineStyle>
    <PolyStyle><color>664287f5</color></PolyStyle>
  </Style>
  <Style id="glebaAlerta">
    <LineStyle><color>ff0000ff</color><width>2.5</width></LineStyle>
    <PolyStyle><color>660000ff</color></PolyStyle>
  </Style>
  <Style id="glebaConflito">
    <LineStyle><color>ff0033ff</color><width>3</width></LineStyle>
    <PolyStyle><color>990033ff</color></PolyStyle>
  </Style>`.trim();

  // ── Placemarks ─────────────────────────────────────────────────────────
  const placemarks = glebas.map(g => {
    // Determina estilo baseado nos flags de conformidade
    const tiOk    = !g.tiIntersecoes?.length;
    const confOk  = !g.conformidade?.reprovada;
    const styleId = tiOk && confOk ? 'glebaOk'
                  : !tiOk          ? 'glebaConflito'
                  : 'glebaAlerta';

    // Coordenadas KML: lon,lat,altitude
    const coords = g.geoJsonCoords
      .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)},0`)
      .join('\n          ');

    // Descrição HTML para o balão do Google Earth
    const tiInfo   = g.tiIntersecoes?.length
      ? `<li>🚫 TI: ${g.tiIntersecoes.map(t => t.nome).join(', ')}</li>` : '';
    const confInfo = g.conformidade?.itens?.filter(i => i.status !== 'ok')
      .map(i => `<li>⚠️ ${i.descricao}</li>`).join('') ?? '';

    const desc = `<![CDATA[
      <b>Gleba ${g.glebaId}</b><br>
      <table border="0" cellpadding="3">
        <tr><td>Área:</td><td><b>${g.area.toFixed(4)} ha</b></td></tr>
        <tr><td>Perímetro:</td><td>${(g.perimeter/1000).toFixed(3)} km</td></tr>
        <tr><td>Municípios:</td><td>${g.municipioCount}</td></tr>
        <tr><td>Semiárido:</td><td>${g.semiArido === true ? 'Sim' : g.semiArido === false ? 'Não' : '—'}</td></tr>
        <tr><td>Centroid:</td><td>${g.centroid[1].toFixed(5)}, ${g.centroid[0].toFixed(5)}</td></tr>
      </table>
      ${tiInfo || confInfo ? `<br><b>Restrições:</b><ul>${tiInfo}${confInfo}</ul>` : '<br>✅ Sem restrições detectadas'}
      <br><i>Exportado em: ${now}</i>
    ]]>`;

    return `
  <Placemark>
    <name>Gleba ${g.glebaId}</name>
    <description>${desc}</description>
    <styleUrl>#${styleId}</styleUrl>
    <ExtendedData>
      <Data name="area_ha"><value>${g.area.toFixed(6)}</value></Data>
      <Data name="perimetro_m"><value>${g.perimeter.toFixed(2)}</value></Data>
      <Data name="municipios"><value>${g.municipioCount}</value></Data>
      <Data name="semiarido"><value>${g.semiArido ?? 'nd'}</value></Data>
      <Data name="ti_conflito"><value>${g.tiIntersecoes?.length > 0}</value></Data>
    </ExtendedData>
    <Polygon>
      <extrude>0</extrude>
      <altitudeMode>clampToGround</altitudeMode>
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
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapeXml(projectName)}</name>
    <description>Glebas exportadas pelo CGRN — ${now}</description>
    <open>1</open>
    ${styles}
    ${placemarks}
  </Document>
</kml>`;
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}
