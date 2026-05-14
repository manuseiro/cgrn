/**
 * @file upload.js — v4.0
 * @description Importação de coordenadas via CSV, TXT, KML e Shapefile (.zip).
 *
 * Melhorias v4.0:
 *  • Limite de tamanho por formato (exibe erro claro antes de processar)
 *  • Informações do arquivo exibidas imediatamente após seleção/drop
 *  • Barra de progresso com percentual e mensagem durante leitura e parsing
 *  • Web Worker para CSV/TXT/KML (não bloqueia a thread UI)
 *  • Fallback automático para main thread se o Worker não estiver disponível
 *  • FileReader.onprogress para ZIP com feedback em tempo real
 *  • Drag-and-drop funcional na uploadZone
 */

import { CONFIG } from '../utils/config.js';
import { setCoordText, showMessage, showToast, log, warn } from '../components/ui.js';
import { kmlToCoordText } from '../utils/kml.js';
import { shapefileToCoordText } from '../utils/shapefile.js';

// ─── Limites de tamanho (bytes) ───────────────────────────────────────────────
const getMaxSize = (ext) => {
  const cfg = CONFIG.UPLOAD;
  const mapping = {
    csv: cfg.MAX_CSV_BYTES,
    txt: cfg.MAX_TXT_BYTES, // usa o mesmo do csv como padrão
    kml: cfg.MAX_KML_BYTES,
    zip: cfg.MAX_ZIP_BYTES
  };
  return mapping[ext] || (10 * 1024 * 1024); // fallback 10MB
};

const EXT_ICONS = Object.freeze({
  csv: 'bi-file-earmark-spreadsheet-fill',
  txt: 'bi-file-earmark-text-fill',
  kml: 'bi-geo-alt-fill',
  zip: 'bi-file-earmark-zip-fill',
});

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function getEl(id) { return document.getElementById(id); }

// ─── UI: painel de info do arquivo ───────────────────────────────────────────

function showFileInfo(file, ext) {
  const el = getEl('uploadFileInfo');
  if (!el) return;

  const maxSize = getMaxSize(ext);
  const overLimit = file.size > maxSize;
  const icon = EXT_ICONS[ext] ?? 'bi-file-earmark';

  el.innerHTML =
    '<div class="upload-file-card d-flex align-items-center gap-2 p-2 rounded-3 border bg-body-tertiary">' +
    '<i class="bi ' + icon + ' fs-3 ' + (overLimit ? 'text-danger' : 'text-primary') + ' opacity-75 flex-shrink-0"></i>' +
    '<div class="flex-grow-1 overflow-hidden">' +
    '<div class="fw-semibold small text-truncate" title="' + file.name + '">' + file.name + '</div>' +
    '<div class="d-flex align-items-center gap-2 flex-wrap">' +
    '<span class="' + (overLimit ? 'text-danger fw-bold' : 'text-muted') + ' small">' + formatBytes(file.size) + '</span>' +
    '<span class="badge text-bg-secondary" style="font-size:.62rem">.' + ext.toUpperCase() + '</span>' +
    (overLimit
      ? '<span class="text-danger small"><i class="bi bi-exclamation-triangle-fill me-1"></i>Limite: ' + formatBytes(maxSize) + '</span>'
      : '') +
    '</div>' +
    '</div>' +
    (overLimit
      ? '<i class="bi bi-x-circle-fill text-danger fs-5 flex-shrink-0"></i>'
      : '<i class="bi bi-check-circle-fill text-success fs-5 flex-shrink-0"></i>') +
    '</div>';

  el.classList.remove('d-none');
}

// ─── UI: barra de progresso ───────────────────────────────────────────────────

function showProgress(pct, message) {
  const wrap = getEl('uploadProgress');
  const bar = getEl('uploadProgressBar');
  const msg = getEl('uploadProgressMsg');

  if (!wrap) return;
  wrap.classList.remove('d-none');

  if (bar) {
    const safe = Math.min(Math.max(pct, 0), 100);
    bar.style.width = safe + '%';
    bar.setAttribute('aria-valuenow', safe);
    bar.className = 'progress-bar progress-bar-striped progress-bar-animated '
      + (safe >= 95 ? 'bg-success' : 'bg-primary');
  }

  if (msg && message) msg.textContent = message;
}

function hideProgress() {
  const el = getEl('uploadProgress');
  if (el) el.classList.add('d-none');
}

function resetZoneUI() {
  const info = getEl('uploadFileInfo');
  if (info) info.classList.add('d-none');
  hideProgress();
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export function initFileUpload(fileInput) {
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    fileInput.value = '';
  });

  const zone = getEl('uploadZone');
  if (!zone) return;

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });

  zone.addEventListener('dragend', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  });
}

// ─── Processamento principal ──────────────────────────────────────────────────

