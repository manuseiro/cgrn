/**
 * main.js — Ponto de entrada da aplicação CGRN.
 *
 * Orquestra a inicialização dos módulos, vincula eventos
 * e coordena o fluxo entre validação, mapa e UI.
 *
 * v2 — Melhorias:
 *  - Integração com Leaflet-Geoman (create, edit, remove)
 *  - State como single source of truth
 *  - Diagnóstico de pontos
 *  - Per-gleba editing
 *  - Popup edit/remove buttons
 *  - Enhanced coord edit table (add/remove rows)
 */

import {
  setGlebas, getGlebas, clearAll, cacheGet, cacheSet,
  updateGleba, removeGleba, addGleba, getGlebaById,
  glebasToText, subscribe,
} from './state.js';

import { log, hashString, $ } from './utils.js';
import { validarCoordenadas, reprocessGlebaCoords } from './validation.js';
import {
  initMap, setupGeomanEvents, renderGlebas, renderMarkers,
  clearMarkers, enableDrawMode, enableGlebaEdit, disableAllEdits, flashGleba,
} from './map.js';
import { loadSudeneLayer } from './sudene.js';
import { exportToCSV, exportToGeoJSON, exportMapImage } from './export.js';
import { runDiagnostics, clearDiagnostics } from './diagnostics.js';
import {
  initUI,
  showMessage, showErrors, showWarnings, clearMessages,
  startButtonLoader, toggleGlobalLoader,
  updateResultsTable,
  hideAdicionarModal, showResultadosModal, showCoordEditModal,
  getCoordenadasText, setCoordenadasText, isMostrarMarcadores,
  clearForm, addCoordRow,
  setupFileUpload,
  toggleDarkMode,
  saveProject, loadProject, deleteProject, updateProjectList,
  insertExample,
  syncTableToTextarea, populateCoordTable, syncStateToTextarea,
} from './ui.js';

/* global bootstrap */

// ── Processamento principal ─────────────────────────────────────────────────

/**
 * Valida e processa coordenadas do textarea.
 * Atualiza mapa e tabela se validação for bem-sucedida.
 * @param {HTMLButtonElement} [triggerBtn] — Botão que disparou a ação (para loader)
 * @returns {boolean} true se processou com sucesso
 */
function processarCoordenadas(triggerBtn) {
  const stopLoader = triggerBtn ? startButtonLoader(triggerBtn, 'Validando...') : () => {};

  try {
    const texto = getCoordenadasText();
    if (!texto) {
      showMessage('Digite pelo menos uma coordenada ou desenhe uma gleba.', 'warning');
      return false;
    }

    // Limpar diagnóstico anterior
    clearDiagnostics();

    // Verificar cache
    const hash = hashString(texto);
    const cached = cacheGet(hash);
    if (cached) {
      log('main: usando resultado do cache');
      setGlebas(cached);
      updateResultsTable(cached);
      renderGlebas(cached);
      if (isMostrarMarcadores()) renderMarkers(cached);
      showMessage('<i class="bi bi-check-circle-fill"></i> Coordenadas válidas! <span class="text-muted">(cache)</span>', 'success', 2000);
      return true;
    }

    // Validar
    const result = validarCoordenadas(texto);

    if (!result.valid) {
      showErrors(result.errors);
      return false;
    }

    // Mostrar warnings se houver
    if (result.warnings && result.warnings.length > 0) {
      // Mostrar warnings temporariamente
      setTimeout(() => showWarnings(result.warnings), 100);
    }

    // Sucesso
    cacheSet(hash, result.data);
    setGlebas(result.data);
    updateResultsTable(result.data);
    renderGlebas(result.data);

    if (isMostrarMarcadores()) {
      renderMarkers(result.data);
    } else {
      clearMarkers();
    }

    showMessage(`<i class="bi bi-check-circle-fill"></i> ${result.data.length} gleba(s) validada(s) com sucesso!`, 'success', 3000);
    return true;

  } finally {
    stopLoader();
  }
}

// ── Ações vinculadas a botões ───────────────────────────────────────────────

function onAdicionarGleba() {
  const btn = $('adicionar-gleba-btn');
  const ok = processarCoordenadas(btn);
  if (ok) hideAdicionarModal();
}

function onCalcularArea() {
  const btn = $('calcularArea');
  const ok = processarCoordenadas(btn);
  if (ok) showResultadosModal();
}

