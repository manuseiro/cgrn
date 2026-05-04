/**
 * @file ui.js — v3.0
 * @description Toda manipulação de DOM, toasts, tabelas e helpers de UI.
 */

import { CONFIG } from '../utils/config.js';
import { state } from '../utils/state.js';
import { el, log, warn } from './dom.js';

export { el, log, warn };

// ─── Toast ────────────────────────────────────────────────────────────────
let _tc = 0;

export function showToast(message, type = 'info', delay = 4500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = {
    success: '<i class="bi bi-check-circle-fill"></i>',
    danger: '<i class="bi bi-x-circle-fill"></i>',
    warning: '<i class="bi bi-exclamation-triangle-fill"></i>',
    info: '<i class="bi bi-info-circle-fill"></i>'
  };
  const id = `toast-${++_tc}`;
  const body = Array.isArray(message)
    ? `<ul class="mb-0 ps-3">${message.map(m => `<li>${m}</li>`).join('')}</ul>`
    : message;

  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast" role="alert" aria-atomic="true">
      <div class="toast-header bg-${type} text-white">
        <span class="me-2">${icons[type] ?? 'ℹ️'}</span>
        <strong class="me-auto">CGRN</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body" style="font-size:.84rem">${body}</div>
    </div>`);

  const node = document.getElementById(id);
  const toast = new bootstrap.Toast(node, { delay: delay || 99999, autohide: delay > 0 });
  toast.show();
  node.addEventListener('hidden.bs.toast', () => node.remove());
}

// ─── Mensagens inline ─────────────────────────────────────────────────────
export function showMessage(msg, type = 'info', autoDismiss = 0) {
  _inline(el.msgGleba, msg, type, autoDismiss);
}
export function showProjectMessage(msg, type = 'info', autoDismiss = 0) {
  _inline(el.msgProjeto, msg, type, autoDismiss);
}
function _inline(area, msg, type, ms) {
  if (!area) return;
  const body = Array.isArray(msg)
    ? `<ul class="mb-0 ps-3 small">${msg.map(m => `<li>${m}</li>`).join('')}</ul>`
    : `<span class="small">${msg}</span>`;
  area.innerHTML = `
    <div class="alert alert-${type} alert-dismissible mb-0 py-2 animate-fadein" role="alert">
      ${body}
      <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert"></button>
    </div>`;
  if (ms > 0) setTimeout(() => { area.innerHTML = ''; }, ms);
}
export function clearMessage() { if (el.msgGleba) el.msgGleba.innerHTML = ''; }

// ─── Loading em botões ────────────────────────────────────────────────────
export function setButtonLoading(btn, text = 'Aguarde...') {
  if (!btn) return;
  btn.dataset.origHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${text}`;
  btn.disabled = true;
}
export function setButtonNormal(btn) {
  if (!btn) return;
  if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
  btn.disabled = false;
}

