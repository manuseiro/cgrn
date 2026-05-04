/**
 * @file main.js
 * @description Ponto de entrada da aplicação CGRN.
 * Coordena módulos — sem lógica de negócio própria.
 *
 * Fluxo replicado do site de referência (glebas.com.br):
 *  1. Adicionar Gleba  → valida + desenha no mapa + fecha modal
 *  2. Validar Glebas   → valida inline SEM fechar modal
 *  3. Calcular Áreas   → processa + abre modal de resultados
 *
 * Adições v2.1:
 *  - Verificação automática de sobreposição com Terras Indígenas
 *  - Camada TI com toggle de visibilidade e legenda interativa
 *  - Alerta visual e detalhes na tabela de resultados
 */

import { CONFIG } from './config.js';
import { state } from './state.js';
import {
  initMap,
  renderPolygons, renderMarkers, renderCentroids,
  clearMapLayers, zoomToGleba,
  setGlebasVisible, setMarkersVisible,
  setCentroidsVisible
} from './map.js';
import { validateCoordinates } from './validation.js';
import {
  showMessage, showToast, clearMessage,
  setButtonLoading, setButtonNormal,
  renderResultsTable, applyDarkMode,
  setSudeneStatus, getCoordText,
  setCoordText, hideModal, showModal,
  updateStatusBar, el, log
} from './ui.js';
import {
  exportToCSV, exportToGeoJSON,
  exportMapImage
} from './export.js';
import { loadSudeneLayer } from './sudene.js';
import { initFileUpload } from './upload.js';
import {
  saveProject, loadProject,
  clearSavedProject,
  checkSavedProject
} from './persistence.js';
import {
  loadTerrasIndigenas,
  setTerrasIndigenasVisible,
  checkGlebaTI,
  buildTILegend
} from './terras_indigenas.js';

// ─── Boot ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('CGRN v2.1 inicializando...');

  initMap();                          // 1. Mapa Leaflet + controles
  bindEvents();                       // 2. Todos os listeners
  initFileUpload(el.fileUpload);      // 3. Upload CSV/TXT
  checkSavedProject();                // 4. Info projeto salvo na UI
  initLegend();                       // 5. Painel de legenda TI no mapa

  // Carregamentos em paralelo (não bloqueiam a UI)
  setSudeneStatus('loading');

  const [,] = await Promise.allSettled([
    loadSudeneLayer(),
    loadTerrasIndigenas(),
  ]);

  log('CGRN pronto.');
});

// ─── Legenda TI ───────────────────────────────────────────────────────────

function initLegend() {
  const el = document.getElementById('tiLegendContent');
  if (el) el.innerHTML = buildTILegend();
}

// ─── Event Bindings ───────────────────────────────────────────────────────