function onDesenharGleba() {
  enableDrawMode();
  showMessage('<i class="bi bi-info-circle"></i> Clique no mapa para desenhar os vértices. Clique no primeiro ponto para fechar.', 'info', 5000);
}

function onLimpar() {
  clearAll();
  clearForm();
  clearDiagnostics();
}

function onExportCSV() {
  const glebas = getGlebas();
  if (glebas.length > 0) exportToCSV(glebas);
}

function onExportGeoJSON() {
  const glebas = getGlebas();
  if (glebas.length > 0) exportToGeoJSON(glebas);
}

async function onExportImage() {
  const btn = $('exportImage');
  const stopLoader = startButtonLoader(btn, 'Exportando...');
  try {
    await exportMapImage();
  } catch (e) {
    showMessage('Erro ao exportar imagem: ' + e.message, 'danger');
  } finally {
    stopLoader();
  }
}

function onSaveProject() {
  saveProject();
}

function onToggleDarkMode() {
  toggleDarkMode();
}

function onInsertExample() {
  insertExample();
}

function onEditCoords() {
  showCoordEditModal();
}

function onApplyCoordEdits() {
  const text = syncTableToTextarea();
  processarCoordenadas();
  const modalEl = $('coordEditModal');
  if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
}

function onValidarPontos() {
  const text = getCoordenadasText();
  runDiagnostics(text);
}

// ── Geoman callbacks ────────────────────────────────────────────────────────

function onGlebaCreatedFromMap(glebaData) {
  log('main: gleba criada via Geoman', glebaData.gleba);

  // Adicionar ao state
  addGleba(glebaData);

  // Atualizar textarea e re-renderizar
  syncStateToTextarea();
  const glebas = getGlebas();
  updateResultsTable(glebas);
  renderGlebas(glebas);

  if (isMostrarMarcadores()) renderMarkers(glebas);

  showMessage(`<i class="bi bi-check-circle-fill"></i> Gleba ${glebaData.gleba} desenhada com sucesso!`, 'success', 3000);
}

function onGlebaEditedFromMap(glebaId, newRawCoords) {
  const gleba = getGlebaById(glebaId);
  if (!gleba) return;

  const updated = reprocessGlebaCoords(newRawCoords, gleba.gleba);
  if (!updated) return;

  updateGleba(glebaId, {
    rawCoords: updated.rawCoords,
    coords: updated.coords,
    area: updated.area,
    perimeter: updated.perimeter,
    centroid: updated.centroid,
    municipios: updated.municipios,
  });

  syncStateToTextarea();
  const glebas = getGlebas();
  updateResultsTable(glebas);
  // Re-render to update labels/colors
  renderGlebas(glebas);
  if (isMostrarMarcadores()) renderMarkers(glebas);

  log('main: gleba', gleba.gleba, 'atualizada via edição visual');
}

function onGlebaRemovedFromMap(glebaId) {
  removeGleba(glebaId);
  syncStateToTextarea();
  const glebas = getGlebas();
  updateResultsTable(glebas);
  renderGlebas(glebas);
  if (isMostrarMarcadores()) renderMarkers(glebas);
}

// ── Per-gleba edit/remove (from popups, panel, results table) ───────────────

function handleGlebaEdit(glebaId) {
  enableGlebaEdit(glebaId);
  showMessage('<i class="bi bi-info-circle"></i> Arraste os vértices para editar. Clique no segmento para adicionar vértices.', 'info', 5000);
}

function handleGlebaRemove(glebaId) {
  const gleba = getGlebaById(glebaId);
  if (!gleba) return;
  if (!confirm(`Remover Gleba ${gleba.gleba}?`)) return;

  onGlebaRemovedFromMap(glebaId);
  showMessage(`Gleba ${gleba.gleba} removida.`, 'info', 2000);
}

function handleGlebaZoom(glebaId) {
  flashGleba(glebaId);
}