// ─── Formatação ───────────────────────────────────────────────────────────
export function formatArea(ha) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(ha);
}
export function formatPerimeter(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(1)} m`;
}
export function areaToColor(area, maxArea) {
  if (!maxArea) return '#448aff';
  const t = area / maxArea;
  return `rgb(${Math.round(40 + t * 215)},${Math.round(160 - t * 120)},${Math.round(255 - t * 200)})`;
}

// ─── Tabela de resultados ─────────────────────────────────────────────────
export function renderResultsTable(glebas) {
  const body = el.resultadosTableBody;
  const tableHeader = document.querySelector('.results-table thead');
  if (!body) return;

  // Atualiza o cabeçalho para o novo formato agrupado
  if (tableHeader) {
    tableHeader.innerHTML = `
      <tr class="group-header">
        <th colspan="2" class="border-end text-center">Identificação</th>
        <th colspan="3" class="border-end text-center bg-primary bg-opacity-10">Geometria</th>
        <th colspan="3" class="border-end text-center bg-success bg-opacity-10">Conformidade Ambiental</th>
        <th class="text-center">Ações</th>
      </tr>
      <tr>
        <th style="width: 40px">Cor</th>
        <th class="border-end">ID / Bioma</th>
        <th class="text-end">Área (ha)</th>
        <th class="text-end">Perímetro</th>
        <th class="text-center border-end">Mun.</th>
        <th class="text-center">Semiárido</th>
        <th class="text-center">TI (Funai)</th>
        <th class="text-center border-end">BACEN / CAR</th>
        <th class="text-center">Operações</th>
      </tr>
    `;
  }

  if (!glebas.length) {
    body.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5">
      <div class="opacity-40 mb-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 8H3V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2Z"/>
          <path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/>
          <path d="M10 12h4"/>
        </svg>
      </div>
      <p class="fw-medium">Nenhuma gleba carregada no projeto.</p>
      <small>Adicione coordenadas manualmente ou importe um arquivo (KML, SHP, CSV).</small>
    </td></tr>`;
    return;
  }

  const maxArea = Math.max(...glebas.map(g => g.area));
  const totalArea = glebas.reduce((s, g) => s + g.area, 0);

  body.innerHTML = glebas.map(g => {
    const color = areaToColor(g.area, maxArea);

    // Semiárido badge
    const semiLabel = g.semiArido === true
      ? '<span class="badge badge-modern bg-warning text-dark" title="Elegível FNE/PRONAF"><i class="bi bi-sun-fill me-1"></i>Sim</span>'
      : '<span class="badge badge-modern bg-light text-muted border"><i class="bi bi-dash me-1"></i>Não</span>';

    // TI badge
    const tiHits = g.tiIntersecoes ?? [];
    const tiLabel = tiHits.length
      ? `<span class="badge badge-modern bg-danger" 
               title="Sobreposição: ${tiHits.map(t => `${t.nome} (${t.fase})`).join(', ')}"
               data-bs-toggle="tooltip">
          <i class="bi bi-feather me-1"></i>${tiHits.length} TI
         </span>`
      : '<span class="badge badge-modern bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check2 me-1"></i>Livre</span>';

    // BACEN / CAR badge
    const conf = state.conformidade.get(g.glebaId);
    let confLabel;

    if (!conf) {
      confLabel = '<span class="badge badge-modern bg-secondary opacity-50" title="Aguardando verificação"><i class="bi bi-clock-history me-1"></i>Pendente</span>';
    } else {
      const carItem = conf.itens.find(i => i.id === 'car');
      const coverage = carItem?.coverage ?? 0;
      const carText = `CAR ${coverage}%`;

      if (conf.reprovada) {
        confLabel = `<span class="badge badge-modern bg-danger" title="Vedações detectadas" data-bs-toggle="tooltip"><i class="bi bi-shield-x me-1"></i>${carText}</span>`;
      } else if (conf.temAlerta) {
        confLabel = `<span class="badge badge-modern bg-warning text-dark" title="Aprovada com ressalvas" data-bs-toggle="tooltip"><i class="bi bi-shield-exclamation me-1"></i>${carText}</span>`;
      } else {
        confLabel = `<span class="badge badge-modern bg-success" title="Conformidade total" data-bs-toggle="tooltip"><i class="bi bi-shield-check me-1"></i>${carText}</span>`;
      }
    }

    const rowCls = conf?.reprovada ? 'table-danger-soft' : tiHits.length ? 'table-warning-soft' : '';

    return `
      <tr data-gleba-id="${g.glebaId}" class="${rowCls} align-middle">
        <td class="text-center">
          <div class="color-dot" style="background:${color}" title="Gleba ${g.glebaId}"></div>
        </td>
        <td class="border-end">
          <div class="fw-bold">Gleba ${g.glebaId}</div>
          <div class="small text-muted text-truncate" style="max-width:150px">${g.bioma || 'Não identificado'}</div>
        </td>
        <td class="text-end font-monospace fw-medium">${formatArea(g.area)} ha</td>
        <td class="text-end text-muted small">${formatPerimeter(g.perimeter)}</td>
        <td class="text-center border-end text-muted">${g.municipioCount}</td>
        <td class="text-center">${semiLabel}</td>
        <td class="text-center">${tiLabel}</td>
        <td class="text-center border-end">${confLabel}</td>
        <td class="text-center">
          <div class="btn-group shadow-sm border rounded-2 overflow-hidden">
            <button class="btn btn-white btn-sm px-2 btn-editar-gleba" data-gleba-id="${g.glebaId}" title="Editar">
              <i class="bi bi-pencil text-warning"></i>
            </button>
            <button class="btn btn-white btn-sm px-2 btn-zoom-gleba" data-gleba-id="${g.glebaId}" title="Zoom">
              <i class="bi bi-search text-primary"></i>
            </button>
            <button class="btn btn-white btn-sm px-2 btn-conf-gleba" data-gleba-id="${g.glebaId}" title="Detalhes">
              <i class="bi bi-shield-lock text-dark"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  body.innerHTML += `
    <tr class="table-light fw-bold border-top-2">
      <td colspan="2" class="text-end">TOTAL:</td>
      <td class="text-end text-primary">${formatArea(totalArea)} ha</td>
      <td colspan="6" class="text-muted small fw-normal ps-3">${glebas.length} polígono(s) processado(s)</td>
    </tr>`;

  // Inicializa tooltips
  body.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(node => {
    new bootstrap.Tooltip(node, { trigger: 'hover', container: 'body' });
  });

  updateStatusBar(glebas);
}


// ─── Barra de status ──────────────────────────────────────────────────────
export function updateStatusBar(glebas) {
  if (!el.statusArea) return;
  if (!glebas.length) { el.statusArea.textContent = '—'; return; }
  const tot = glebas.reduce((s, g) => s + g.area, 0);
  el.statusArea.textContent = `${glebas.length} gleba(s) | ${formatArea(tot)} ha`;
}
export function updateStatusCoords(latlng) {
  if (el.statusCoords) {
    el.statusCoords.textContent = `Lat ${latlng.lat.toFixed(5)} | Lon ${latlng.lng.toFixed(5)}`;
  }
}

// ─── Dark mode ────────────────────────────────────────────────────────────
export function applyDarkMode(enabled) {
  document.documentElement.setAttribute('data-bs-theme', enabled ? 'dark' : 'light');
  if (el.btnDarkMode) {
    el.btnDarkMode.innerHTML = enabled
      ? '<i class="bi bi-sun-fill me-1"></i>'
      : '<i class="bi bi-moon-stars-fill me-1"></i>';
  }
}

// ─── Status SUDENE ────────────────────────────────────────────────────────
export function setSudeneStatus(status) {
  const s = el.sudeneStatus;
  if (!s) return;
  const m = {
    loading: { cls: 'text-warning', txt: 'SUDENE...' },
    ok: { cls: 'text-success', txt: 'SUDENE' },
    error: { cls: 'text-danger', txt: 'Erro SUDENE' },
  };
  const { cls, txt } = m[status] ?? m.loading;
  const icon = status === 'ok' ? '<i class="bi bi-check-circle-fill me-1"></i>'
    : status === 'error' ? '<i class="bi bi-x-circle-fill me-1"></i>'
      : '<span class="spinner-border spinner-border-sm me-1" role="status"></span>';
  s.className = `status-item small ${cls}`;
  s.innerHTML = `${icon}${txt}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export const getCoordText = () => el.coordenadas?.value ?? '';
export const setCoordText = text => { if (el.coordenadas) el.coordenadas.value = text; };