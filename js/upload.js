/**
 * @file upload.js — v3.0
 * @description Importação de coordenadas via CSV, TXT e KML.
 */

import { setCoordText, showMessage, showToast, log, warn } from './ui.js';
import { kmlToCoordText } from './kml.js';

export function initFileUpload(fileInput) {
  if (!fileInput) return;
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv','txt','kml'].includes(ext)) {
      showMessage('Formato não suportado. Use .csv, .txt ou .kml', 'warning');
      fileInput.value = '';
      return;
    }
    try {
      const text = await readText(file);
      let normalized = '', count = 0, errors = [];

      if (ext === 'kml') {
        const res = kmlToCoordText(text);
        normalized = res.text;
        count      = res.count;
        errors     = res.errors;
      } else {
        normalized = normalizeFlatFile(text, ext);
        count      = normalized.split('\n').filter(l=>l.trim()).length;
      }

      if (errors.length) showMessage(errors, 'warning');

      if (!normalized.trim()) {
        showMessage('Arquivo vazio ou sem coordenadas reconhecíveis.', 'warning');
        return;
      }

      setCoordText(normalized);
      showToast(`"${file.name}" importado — ${count} gleba(s)/${normalized.split('\n').filter(Boolean).length} linha(s).`, 'success', 4000);
      log('Upload:', file.name, count, 'glebas');
    } catch (err) {
      warn('Upload erro:', err);
      showMessage('Erro ao ler o arquivo: ' + err.message, 'danger');
    } finally {
      fileInput.value = '';
    }
  });
}

function readText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('Falha na leitura'));
    r.readAsText(file, 'UTF-8');
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
