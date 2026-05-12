/**
 * @file upload-worker.js
 * @description Web Worker auto-contido para parsing pesado de arquivos CSV, TXT e KML.
 *
 * Roda em thread separada para não bloquear a UI durante o processamento.
 * Comunicação via postMessage:
 *   ← { type:'parse', ext, text }
 *   → { type:'progress', pct, message }
 *   → { type:'done', text, count, errors }
 *   → { type:'error', message }
 *
 * IMPORTANTE: este arquivo é um Worker clássico (sem import/export ES module).
 * Toda a lógica de parsing é inline e auto-contida.
 */

'use strict';

const COORD_PRECISION = 8;

// ─── CSV / TXT ────────────────────────────────────────────────────────────────

/**
 * Normaliza linhas de arquivo CSV/TXT para o formato interno CGRN.
 * Formato esperado por coluna: glebaId, ordemPonto, latitude, longitude.
 * Reporta progresso a cada 5% das linhas processadas.
 *
 * @param {string} raw  - Texto bruto do arquivo
 * @param {string} ext  - 'csv' | 'txt'
 * @returns {string}    - Linhas no formato "id ordem lat lon"
 */
function normalizeFlatFile(raw, ext) {
  const allLines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'));

  const total = allLines.length;
  const result = [];
  let lastReportPct = 0;

  for (let i = 0; i < total; i++) {
    const l = allLines[i];

    let parts = ext === 'csv'
      ? (l.includes(';')
        ? l.split(';').map(v => v.trim().replace(',', '.'))
        : l.split(',').map(v => v.trim()))
      : l.trim().split(/\s+/);

    parts = parts.map(v => v.replace(/^["']|["']$/g, '').trim());

    // Descarta linhas com valores não numéricos (cabeçalho, comentários)
    if (parts.some(v => isNaN(Number(v)))) continue;

    if (parts.length >= 4) {
      result.push(parts.slice(0, 4).join(' '));
    }

    // Reporta progresso a cada 5% para não saturar a fila de mensagens
    const pct = Math.floor((i / total) * 80) + 10; // escala de 10% a 90%
    if (pct >= lastReportPct + 5) {
      lastReportPct = pct;
      self.postMessage({
        type: 'progress',
        pct,
        message: `Processando linha ${i + 1} de ${total}…`,
      });
    }
  }

  return result.join('\n');
}

// ─── KML ──────────────────────────────────────────────────────────────────────

/**
 * Converte texto KML para o formato interno CGRN.
 * Suporta Placemark > Polygon e MultiGeometry.
 * DOMParser está disponível em Workers modernos (Chrome 60+, Firefox 61+, Safari 15+).
 *
 * @param {string} kmlText
 * @returns {{ text: string, count: number, errors: string[] }}
 */
function kmlToCoordText(kmlText) {
  const errors = [];
  const lines = [];
  let glebaId = 1;

  // Parse XML
  let doc;
  try {
    doc = new DOMParser().parseFromString(kmlText, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML inválido: ' + parseError.textContent.slice(0, 120));
    }
  } catch (e) {
    return { text: '', count: 0, errors: ['Erro ao parsear KML: ' + e.message] };
  }

  /**
   * Processa um único elemento <Polygon> e adiciona linhas ao array `lines`.
   */
  function processPolygon(poly, nome) {
    // Prefere outerBoundaryIs, mas aceita coordinates solto
    const coordEl = poly.querySelector('outerBoundaryIs coordinates, coordinates');
    if (!coordEl) return;

    const rawCoords = coordEl.textContent.trim();
    const pairs = rawCoords.split(/[\s\n\r]+/);
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
      errors.push(`Placemark "${nome}": polígono com menos de 3 pontos válidos — ignorado.`);
      return;
    }

    // Fecha o polígono se necessário
    const [f0lat, f0lon] = pontos[0];
    const [flLat, flLon] = pontos[pontos.length - 1];
    if (Math.abs(f0lat - flLat) > 1e-8 || Math.abs(f0lon - flLon) > 1e-8) {
      pontos.push([f0lat, f0lon]);
    }

    pontos.forEach(([lat, lon], i) => {
      lines.push(
        glebaId + ' ' + (i + 1) + ' ' +
        lat.toFixed(COORD_PRECISION) + ' ' +
        lon.toFixed(COORD_PRECISION)
      );
    });

    glebaId++;
  }

  // Coleta placemarks
  const placemarks = [...doc.querySelectorAll('Placemark')];

  if (!placemarks.length) {
    // Tenta polígonos soltos (KML não-padrão)
    const directPolys = [...doc.querySelectorAll('Polygon')];
    if (!directPolys.length) {
      return { text: '', count: 0, errors: ['Nenhum polígono encontrado no KML.'] };
    }
    const tot = directPolys.length;
    directPolys.forEach((p, i) => {
      processPolygon(p, 'Gleba ' + glebaId);
      const pct = Math.floor((i / tot) * 80) + 10;
      self.postMessage({ type: 'progress', pct, message: `Importando polígono ${i + 1} de ${tot}…` });
    });
  } else {
    const tot = placemarks.length;
    for (let i = 0; i < tot; i++) {
      const pm = placemarks[i];
      const nome = pm.querySelector('name')?.textContent?.trim() || ('Gleba ' + glebaId);
      const polys = [...pm.querySelectorAll('Polygon')];
      for (const poly of polys) processPolygon(poly, nome);

      // Progresso a cada placemark (não satura para KMLs com centenas de polígonos)
      if (i % Math.max(1, Math.floor(tot / 20)) === 0) {
        const pct = Math.floor((i / tot) * 80) + 10;
        self.postMessage({ type: 'progress', pct, message: `Importando gleba ${i + 1} de ${tot}…` });
      }
    }
  }

  if (glebaId === 1) {
    return { text: '', count: 0, errors: ['Nenhum polígono válido encontrado no KML.'] };
  }

  return { text: lines.join('\n'), count: glebaId - 1, errors };
}

// ─── Handler de mensagens ─────────────────────────────────────────────────────

self.onmessage = function (e) {
  const { type, ext, text } = e.data;

  if (type !== 'parse') return;

  self.postMessage({ type: 'progress', pct: 3, message: 'Iniciando análise do arquivo…' });

  try {
    let result;

    if (ext === 'kml') {
      self.postMessage({ type: 'progress', pct: 10, message: 'Lendo estrutura KML…' });
      result = kmlToCoordText(text);

    } else {
      // csv | txt
      self.postMessage({ type: 'progress', pct: 10, message: 'Normalizando coordenadas…' });
      const normalized = normalizeFlatFile(text, ext);
      const uniqueIds = new Set(
        normalized.split('\n').filter(Boolean).map(l => l.split(' ')[0])
      );
      result = { text: normalized, count: uniqueIds.size, errors: [] };
    }

    self.postMessage({ type: 'progress', pct: 98, message: 'Finalizando…' });
    self.postMessage({ type: 'done', ...result });

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err.message || 'Erro desconhecido durante o processamento.',
    });
  }
};