function bindEvents() {

  // ━━ Modal: Adicionar / Validar Gleba ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  el.btnAdicionar?.addEventListener('click', async () => {
    await processAndRender({ fecharModal: 'adicionarGleba' });
  });

  el.btnValidar?.addEventListener('click', async () => {
    await validarInline();
  });

  el.btnInserirExemplo?.addEventListener('click', () => {
    setCoordText(CONFIG.EXAMPLE_COORDS);
    clearMessage();
  });

  el.btnLimparMapa?.addEventListener('click', () => {
    clearMapLayers();
    setCoordText('');
    clearMessage();
    state.cache.clear();
    updateStatusBar([]);
    renderResultsTable([]);
    showToast('Mapa limpo com sucesso.', 'info', 2000);
  });

  // ━━ Navbar / Menu ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  el.btnCalcular?.addEventListener('click', async (e) => {
    e.preventDefault();
    await processAndRender({ abrirResultados: true });
  });

  el.btnValidarNav?.addEventListener('click', async (e) => {
    e.preventDefault();
    showModal('adicionarGleba');
    setTimeout(validarInline, 350);
  });

  el.btnDesenhar?.addEventListener('click', (e) => {
    e.preventDefault();
    hideModal('adicionarGleba');
    new L.Draw.Polygon(state.map, state.drawControl.options.draw.polygon).enable();
    showToast('Clique no mapa para iniciar. Clique no 1º ponto para fechar o polígono.', 'info', 6000);
  });

  el.btnDarkMode?.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    applyDarkMode(state.darkMode);
  });

  // ━━ Exportação — data-export em navbar E modal footer ━━━━━━━━━━━━━━━━━━

  document.querySelectorAll('[data-export="csv"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); exportToCSV(state.glebas); });
  });
  document.querySelectorAll('[data-export="geojson"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); exportToGeoJSON(state.glebas); });
  });
  document.querySelectorAll('[data-export="image"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      exportMapImage(); // Bug corrigido: antes era `() => exportMapImage` sem chamar
    });
  });

  // ━━ Checkboxes de visualização ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  el.mostrarGlebas?.addEventListener('change', (e) => {
    setGlebasVisible(e.target.checked);
  });

  el.mostrarMarcadores?.addEventListener('change', (e) => {
    if (e.target.checked && !state.markerLayers.length) renderMarkers(state.glebas);
    else setMarkersVisible(e.target.checked);
  });

  el.mostrarCentroids?.addEventListener('change', (e) => {
    if (e.target.checked && !state.centroidLayers.length) renderCentroids(state.glebas);
    else setCentroidsVisible(e.target.checked);
  });

  // Toggle Terras Indígenas
  el.mostrarTI?.addEventListener('change', (e) => {
    setTerrasIndigenasVisible(e.target.checked);
    // Mostra/oculta painel de legenda
    const legend = document.getElementById('tiLegendPanel');
    if (legend) legend.classList.toggle('d-none', !e.target.checked);
  });

  el.validarPontos?.addEventListener('change', (e) => {
    state.validatePoints = e.target.checked;
    state.cache.clear(); // Invalida cache ao mudar modo
    log('validarPontos:', state.validatePoints);
  });

  // Toggle do painel de legenda TI no mapa
  document.getElementById('btnToggleLegenda')?.addEventListener('click', () => {
    const body = document.getElementById('tiLegendBody');
    const icon = document.getElementById('legendToggleIcon');
    if (!body) return;
    const collapsed = body.classList.toggle('d-none');
    if (icon) icon.className = collapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
  });

  // ━━ Leaflet.Draw ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  state.map.on('draw:created', (e) => {
    const latlngs = e.layer.getLatLngs()[0];
    const lines = latlngs.map((ll, i) =>
      `1 ${i + 1} ${ll.lat.toFixed(6)} ${ll.lng.toFixed(6)}`
    );
    // Fecha o polígono (repete o 1º ponto)
    const first = latlngs[0];
    lines.push(`1 ${lines.length + 1} ${first.lat.toFixed(6)} ${first.lng.toFixed(6)}`);
    setCoordText(lines.join('\n'));
    clearMessage();
    showModal('adicionarGleba');
    log(`Polígono desenhado: ${lines.length} pontos`);
  });

  state.map.on('draw:edited', (e) => {
    const lines = [];
    let glebaIdx = 1;
    e.layers.eachLayer(layer => {
      const pts = layer.getLatLngs()[0];
      pts.forEach((ll, i) => {
        lines.push(`${glebaIdx} ${i + 1} ${ll.lat.toFixed(6)} ${ll.lng.toFixed(6)}`);
      });
      // Fecha
      const f = pts[0];
      lines.push(`${glebaIdx} ${pts.length + 1} ${f.lat.toFixed(6)} ${f.lng.toFixed(6)}`);
      glebaIdx++;
    });
    setCoordText(lines.join('\n'));
    state.cache.clear();
    processAndRender();
  });

  // ━━ Tabela de resultados (delegação de eventos) ━━━━━━━━━━━━━━━━━━━━━━━━

  el.resultadosTableBody?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar-gleba');
    const btnZoom = e.target.closest('.btn-zoom-gleba');
    if (btnEditar) editarGleba(parseInt(btnEditar.dataset.glebaId, 10));
    if (btnZoom) {
      hideModal('resultadosModal');
      zoomToGleba(parseInt(btnZoom.dataset.glebaId, 10));
    }
  });

  // ━━ Modal: Editar Gleba ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  document.getElementById('confirmarEdicao')?.addEventListener('click', async () => {
    const novas = el.glebaEditArea?.value?.trim() ?? '';
    if (!novas) return;
    const glebaId = parseInt(el.editGlebaId?.value ?? '0', 10);
    const outras = getCoordText()
      .split('\n')
      .filter(l => parseInt(l.trim().split(/\s+/)[0]) !== glebaId);
    setCoordText([...outras, ...novas.split('\n').filter(l => l.trim())].join('\n'));
    state.cache.clear();
    hideModal('editarGlebaModal');
    await processAndRender({ abrirResultados: true });
  });

  // ━━ Modal: Projeto ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  el.btnSalvarProjeto?.addEventListener('click', () => {
    saveProject(el.projectName?.value?.trim() || 'Projeto CGRN', state.glebas.length);
  });

  el.btnCarregarProjeto?.addEventListener('click', () => {
    const project = loadProject();
    if (project && el.projectName) el.projectName.value = project.name;
  });

  document.getElementById('btnLimparProjeto')?.addEventListener('click', () => {
    if (confirm('Apagar o projeto salvo do armazenamento local?')) clearSavedProject();
  });

  log('Todos os eventos vinculados');
}

// ─── Fluxo principal ──────────────────────────────────────────────────────

/**
 * Valida, processa glebas, verifica Terras Indígenas e renderiza.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.fecharModal]     ID do modal a fechar após sucesso
 * @param {boolean} [opts.abrirResultados] Abre o modal de resultados
 */