// ── Inicialização ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('main: inicializando aplicação CGRN');

  // 1. Inicializar mapa
  initMap();

  // 2. Inicializar UI
  initUI();

  // 3. Configurar eventos Geoman
  setupGeomanEvents(onGlebaCreatedFromMap, onGlebaEditedFromMap, onGlebaRemovedFromMap);

  // 4. Vincular eventos de botões
  $('adicionar-gleba-btn')?.addEventListener('click', onAdicionarGleba);
  $('calcularArea')?.addEventListener('click', onCalcularArea);
  $('desenharGleba')?.addEventListener('click', onDesenharGleba);
  $('limparMapa')?.addEventListener('click', onLimpar);
  $('exportCSV')?.addEventListener('click', onExportCSV);
  $('exportGeoJSON')?.addEventListener('click', onExportGeoJSON);
  $('exportImage')?.addEventListener('click', onExportImage);
  $('saveProject')?.addEventListener('click', onSaveProject);
  $('darkModeToggle')?.addEventListener('click', onToggleDarkMode);
  $('insertExample')?.addEventListener('click', onInsertExample);
  $('editarCoordsBtn')?.addEventListener('click', onEditCoords);
  $('applyCoordEdits')?.addEventListener('click', onApplyCoordEdits);
  $('validarPontosBtn')?.addEventListener('click', onValidarPontos);
  $('addCoordRow')?.addEventListener('click', addCoordRow);
  $('glebaPanelClose')?.addEventListener('click', () => {
    $('glebaPanel')?.classList.add('d-none');
  });

  // Mostrar marcadores toggle
  $('mostrarMarcadores')?.addEventListener('change', () => {
    if (isMostrarMarcadores()) {
      const glebas = getGlebas();
      if (glebas.length > 0) renderMarkers(glebas);
    } else {
      clearMarkers();
    }
  });

  // Filtro de glebas no modal de edição de coordenadas
  $('coordEditGlebaSelect')?.addEventListener('change', (e) => {
    populateCoordTable(e.target.value);
  });

  // 5. Upload de arquivo
  setupFileUpload((normalized) => {
    processarCoordenadas();
  });

  // 6. Delegação de cliques globais (projetos, popup editar/remover, painel, resultados, coord table)
  document.addEventListener('click', (e) => {
    // Projetos
    const loadBtn = e.target.closest('.project-load');
    if (loadBtn) {
      e.preventDefault();
      const name = loadBtn.dataset.name;
      loadProject(name, () => processarCoordenadas());
    }

    const delBtn = e.target.closest('.project-delete');
    if (delBtn) {
      e.preventDefault();
      const name = delBtn.dataset.name;
      if (confirm(`Excluir projeto "${name}"?`)) {
        deleteProject(name);
      }
    }

    // Popup edit/remove (from polygon popups)
    const popupEditBtn = e.target.closest('.popup-edit-btn');
    if (popupEditBtn) {
      e.preventDefault();
      handleGlebaEdit(popupEditBtn.dataset.glebaId);
    }

    const popupRemoveBtn = e.target.closest('.popup-remove-btn');
    if (popupRemoveBtn) {
      e.preventDefault();
      handleGlebaRemove(popupRemoveBtn.dataset.glebaId);
    }

    // Panel edit/remove/zoom
    const panelEditBtn = e.target.closest('.panel-edit-btn');
    if (panelEditBtn) {
      e.preventDefault();
      handleGlebaEdit(panelEditBtn.dataset.glebaId);
    }

    const panelRemoveBtn = e.target.closest('.panel-remove-btn');
    if (panelRemoveBtn) {
      e.preventDefault();
      handleGlebaRemove(panelRemoveBtn.dataset.glebaId);
    }

    const panelZoomBtn = e.target.closest('.panel-zoom-btn');
    if (panelZoomBtn) {
      e.preventDefault();
      handleGlebaZoom(panelZoomBtn.dataset.glebaId);
    }

    // Results table edit/remove
    const resultEditBtn = e.target.closest('.result-edit-btn');
    if (resultEditBtn) {
      e.preventDefault();
      handleGlebaEdit(resultEditBtn.dataset.glebaId);
      const modalEl = $('resultadosModal');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    }

    const resultRemoveBtn = e.target.closest('.result-remove-btn');
    if (resultRemoveBtn) {
      e.preventDefault();
      handleGlebaRemove(resultRemoveBtn.dataset.glebaId);
      updateResultsTable(getGlebas());
    }

    // Coord table remove row
    const coordRemoveBtn = e.target.closest('.coord-remove-row');
    if (coordRemoveBtn) {
      e.preventDefault();
      const row = coordRemoveBtn.closest('tr');
      if (row) row.remove();
    }
  });

  // 7. Atualizar lista de projetos
  updateProjectList();

  // 8. Carregar camada SUDENE
  await loadSudeneLayer(
    () => toggleGlobalLoader(true),
    () => toggleGlobalLoader(false),
  );

  log('main: aplicação inicializada');
});
