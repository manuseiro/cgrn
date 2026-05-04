/**
 * @file upload.js — v3.5
 * @description Importação de coordenadas via CSV, TXT, KML e Shapefile (.zip).
 */

import { setCoordText, showMessage, showToast, log, warn } from '../components/ui.js';
import { kmlToCoordText } from '../utils/kml.js';
import { shapefileToCoordText } from '../utils/shapefile.js';

export function initFileUpload(fileInput) {
  if (!fileInput) return;
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['csv', 'txt', 'kml', 'zip'];
    
    if (!validExts.includes(ext)) {
      showMessage(`Formato não suportado. Use ${validExts.map(x => '.' + x.toUpperCase()).join(', ')}`, 'warning');
      fileInput.value = '';
      return;
    }

    try {
      let normalized = '', count = 0, errors = [];

      if (ext === 'zip') {
        const buffer = await readArrayBuffer(file);
        const res = await shapefileToCoordText(buffer);
        normalized = res.text;
        count      = res.count;
        errors     = res.errors;
      } else if (ext === 'kml') {
        const text = await readText(file);
        const res = kmlToCoordText(text);
        normalized = res.text;
        count      = res.count;
        errors     = res.errors;
      } else {
        const text = await readText(file);
        normalized = normalizeFlatFile(text, ext);
        count      = normalized.split('\n').filter(l => l.trim() && !l.startsWith('#')).length / 4; // Estimativa bruta (pode variar se houver headers)
        // Recalcula count baseado no número de IDs únicos na primeira coluna
        const uniqueIds = new Set(normalized.split('\n').filter(Boolean).map(l => l.split(' ')[0]));
        count = uniqueIds.size;
      }

      if (errors.length) {
        showMessage(errors, 'warning');
      }

      if (!normalized.trim()) {
        if (!errors.length) showMessage('Arquivo vazio ou sem coordenadas reconhecíveis.', 'warning');
        return;
      }

      setCoordText(normalized);
      showToast(`"${file.name}" importado — ${count} gleba(s).`, 'success', 5000);
      log('Upload:', file.name, count, 'glebas');
      
    } catch (err) {
      warn('Upload erro:', err);
      showMessage('Erro ao processar arquivo: ' + err.message, 'danger');
    } finally {
      fileInput.value = '';
    }
  });
}

function readText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('Falha na leitura do texto'));
    r.readAsText(file, 'UTF-8');
  });
}

function readArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('Falha na leitura do binário'));
    r.readAsArrayBuffer(file);
  });
}

function normalizeFlatFile(raw, ext) {
  return raw
    .replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      let parts = ext === 'csv'
        ? (l.includes(';') ? l.split(';').map(v=>v.trim().replace(',','.')) : l.split(',').map(v=>v.trim()))
        : l.trim().split(/\s+/);
      parts = parts.map(v => v.replace(/^["']|["']$/g,'').trim());
      if (parts.some(v => isNaN(Number(v)) && /gleba|ponto|lat|lon/i.test(v))) return null; // header
      return parts.length >= 4 ? parts.slice(0,4).join(' ') : null;
    })
    .filter(Boolean)
    .join('\n');
}