async function processAndRender(opts = {}) {
  if (state.isProcessing) return;
  state.isProcessing = true;

  const btn = opts.fecharModal ? el.btnAdicionar
    : opts.abrirResultados ? el.btnCalcular
      : null;

  if (btn) setButtonLoading(btn, 'Processando...');

  try {
    // ── 1. Validação geoespacial ─────────────────────────────────────────
    const result = validateCoordinates(getCoordText(), {
      validarPontos: state.validatePoints,
    });

    if (!result.valid) {
      const modalAberto = document.querySelector('.modal.show');
      if (modalAberto?.id === 'adicionarGleba') showMessage(result.errors, 'danger');
      else showToast(result.errors, 'danger', 8000);
      return;
    }

    // ── 2. Verificação de sobreposição com Terras Indígenas ─────────────
    //   Executado após validação bem-sucedida; enriquece cada GlebaData
    //   com campo `tiIntersecoes` (array) para uso na tabela e alertas.
    const glebas = result.data;
    let totalTiConflitos = 0;

    if (state.tiLoaded) {
      glebas.forEach(g => {
        g.tiIntersecoes = checkGlebaTI(g);    // [] ou [{ nome, fase, areaHa, ... }]
        totalTiConflitos += g.tiIntersecoes.length;
      });
    } else {
      glebas.forEach(g => { g.tiIntersecoes = []; });
    }

    state.glebas = glebas;

    // ── 3. Render ────────────────────────────────────────────────────────
    renderPolygons(state.glebas);
    if (state.showMarkers) renderMarkers(state.glebas);
    if (state.showCentroids) renderCentroids(state.glebas);
    renderResultsTable(state.glebas);

    // ── 4. Feedback ──────────────────────────────────────────────────────
    const cacheNote = result.fromCache ? ' <em>(cache)</em>' : '';

    // Alerta de sobreposição TI (prioridade alta)
    if (totalTiConflitos > 0) {
      const nomes = [...new Set(
        glebas.flatMap(g => g.tiIntersecoes.map(ti => ti.nome))
      )].join(', ');
      showMessage(
        `<i class="bi bi-exclamation-triangle"></i> <strong>Atenção:</strong> ${totalTiConflitos} sobreposição(ões) com Terra(s) Indígena(s) detectada(s): ${nomes}.`,
        'warning'
      );
      showToast(
        `<i class="bi bi-heart-arrow"></i> Sobreposição com Terras Indigínes detectada em ${totalTiConflitos} gleba(s).`,
        'warning', 8000
      );
    } else {
      showMessage(
        `✅ ${state.glebas.length} gleba(s) processada(s).${cacheNote}`,
        'success', 3500
      );
    }

    if (opts.fecharModal) hideModal(opts.fecharModal);
    if (opts.abrirResultados) showModal('resultadosModal');

  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Validação inline (sem renderizar) ────────────────────────────────────

async function validarInline() {
  if (state.isProcessing) return;
  state.isProcessing = true;

  const btn = el.btnValidar;
  if (btn) setButtonLoading(btn, 'Validando...');

  try {
    const result = validateCoordinates(getCoordText(), {
      validarPontos: state.validatePoints,
    });

    if (!result.valid) {
      showMessage(result.errors, 'danger');
      return;
    }

    // Verificação TI mesmo na validação inline
    let tiAvisos = 0;
    if (state.tiLoaded) {
      result.data.forEach(g => {
        const hits = checkGlebaTI(g);
        tiAvisos += hits.length;
      });
    }

    const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 });
    const area = fmt.format(result.data.reduce((s, g) => s + g.area, 0));

    let msgExtras = '';
    if (tiAvisos > 0) {
      msgExtras = `<br><span class="text-warning">⚠️ ${tiAvisos} sobreposição(ões) com Terra(s) Indígena(s).</span>`;
    }

    showMessage(
      `✅ ${result.data.length} gleba(s) válida(s) — área total: <strong>${area} ha</strong>.${msgExtras}`,
      tiAvisos > 0 ? 'warning' : 'success'
    );

  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Edição de gleba ──────────────────────────────────────────────────────

function editarGleba(glebaId) {
  const gleba = state.glebas.find(g => g.glebaId === glebaId);
  if (!gleba) return;

  const lines = gleba.coords.map(([lat, lon], i) =>
    `${glebaId} ${i + 1} ${lat.toFixed(6)} ${lon.toFixed(6)}`
  );

  if (el.glebaEditArea) el.glebaEditArea.value = lines.join('\n');
  if (el.editGlebaId) el.editGlebaId.value = String(glebaId);

  const label = document.getElementById('editarGlebaModalLabel');
  if (label) label.textContent = `Editar Gleba ${glebaId}`;

  hideModal('resultadosModal');
  showModal('editarGlebaModal');
}
