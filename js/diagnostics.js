/**
 * diagnostics.js — Interface de Diagnóstico / Validar Pontos.
 *
 * Gerencia o modal de diagnóstico detalhado das glebas,
 * mostrando status por ponto, problemas globais, e
 * marcadores visuais no mapa para pontos com problemas.
 */

import {
  getMap, getGlebas, getDiagnosticLayers, setDiagnosticLayers,
  clearDiagnosticLayers, glebasToText,
} from './state.js';

import { $, log, DIAG_STATUS, glebaColor } from './utils.js';
import { diagnosticarCoordenadas } from './validation.js';

/* global L, bootstrap */

/**
 * Executa o diagnóstico e exibe no modal.
 * @param {string} coordText — Texto de coordenadas (do textarea ou do state)
 */
export function runDiagnostics(coordText) {
  const text = coordText || glebasToText();
  if (!text.trim()) {
    showEmptyDiagnostics();
    return;
  }

  const result = diagnosticarCoordenadas(text);
  renderDiagnosticsSummary(result.summary);
  renderDiagnosticsDetails(result.glebas);
  renderDiagnosticMarkers(result.glebas);

  // Mostrar botão de fix se aplicável
  const fixBtn = $('diagFixAll');
  const canFix = result.glebas.some(g => g.canAutoFix);
  if (fixBtn) {
    fixBtn.classList.toggle('d-none', !canFix);
  }

  // Abrir modal
  const modalEl = $('diagnosticoModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  log('diagnostics: diagnóstico concluído', result.summary);
}

/**
 * Exibe mensagem de vazio quando não há coordenadas.
 */
function showEmptyDiagnostics() {
  const summary = $('diagSummary');
  const details = $('diagDetails');

  if (summary) {
    summary.innerHTML = `
      <div class="alert alert-info mb-0">
        <i class="bi bi-info-circle"></i> Nenhuma coordenada para diagnosticar.
        Adicione glebas primeiro.
      </div>
    `;
  }
  if (details) details.innerHTML = '';

  const modalEl = $('diagnosticoModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Renderiza o resumo do diagnóstico.
 */
function renderDiagnosticsSummary(summary) {
  const el = $('diagSummary');
  if (!el) return;

  const statusIcon = summary.errors > 0 ? '🔴' : summary.warnings > 0 ? '🟡' : '🟢';
  const statusText = summary.errors > 0 ? 'Problemas encontrados' : summary.warnings > 0 ? 'Avisos' : 'Todas as glebas válidas';

  el.innerHTML = `
    <div class="diag-summary-card">
      <div class="diag-summary-status">
        <span class="diag-status-icon">${statusIcon}</span>
        <span class="diag-status-text">${statusText}</span>
      </div>
      <div class="diag-summary-stats">
        <div class="diag-stat">
          <span class="diag-stat-value">${summary.total}</span>
          <span class="diag-stat-label">Glebas</span>
        </div>
        <div class="diag-stat diag-stat-ok">
          <span class="diag-stat-value">${summary.ok}</span>
          <span class="diag-stat-label">✓ OK</span>
        </div>
        <div class="diag-stat diag-stat-warn">
          <span class="diag-stat-value">${summary.warnings}</span>
          <span class="diag-stat-label">⚠ Avisos</span>
        </div>
        <div class="diag-stat diag-stat-error">
          <span class="diag-stat-value">${summary.errors}</span>
          <span class="diag-stat-label">✕ Erros</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza os detalhes do diagnóstico por gleba.
 */
function renderDiagnosticsDetails(glebas) {
  const el = $('diagDetails');
  if (!el) return;

  if (glebas.length === 0) {
    el.innerHTML = '<p class="text-muted">Nenhuma gleba para diagnosticar.</p>';
    return;
  }

  el.innerHTML = glebas.map((diag, idx) => {
    const color = glebaColor(idx);
    const statusBadge = diag.overallStatus === DIAG_STATUS.OK
      ? '<span class="badge bg-success">✓ Válida</span>'
      : diag.overallStatus === DIAG_STATUS.WARNING
        ? '<span class="badge bg-warning text-dark">⚠ Avisos</span>'
        : '<span class="badge bg-danger">✕ Erros</span>';

    const globalIssuesHtml = diag.globalIssues.length > 0
      ? `<div class="diag-global-issues mb-2">
          ${diag.globalIssues.map(issue => `
            <div class="diag-issue">
              <i class="bi bi-exclamation-triangle-fill text-warning"></i> ${issue}
            </div>
          `).join('')}
        </div>`
      : '';

    const pointsTable = `
      <table class="table table-sm table-bordered diag-point-table mb-0">
        <thead>
          <tr>
            <th>#</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${diag.points.map(p => {
            const rowClass = p.status === DIAG_STATUS.ERROR ? 'table-danger'
              : p.status === DIAG_STATUS.WARNING ? 'table-warning' : '';
            const statusIcon = p.status === DIAG_STATUS.OK ? '✓'
              : p.status === DIAG_STATUS.WARNING ? '⚠' : '✕';
            return `
              <tr class="${rowClass}">
                <td>${p.index}</td>
                <td class="font-monospace">${p.lat.toFixed(6)}</td>
                <td class="font-monospace">${p.lon.toFixed(6)}</td>
                <td>
                  <span title="${p.issues.join('; ')}">${statusIcon} ${p.issues[0]}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    return `
      <div class="diag-gleba-card mb-3">
        <div class="diag-gleba-header" data-bs-toggle="collapse" data-bs-target="#diagGleba${diag.gleba}">
          <span class="diag-gleba-color" style="background:${color}"></span>
          <span class="fw-bold">Gleba ${diag.gleba}</span>
          ${statusBadge}
          <span class="text-muted ms-auto">${diag.points.length} pontos</span>
          <i class="bi bi-chevron-down ms-2"></i>
        </div>
        <div class="collapse show" id="diagGleba${diag.gleba}">
          <div class="diag-gleba-body">
            ${globalIssuesHtml}
            ${pointsTable}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza marcadores de diagnóstico no mapa.
 * Pontos com problemas recebem marcadores vermelhos/amarelos.
 */
function renderDiagnosticMarkers(glebas) {
  const map = getMap();
  if (!map) return;

  // Limpar marcadores anteriores
  clearDiagnosticLayers();
  const markers = [];

  glebas.forEach(diag => {
    diag.points.forEach(p => {
      if (p.status === DIAG_STATUS.OK) return;

      const color = p.status === DIAG_STATUS.ERROR ? '#ef4444' : '#f59e0b';
      const icon = L.divIcon({
        className: 'diag-marker',
        html: `<div class="diag-marker-dot" style="background:${color};box-shadow:0 0 8px ${color}">
          <span class="diag-marker-label">${p.index}</span>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([p.lat, p.lon], {
        icon,
        pmIgnore: true,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(`<b>Gleba ${diag.gleba}, Ponto ${p.index}</b><br>${p.issues.join('<br>')}`);

      markers.push(marker);
    });
  });

  setDiagnosticLayers(markers);
  log('diagnostics: marcadores renderizados:', markers.length);
}

/**
 * Limpa os marcadores de diagnóstico.
 */
export function clearDiagnostics() {
  clearDiagnosticLayers();
  const summary = $('diagSummary');
  const details = $('diagDetails');
  if (summary) summary.innerHTML = '';
  if (details) details.innerHTML = '';
}
