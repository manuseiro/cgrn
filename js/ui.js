/**
 * @file ui.js
 * @description Responsável por toda manipulação de DOM e feedback visual.
 *
 * Sistema de notificação em duas camadas:
 *  1. showToast()   — notificações globais (canto inferior direito)
 *  2. showMessage() — feedback inline dentro de um modal específico
 */

import { CONFIG } from './config.js';
import { state } from './state.js';

// ─── Utilitários de log ────────────────────────────────────────────────────

export function log(...args) { if (CONFIG.DEBUG) console.log('[CGRN]', ...args); }
export function warn(...args) { if (CONFIG.DEBUG) console.warn('[CGRN]', ...args); }

// ─── Cache de referências DOM ─────────────────────────────────────────────
// Getters lazy: resolvidos no momento do acesso, não na importação do módulo.
// Garante que o DOM já existe quando cada getter é chamado.

export const el = {
  // Modais
  get modalAdicionarGleba() { return document.getElementById('adicionarGleba'); },
  get modalResultados() { return document.getElementById('resultadosModal'); },
  get modalEditar() { return document.getElementById('editarGlebaModal'); },
  get modalProjeto() { return document.getElementById('projetoModal'); },

  // Áreas de mensagem inline — IDs únicos por modal (sem duplicação)
  get msgGleba() { return document.getElementById('msgGleba'); },
  get msgProjeto() { return document.getElementById('msgProjeto'); },

  // Inputs de texto
  get coordenadas() { return document.getElementById('coordenadas'); },
  get glebaEditArea() { return document.getElementById('glebaEditArea'); },
  get editGlebaId() { return document.getElementById('editGlebaId'); },
  get projectName() { return document.getElementById('projectName'); },
  get fileUpload() { return document.getElementById('fileUpload'); },

  // Checkboxes de visualização
  get mostrarMarcadores() { return document.getElementById('mostrarMarcadores'); },
  get mostrarCentroids() { return document.getElementById('mostrarCentroids'); },
  get mostrarGlebas() { return document.getElementById('mostrarGlebas'); },
  get mostrarTI() { return document.getElementById('mostrarTI'); },
  get validarPontos() { return document.getElementById('validarPontos'); },

  // Botões — modal Adicionar Gleba
  get btnAdicionar() { return document.getElementById('adicionar-gleba-btn'); },
  get btnValidar() { return document.getElementById('validar-gleba-btn'); },
  get btnLimparMapa() { return document.getElementById('limparMapa'); },
  get btnInserirExemplo() { return document.getElementById('inserirExemplo'); },

  // Botões — navbar / menu
  get btnCalcular() { return document.getElementById('calcularArea'); },
  get btnDesenhar() { return document.getElementById('desenharGleba'); },
  get btnValidarNav() { return document.getElementById('validarGlebas'); },
  get btnDarkMode() { return document.getElementById('toggleDarkMode'); },

  // Botões — projeto
  get btnSalvarProjeto() { return document.getElementById('salvarProjeto'); },
  get btnCarregarProjeto() { return document.getElementById('carregarProjeto'); },

  // Tabela de resultados
  get resultadosTableBody() { return document.getElementById('resultadosTableBody'); },

  // Barra de status inferior
  get statusCoords() { return document.getElementById('statusCoords'); },
  get statusArea() { return document.getElementById('statusArea'); },
  get sudeneStatus() { return document.getElementById('sudeneStatus'); },
  get savedProjectInfo() { return document.getElementById('savedProjectInfo'); },
};

// ─── Sistema de Toast (notificações globais) ──────────────────────────────

let _toastCounter = 0;

/**
 * Exibe um toast no canto inferior direito da tela.
 * Use para feedback de ações que ocorrem fora de modais.
 *
 * @param {string|string[]} message
 * @param {'success'|'danger'|'warning'|'info'|'dark'} type
 * @param {number} [delay=4500] ms antes de sumir (0 = persiste)
 */