async function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const validExts = ['csv', 'txt', 'kml', 'zip'];

  if (!validExts.includes(ext)) {
    showMessage(
      'Formato nao suportado. Use: ' + validExts.map(x => '.' + x.toUpperCase()).join(', '),
      'warning'
    );
    return;
  }

  // 1. Exibe informacoes do arquivo ANTES de qualquer leitura
  showFileInfo(file, ext);

  // 2. Rejeita antes de ler se exceder o limite
  const maxSize = getMaxSize(ext);
  if (file.size > maxSize) {
    showMessage([
      '<i class="bi bi-exclamation-octagon-fill me-1"></i><strong>Arquivo muito grande:</strong> ' + formatBytes(file.size),
      'O limite para arquivos <strong>.' + ext.toUpperCase() + '</strong> e <strong>' + formatBytes(maxSize) + '</strong>.',
      'Dica: divida em partes menores, simplifique a geometria ou use um formato mais compacto.',
    ], 'danger');
    return;
  }

  showProgress(5, 'Iniciando leitura...');

  try {
    var normalized = '', count = 0, errors = [];

    if (ext === 'zip') {
      var buffer = await readArrayBufferWithProgress(file, function (pct) {
        showProgress(pct * 0.5, 'Lendo arquivo... ' + pct + '%');
      });
      showProgress(55, 'Convertendo shapefile...');
      var res = await shapefileToCoordText(buffer);
      normalized = res.text;
      count = res.count;
      errors = res.errors;
      showProgress(95, 'Finalizando...');

    } else {
      // Para KML, CSV e TXT, lemos o texto primeiro
      var text = await readTextWithProgress(file, function (pct) {
        showProgress(pct * 0.35, 'Lendo arquivo... ' + pct + '%');
      });

      if (ext === 'kml') {
        showProgress(40, 'Processando KML...');
        var kmlRes = kmlToCoordText(text);
        normalized = kmlRes.text; 
        count = kmlRes.count; 
        errors = kmlRes.errors;

      } else {
        // csv | txt - utiliza Web Worker para arquivos pesados
        try {
          var result = await parseWithWorker(ext, text, function (prog) {
            showProgress(38 + Math.round(prog.pct * 0.57), prog.message);
          });
          normalized = result.text;
          count = result.count;
          errors = result.errors;

        } catch (workerErr) {
          warn('[upload] Worker falhou, usando main thread:', workerErr.message);
          showProgress(40, 'Processando (modo compatibilidade)...');
          normalized = normalizeFlatFile(text, ext);
          var ids = new Set(normalized.split('\n').filter(Boolean).map(function (l) { return l.split(' ')[0]; }));
          count = ids.size;
        }
      }
    }

    showProgress(100, 'Concluido!');

    if (errors.length) showMessage(errors, 'warning');

    if (!normalized.trim()) {
      if (!errors.length) showMessage('Arquivo vazio ou sem coordenadas reconheciveis.', 'warning');
      hideProgress();
      return;
    }

    setCoordText(normalized);
    showToast('"' + file.name + '" importado - ' + count + ' gleba(s).', 'success', 5000);
    log('[upload]', file.name, count, 'gleba(s)');

    setTimeout(resetZoneUI, 1800);

  } catch (err) {
    warn('[upload] Erro:', err);
    showMessage('Erro ao processar arquivo: ' + err.message, 'danger');
    hideProgress();
  }
}

// ─── Web Worker ───────────────────────────────────────────────────────────────

function parseWithWorker(ext, text, onProgress) {
  return new Promise(function (resolve, reject) {
    var workerUrl = new URL('../workers/upload-worker.js', import.meta.url).href;

    var worker;
    try {
      worker = new Worker(workerUrl);
    } catch (e) {
      reject(new Error('Web Worker indisponivel: ' + e.message));
      return;
    }

    var deadline = setTimeout(function () {
      worker.terminate();
      reject(new Error('Tempo limite excedido no processamento do arquivo.'));
    }, 120000);

    worker.onmessage = function (e) {
      var data = e.data;
      if (data.type === 'progress') {
        onProgress({ pct: data.pct, message: data.message });
      } else if (data.type === 'done') {
        clearTimeout(deadline);
        worker.terminate();
        resolve({ text: data.text, count: data.count, errors: data.errors || [] });
      } else if (data.type === 'error') {
        clearTimeout(deadline);
        worker.terminate();
        reject(new Error(data.message));
      }
    };

    worker.onerror = function (e) {
      clearTimeout(deadline);
      worker.terminate();
      reject(new Error(e.message || 'Erro interno no Worker.'));
    };

    worker.postMessage({ type: 'parse', ext: ext, text: text });
  });
}

// ─── FileReader com progresso ─────────────────────────────────────────────────

function readTextWithProgress(file, onProgress) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onprogress = function (e) {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = function (e) { onProgress(100); resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Falha na leitura do arquivo de texto.')); };
    reader.readAsText(file, 'UTF-8');
  });
}

function readArrayBufferWithProgress(file, onProgress) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onprogress = function (e) {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = function (e) { onProgress(100); resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Falha na leitura do arquivo binario.')); };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Normalização CSV/TXT — fallback main thread ───────────────────────────────

function normalizeFlatFile(raw, ext) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(function (l) { return l.trim() && !l.trim().startsWith('#'); })
    .map(function (l) {
      var parts = ext === 'csv'
        ? (l.includes(';')
          ? l.split(';').map(function (v) { return v.trim().replace(',', '.'); })
          : l.split(',').map(function (v) { return v.trim(); }))
        : l.trim().split(/\s+/);

      parts = parts.map(function (v) { return v.replace(/^["']|["']$/g, '').trim(); });
      if (parts.some(function (v) { return isNaN(Number(v)); })) return null;
      return parts.length >= 4 ? parts.slice(0, 4).join(' ') : null;
    })
    .filter(Boolean)
    .join('\n');
}