/**
 * @file ui.js — v3.0
 * @description Toda manipulação de DOM, toasts, tabelas e helpers de UI.
 */

import { CONFIG } from './config.js';
import { state } from './state.js';

// ─── Log ──────────────────────────────────────────────────────────────────
export const log = (...a) => CONFIG.DEBUG && console.log('[CGRN]', ...a);
export const warn = (...a) => CONFIG.DEBUG && console.warn('[CGRN]', ...a);

// ─── Refs DOM (lazy getters) ──────────────────────────────────────────────
export const el = {
  // Modais
  get modalAdicionarGleba() { return document.getElementById('adicionarGleba'); },
  get modalResultados() { return document.getElementById('resultadosModal'); },
  get modalEditar() { return document.getElementById('editarGlebaModal'); },
  get modalProjeto() { return document.getElementById('projetoModal'); },
  get modalConformidade() { return document.getElementById('conformidadeModal'); },

  // Mensagens inline (IDs únicos por modal)
  get msgGleba() { return document.getElementById('msgGleba'); },
  get msgProjeto() { return document.getElementById('msgProjeto'); },

  // Inputs
  get coordenadas() { return document.getElementById('coordenadas'); },
  get glebaEditArea() { return document.getElementById('glebaEditArea'); },
  get editGlebaId() { return document.getElementById('editGlebaId'); },
  get projectName() { return document.getElementById('projectName'); },
  get fileUpload() { return document.getElementById('fileUpload'); },

  // Checkboxes de visualização
  get mostrarGlebas() { return document.getElementById('mostrarGlebas'); },
  get mostrarMarcadores() { return document.getElementById('mostrarMarcadores'); },
  get mostrarCentroids() { return document.getElementById('mostrarCentroids'); },
  get mostrarTI() { return document.getElementById('mostrarTI'); },
  get mostrarUC() { return document.getElementById('mostrarUC'); },
  get mostrarIbama() { return document.getElementById('mostrarIbama'); },
  get mostrarBioma() { return document.getElementById('mostrarBioma'); },
  get validarPontos() { return document.getElementById('validarPontos'); },

  // Botões — modal Adicionar Gleba
  get btnAdicionar() { return document.getElementById('adicionar-gleba-btn'); },
  get btnValidar() { return document.getElementById('validar-gleba-btn'); },
  get btnLimparMapa() { return document.getElementById('limparMapa'); },
  get btnInserirExemplo() { return document.getElementById('inserirExemplo'); },

  // Botões — navbar
  get btnCalcular() { return document.getElementById('calcularArea'); },
  get btnValidarNav() { return document.getElementById('validarGlebas'); },
  get btnDesenhar() { return document.getElementById('desenharGleba'); },
  get btnDarkMode() { return document.getElementById('toggleDarkMode'); },

  // Botões — projeto
  get btnSalvarProjeto() { return document.getElementById('salvarProjeto'); },
  get btnCarregarProjeto() { return document.getElementById('carregarProjeto'); },

  // Tabela de resultados
  get resultadosTableBody() { return document.getElementById('resultadosTableBody'); },

  // Barra de status
  get statusCoords() { return document.getElementById('statusCoords'); },
  get statusArea() { return document.getElementById('statusArea'); },
  get sudeneStatus() { return document.getElementById('sudeneStatus'); },
  get savedProjectInfo() { return document.getElementById('savedProjectInfo'); },
};

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
  if (!body) return;

  if (!glebas.length) {
    body.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5">
      <i class="bi bi-inbox-fill fs-2 d-block mb-2 opacity-40"></i>Nenhuma gleba carregada.
    </td></tr>`;
    return;
  }

  const maxArea = Math.max(...glebas.map(g => g.area));
  const totalArea = glebas.reduce((s, g) => s + g.area, 0);

  body.innerHTML = glebas.map(g => {
    const color = areaToColor(g.area, maxArea);
    const centroid = `${g.centroid[1].toFixed(5)}, ${g.centroid[0].toFixed(5)}`;

    // Semiárido
    const semiLabel = g.semiArido === true
      ? '<span class="badge bg-warning text-dark" title="Elegível FNE/PRONAF Semiárido"><i class="bi bi-sun-fill"></i> Sim</span>'
      : g.semiArido === false
        ? '<span class="badge bg-success-subtle text-success-emphasis"><i class="bi bi-cloud-sun-fill"></i> Não</span>'
        : '<span class="badge bg-secondary opacity-50">—</span>';

    // Terras Indígenas
    const tiHits = g.tiIntersecoes ?? [];
    const tiLabel = tiHits.length
      ? `<span class="badge bg-danger ti-badge"
              title="${tiHits.map(t => `${t.nome} (${t.fase})`).join('\n')}"
              data-bs-toggle="tooltip" data-bs-placement="left" style="cursor:help">
          <i class="bi bi-feather text-danger"></i> ${tiHits.length} Terras Indígenas
         </span>`
      : '<span class="badge bg-success-subtle text-success-emphasis">✓ Livre</span>';

    // Conformidade BACEN/SICOR
    const conf = state.conformidade.get(g.glebaId);
    let confLabel;
    if (!conf) {
      confLabel = '<span class="badge bg-secondary opacity-60 conf-badge" title="Clique em Verificar Conformidade"><i class="bi bi-hourglass-split"></i> Pendente</span>';
    } else {
      const carItem = conf.itens.find(i => i.id === 'car');
      const coverageText = carItem && carItem.coverage !== undefined ? ` CAR ${carItem.coverage}%` : '';
      const carAreaText = carItem && carItem.carAreaHa !== undefined ? `\nÁrea CAR: ${carItem.carAreaHa.toFixed(1)} ha` : '';

      if (conf.reprovada) {
        const bloqueios = conf.itens.filter(i => i.status === 'bloqueio').map(i => i.label).join('\n');
        confLabel = `<span class="badge bg-danger conf-badge"
          title="${bloqueios}${carAreaText}" data-bs-toggle="tooltip" style="cursor:help"><i class="bi bi-x-octagon-fill"></i> ${coverageText || 'Reprovada'}</span>`;
      } else if (conf.temAlerta) {
        confLabel = `<span class="badge bg-warning text-dark conf-badge"
          title="Aprovada com ressalvas — verifique detalhes${carAreaText}" data-bs-toggle="tooltip" style="cursor:help">
          <i class="bi bi-exclamation-triangle-fill"></i> ${coverageText || 'Ressalvas'}</span>`;
      } else if (conf.temInfo) {
        confLabel = `<span class="badge bg-success conf-badge" title="Informações orientativas disponíveis${carAreaText}" data-bs-toggle="tooltip"><i class="bi bi-patch-check-fill"></i> ${coverageText || 'Aprovada'} <i class="bi bi-info-circle-fill ms-1"></i></span>`;
      } else {
        confLabel = `<span class="badge bg-success conf-badge" title="${carAreaText}" data-bs-toggle="tooltip"><i class="bi bi-patch-check-fill"></i> ${coverageText || 'Aprovada'}</span>`;
      }
    }

    const rowCls = conf?.reprovada ? 'table-danger'
      : tiHits.length ? 'table-warning'
        : conf?.temAlerta ? 'table-warning'
          : '';

    return `
      <tr data-gleba-id="${g.glebaId}" class="${rowCls}">
        <td>
          <span class="color-chip" style="background:${color}"></span>
          <strong>Gleba ${g.glebaId}</strong>
          ${g.bioma ? `<br><small class="text-muted">${g.bioma}</small>` : ''}
        </td>
        <td class="text-end text-nowrap">${formatArea(g.area)} ha</td>
        <td class="text-end text-nowrap">${formatPerimeter(g.perimeter)}</td>
        <td class="text-center">${g.municipioCount}</td>
        <td>${semiLabel}</td>
        <td>${tiLabel}</td>
        <td>${confLabel}</td>
        <td class="font-monospace text-muted" style="font-size:.71em">${centroid}</td>
        <td class="text-nowrap">
          <button class="btn btn-outline-secondary btn-icon btn-editar-gleba"
                  data-gleba-id="${g.glebaId}" title="Editar coordenadas">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-outline-primary btn-icon btn-zoom-gleba"
                  data-gleba-id="${g.glebaId}" title="Zoom na gleba">
            <i class="bi bi-search"></i>
          </button>
          <button class="btn btn-outline-dark btn-icon btn-conf-gleba"
                  data-gleba-id="${g.glebaId}" title="Detalhar conformidade BACEN/SICOR">
            <i class="bi bi-shield-lock-fill"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  body.innerHTML += `
    <tr class="table-secondary fw-semibold border-top">
      <td><i class="bi bi-sigma me-1"></i>Total</td>
      <td class="text-end">${formatArea(totalArea)} ha</td>
      <td colspan="7">${glebas.length} gleba(s)</td>
    </tr>`;

  // Inicializa tooltips nos badges recém-renderizados
  body.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(node => {
    new bootstrap.Tooltip(node, { trigger: 'hover', html: false });
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

export function hideModal(id) {
  const n = document.getElementById(id);
  if (n) bootstrap.Modal.getInstance(n)?.hide();
}
export function showModal(id) {
  const n = document.getElementById(id);
  if (n) bootstrap.Modal.getOrCreateInstance(n).show();
}