export function showToast(message, type = 'info', delay = 4500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '<i class="bi bi-check-square"></i>', danger: '❌', warning: '<i class="bi bi-exclamation-triangle"></i>', info: 'ℹ️', dark: '🌙' };
  const id = `toast-${++_toastCounter}`;
  const content = Array.isArray(message)
    ? `<ul class="mb-0 ps-3">${message.map(m => `<li>${m}</li>`).join('')}</ul>`
    : message;

  const html = `
    <div id="${id}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header bg-${type} text-white">
        <span class="me-2">${icons[type] ?? 'ℹ️'}</span>
        <strong class="me-auto">CGRN</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body" style="font-size:0.85rem">${content}</div>
    </div>`;

  container.insertAdjacentHTML('beforeend', html);
  const toastEl = document.getElementById(id);
  const toast = new bootstrap.Toast(toastEl, { delay: delay || 99_999, autohide: delay > 0 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// ─── Mensagens inline nos modais ─────────────────────────────────────────

/**
 * Exibe mensagem inline no modal de Adicionar Gleba.
 * @param {string|string[]} message
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {number} [autoDismiss=0] ms — 0 = persiste
 */
export function showMessage(message, type = 'info', autoDismiss = 0) {
  _inlineMsg(el.msgGleba, message, type, autoDismiss);
}

/**
 * Exibe mensagem inline no modal de Projeto.
 * @param {string|string[]} message
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {number} [autoDismiss=0]
 */
export function showProjectMessage(message, type = 'info', autoDismiss = 0) {
  _inlineMsg(el.msgProjeto, message, type, autoDismiss);
}

function _inlineMsg(area, message, type, autoDismiss) {
  if (!area) return;
  const content = Array.isArray(message)
    ? `<ul class="mb-0 ps-3 small">${message.map(m => `<li>${m}</li>`).join('')}</ul>`
    : `<span class="small">${message}</span>`;

  area.innerHTML = `
    <div class="alert alert-${type} alert-dismissible mb-0 py-2 animate-fadein" role="alert">
      ${content}
      <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert"></button>
    </div>`;

  if (autoDismiss > 0) setTimeout(() => { area.innerHTML = ''; }, autoDismiss);
}

export function clearMessage() { if (el.msgGleba) el.msgGleba.innerHTML = ''; }

// ─── Loading em botões ────────────────────────────────────────────────────

export function setButtonLoading(btn, text = 'Aguarde...') {
  if (!btn) return;
  btn.dataset.origHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${text}`;
  btn.disabled = true;
}

export function setButtonNormal(btn) {
  if (!btn) return;
  if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
  btn.disabled = false;
}

// ─── Formatação de valores ────────────────────────────────────────────────

export function formatArea(ha) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(ha);
}

export function formatPerimeter(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(1)} m`;
}

/**
 * Cor baseada na proporção da área (azul-céu → laranja-coral).
 * @param {number} area
 * @param {number} maxArea
 */
export function areaToColor(area, maxArea) {
  if (maxArea === 0) return '#448aff';
  const t = area / maxArea;
  const r = Math.round(40 + t * 215);
  const g = Math.round(160 - t * 120);
  const b = Math.round(255 - t * 200);
  return `rgb(${r},${g},${b})`;
}

// ─── Tabela de resultados ─────────────────────────────────────────────────

/**
 * Renderiza a tabela de resultados das glebas.
 * @param {GlebaData[]} glebas
 */
export function renderResultsTable(glebas) {
  const body = el.resultadosTableBody;
  if (!body) return;

  if (!glebas.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          <i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>
          Nenhuma gleba carregada.
        </td>
      </tr>`;
    return;
  }

  const maxArea = Math.max(...glebas.map(g => g.area));
  const totalArea = glebas.reduce((s, g) => s + g.area, 0);

  body.innerHTML = glebas.map(g => {
    const color = areaToColor(g.area, maxArea);
    const centroid = `${g.centroid[1].toFixed(5)}, ${g.centroid[0].toFixed(5)}`;

    // Semiárido
    let semiLabel = '<span class="badge bg-secondary opacity-50">—</span>';
    if (g.semiArido === true) semiLabel = '<span class="badge bg-warning text-dark">Semiárido</span>';
    if (g.semiArido === false) semiLabel = '<span class="badge bg-success-subtle text-success-emphasis">Não Semiárido</span>';

    // Terras Indígenas — mostra badge com tooltip dos nomes
    const tiHits = g.tiIntersecoes ?? [];
    let tiLabel;
    if (tiHits.length === 0) {
      tiLabel = '<span class="badge bg-success-subtle text-success-emphasis">✓ Livre</span>';
    } else {
      const nomes = tiHits.map(ti => `${ti.nome} (${ti.fase})`).join('\n');
      const areasTI = tiHits
        .filter(ti => ti.areaHa !== null)
        .map(ti => `${ti.nome}: ${formatArea(ti.areaHa)} ha`)
        .join('; ');
      const tooltip = areasTI || nomes;
      tiLabel = `
        <span class="badge bg-danger ti-badge"
              title="${tooltip.replace(/"/g, '&quot;')}"
              data-bs-toggle="tooltip" data-bs-placement="left"
              style="cursor:help">
          <i class="bi bi-exclamation-triangle"></i> ${tiHits.length} TI
        </span>`;
    }

    return `
      <tr data-gleba-id="${g.glebaId}" class="${tiHits.length > 0 ? 'table-warning' : ''}">
        <td>
          <span class="color-chip" style="background:${color}"></span>
          <strong>Gleba ${g.glebaId}</strong>
        </td>
        <td class="text-end">${formatArea(g.area)} ha</td>
        <td class="text-end">${formatPerimeter(g.perimeter)}</td>
        <td class="text-center">${g.municipioCount}</td>
        <td>${semiLabel}</td>
        <td>${tiLabel}</td>
        <td class="font-monospace text-muted" style="font-size:0.72em">${centroid}</td>
        <td class="text-nowrap">
          <button class="btn btn-outline-secondary btn-icon btn-editar-gleba"
                  data-gleba-id="${g.glebaId}" title="Editar coordenadas">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-primary btn-icon btn-zoom-gleba"
                  data-gleba-id="${g.glebaId}" title="Zoom na gleba">
            <i class="bi bi-zoom-in"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  body.innerHTML += `
    <tr class="table-secondary fw-semibold border-top">
      <td><i class="bi bi-sigma me-1"></i>Total</td>
      <td class="text-end">${formatArea(totalArea)} ha</td>
      <td colspan="6">${glebas.length} gleba(s)</td>
    </tr>`;

  // Inicializa tooltips Bootstrap nos badges TI recém-renderizados
  body.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(node => {
    new bootstrap.Tooltip(node, { trigger: 'hover' });
  });

  updateStatusBar(glebas);
}

// ─── Barra de status inferior ─────────────────────────────────────────────

export function updateStatusBar(glebas) {
  if (!el.statusArea) return;
  if (!glebas.length) { el.statusArea.textContent = '—'; return; }
  const total = glebas.reduce((s, g) => s + g.area, 0);
  el.statusArea.textContent =
    `${glebas.length} gleba(s) | ${formatArea(total)} ha`;
}

export function updateStatusCoords(latlng) {
  if (el.statusCoords) {
    el.statusCoords.textContent =
      `Lat ${latlng.lat.toFixed(5)} | Lon ${latlng.lng.toFixed(5)}`;
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
    loading: { cls: 'text-warning', txt: 'SUDENE carregando...' },
    ok: { cls: 'text-success', txt: 'SUDENE' },
    error: { cls: 'text-danger', txt: 'Erro na SUDENE' },
  };
  const { cls, txt } = m[status] ?? m.loading;
  s.className = `navbar-text small ${cls}`;
  s.textContent = txt;
}

// ─── Helpers de texto / modal ─────────────────────────────────────────────

export function getCoordText() { return el.coordenadas?.value ?? ''; }
export function setCoordText(t) { if (el.coordenadas) el.coordenadas.value = t; }

export function hideModal(id) {
  const node = document.getElementById(id);
  if (node) bootstrap.Modal.getInstance(node)?.hide();
}

export function showModal(id) {
  const node = document.getElementById(id);
  if (node) bootstrap.Modal.getOrCreateInstance(node).show();
}
