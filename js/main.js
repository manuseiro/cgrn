/**
 * @file main.js — v3.4
 * @description Orquestrador principal da aplicação CGRN.
 *
 * Novidades v3.4:
 *   - Painel CAR no modal de conformidade completamente redesenhado:
 *       · Barra de cobertura visual (total e por imóvel individual)
 *       · Campo "Área descoberta" (uncoveredHa) quando aplicável
 *       · Botão "Acessar CAR no site oficial" por imóvel
 *       · Distinção visual entre imóvel principal e adjacentes
 *   - Cache CAR invalidado automaticamente ao editar gleba
 */

import { CONFIG } from './utils/config.js';
import { state } from './utils/state.js';
import {
  initMap, renderPolygons, renderMarkers, renderCentroids,
  clearMapLayers, zoomToGleba,
  setGlebasVisible, setMarkersVisible, setCentroidsVisible
} from './map.js';
import { validateCoordinates } from './services/validation.js';
import {
  showMessage, showToast, clearMessage,
  setButtonLoading, setButtonNormal,
  renderResultsTable, applyDarkMode, setSudeneStatus,
  getCoordText, setCoordText, hideModal, showModal,
  updateStatusBar, el, log
} from './components/ui.js';
import {
  exportToCSV, exportToGeoJSON,
  exportToKML, exportMapImage, exportProject
} from './utils/export.js';
import { loadSudeneLayer } from './services/sudene.js';
import { initFileUpload } from './upload.js';
import {
  saveProject, loadProject,
  clearSavedProject, checkSavedProject
} from './services/persistence.js';
import {
  loadTerrasIndigenas, setTerrasIndigenasVisible,
  checkGlebaTI, buildTILegend
} from './services/terras_indigenas.js';
import {
  createUCLayer, createIBAMALayer, createBiomaLayer,
  invalidarCacheCAR,
} from './services/camadas_externas.js';
import { verificarConformidade, CHECKS } from './services/conformidade.js';
import { modals } from './components/modal.js';

// ─── Boot ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('CGRN v3.4 inicializando...');
  initMap();
  bindEvents();
  initFileUpload(el.fileUpload);
  checkSavedProject();
  initLegend();

  setSudeneStatus('loading');
  await Promise.allSettled([
    loadSudeneLayer(),
    loadTerrasIndigenas(),
  ]);

  log('CGRN pronto ✅');
});

function initLegend() {
  const node = document.getElementById('tiLegendContent');
  if (node) node.innerHTML = buildTILegend();
}

// ─── Eventos ──────────────────────────────────────────────────────────────

function bindEvents() {

  // Modal: Adicionar Gleba
  el.btnAdicionar?.addEventListener('click', () => processAndRender({ fecharModal: 'adicionarGleba' }));
  el.btnValidar?.addEventListener('click', validarInline);
  el.btnInserirExemplo?.addEventListener('click', () => { setCoordText(CONFIG.EXAMPLE_COORDS); clearMessage(); });
  el.btnLimparMapa?.addEventListener('click', () => {
    clearMapLayers();
    setCoordText('');
    clearMessage();
    state.cache.clear();
    invalidarCacheCAR(); // limpa todo o cache CAR
    updateStatusBar([]);
    renderResultsTable([]);
    showToast('Mapa limpo.', 'info', 2000);
  });

  // Navbar
  el.btnCalcular?.addEventListener('click', e => { e.preventDefault(); processAndRender({ abrirResultados: true }); });
  el.btnValidarNav?.addEventListener('click', e => { e.preventDefault(); modals.show('adicionarGleba'); setTimeout(validarInline, 350); });
  el.btnDesenhar?.addEventListener('click', e => {
    e.preventDefault();
    modals.hide('adicionarGleba');
    new L.Draw.Polygon(state.map, state.drawControl.options.draw.polygon).enable();
    showToast('Clique no mapa para iniciar. Clique no 1º ponto para fechar.', 'info', 6000);
  });
  el.btnDarkMode?.addEventListener('click', () => { state.darkMode = !state.darkMode; applyDarkMode(state.darkMode); });

  // Botão de conformidade BACEN
  document.getElementById('btnConformidade')?.addEventListener('click', () => {
    runConformidade(state.glebas);
  });

  // Exportações
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-export]');
    if (!btn) return;
    e.preventDefault();
    const type = btn.dataset.export;
    switch (type) {
      case 'csv': exportToCSV(state.glebas); break;
      case 'geojson': exportToGeoJSON(state.glebas); break;
      case 'kml': exportToKML(state.glebas); break;
      case 'image': exportMapImage(); break;
      case 'project': exportProject(state.glebas); break;
    }
  });

  // Checkboxes de visualização
  el.mostrarGlebas?.addEventListener('change', e => setGlebasVisible(e.target.checked));
  el.mostrarMarcadores?.addEventListener('change', e => {
    state.showMarkers = e.target.checked;
    if (e.target.checked) {
      if (!state.glebas.length) return;
      if (!state.markerLayers.length) renderMarkers(state.glebas);
      else setMarkersVisible(true);
    } else {
      setMarkersVisible(false);
    }
  });
  el.mostrarCentroids?.addEventListener('change', e => {
    state.showCentroids = e.target.checked;
    if (e.target.checked) {
      if (!state.glebas.length) return;
      if (!state.centroidLayers.length) renderCentroids(state.glebas);
      else setCentroidsVisible(true);
    } else {
      setCentroidsVisible(false);
    }
  });
  el.mostrarTI?.addEventListener('change', e => {
    setTerrasIndigenasVisible(e.target.checked);
    document.getElementById('tiLegendPanel')?.classList.toggle('d-none', !e.target.checked);
  });
  el.mostrarUC?.addEventListener('change', e => toggleExternalLayer('uc', e.target.checked));
  el.mostrarIbama?.addEventListener('change', e => toggleExternalLayer('ibama', e.target.checked));
  el.mostrarBioma?.addEventListener('change', e => toggleExternalLayer('bioma', e.target.checked));
  el.validarPontos?.addEventListener('change', e => { state.validatePoints = e.target.checked; state.cache.clear(); });

  // Legenda toggle
  document.getElementById('btnToggleLegenda')?.addEventListener('click', () => {
    const body = document.getElementById('tiLegendBody');
    const icon = document.getElementById('legendToggleIcon');
    if (!body) return;
    body.classList.toggle('d-none');
    if (icon) icon.className = body.classList.contains('d-none') ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
  });

  // Leaflet.Draw
  state.map.on('draw:created', e => {
    const pts = e.layer.getLatLngs()[0];
    const lines = pts.map((ll, i) => `1 ${i + 1} ${ll.lat.toFixed(6)} ${ll.lng.toFixed(6)}`);
    lines.push(`1 ${lines.length + 1} ${pts[0].lat.toFixed(6)} ${pts[0].lng.toFixed(6)}`);
    setCoordText(lines.join('\n'));
    clearMessage();
    modals.show('adicionarGleba');
  });
  state.map.on('draw:edited', e => {
    const lines = []; let gi = 1;
    e.layers.eachLayer(l => {
      const pts = l.getLatLngs()[0];
      pts.forEach((ll, i) => lines.push(`${gi} ${i + 1} ${ll.lat.toFixed(6)} ${ll.lng.toFixed(6)}`));
      lines.push(`${gi} ${pts.length + 1} ${pts[0].lat.toFixed(6)} ${pts[0].lng.toFixed(6)}`);
      gi++;
    });
    setCoordText(lines.join('\n'));
    state.cache.clear();
    invalidarCacheCAR();
    processAndRender();
  });

  // Tabela de resultados
  el.resultadosTableBody?.addEventListener('click', e => {
    const ed = e.target.closest('.btn-editar-gleba');
    const zm = e.target.closest('.btn-zoom-gleba');
    const cf = e.target.closest('.btn-conf-gleba');
    if (ed) editarGleba(+ed.dataset.glebaId);
    if (zm) { modals.hide('resultadosModal'); zoomToGleba(+zm.dataset.glebaId); }
    if (cf) showConformidadeDetalhe(+cf.dataset.glebaId);
  });

  // Visualizar CAR no mapa (evento delegado no body do modal)
  document.getElementById('conformidadeBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-view-car-map');
    if (!btn) return;
    const gid = +btn.dataset.glebaId;
    const conf = state.conformidade.get(gid);
    const carItem = conf?.itens.find(i => i.id === 'car');
    if (carItem?.dados?.length) {
      modals.hide('conformidadeModal');
      modals.hide('resultadosModal');
      import('./map.js').then(m => m.renderCARLayer(carItem.dados));
    }
  });

  // Modal Editar
  document.getElementById('confirmarEdicao')?.addEventListener('click', async () => {
    const novas = el.glebaEditArea?.value?.trim() ?? '';
    if (!novas) return;
    const gid = +(el.editGlebaId?.value ?? '0');
    const outras = getCoordText().split('\n')
      .filter(l => +l.trim().split(/\s+/)[0] !== gid);
    setCoordText([...outras, ...novas.split('\n').filter(l => l.trim())].join('\n'));
    state.cache.clear();
    invalidarCacheCAR(gid); // invalida apenas o cache da gleba editada
    modals.hide('editarGlebaModal');
    processAndRender({ abrirResultados: true });
  });

  // Projeto
  el.btnSalvarProjeto?.addEventListener('click', () => saveProject(el.projectName?.value?.trim() || 'Projeto CGRN', state.glebas.length));
  el.btnCarregarProjeto?.addEventListener('click', () => { const p = loadProject(); if (p && el.projectName) el.projectName.value = p.name; });
  document.getElementById('btnLimparProjeto')?.addEventListener('click', () => { if (confirm('Apagar projeto salvo?')) clearSavedProject(); });

  log('Eventos vinculados ✅');
}

// ─── Camadas externas on/off ───────────────────────────────────────────────

function toggleExternalLayer(key, visible) {
  const stateKeyMap = { uc: 'ucLayer', ibama: 'ibamaLayer', bioma: 'biomeLayer' };
  const createFnMap = { uc: createUCLayer, ibama: createIBAMALayer, bioma: createBiomaLayer };
  const stateKey = stateKeyMap[key];

  if (visible) {
    if (!state[stateKey]) {
      state[stateKey] = createFnMap[key]();
      log(`Camada ${key} criada`);
    }
    state[stateKey].addTo(state.map);
    if (key !== 'bioma') state[stateKey].bringToBack();
  } else {
    if (state[stateKey]) state.map.removeLayer(state[stateKey]);
  }
}

// ─── Processamento principal ──────────────────────────────────────────────

async function processAndRender(opts = {}) {
  if (state.isProcessing) return;
  state.isProcessing = true;
  const btn = opts.fecharModal ? el.btnAdicionar : opts.abrirResultados ? el.btnCalcular : null;
  if (btn) setButtonLoading(btn, 'Processando...');

  try {
    const result = validateCoordinates(getCoordText(), { validarPontos: state.validatePoints });
    if (!result.valid) {
      const modalAberto = document.querySelector('.modal.show');
      if (modalAberto?.id === 'adicionarGleba') showMessage(result.errors, 'danger');
      else showToast(result.errors, 'danger', 8000);
      return;
    }

    const glebas = result.data;
    glebas.forEach(g => {
      g.tiIntersecoes = state.tiLoaded ? checkGlebaTI(g) : [];
    });

    state.glebas = glebas;
    renderPolygons(state.glebas);
    if (state.showMarkers) renderMarkers(state.glebas);
    if (state.showCentroids) renderCentroids(state.glebas);
    renderResultsTable(state.glebas);

    const tiConflitos = glebas.flatMap(g => g.tiIntersecoes);
    if (tiConflitos.length) {
      const nomes = [...new Set(tiConflitos.map(t => t.nome))].join(', ');
      showMessage(`<i class="bi bi-exclamation-triangle-fill"></i> <strong>Atenção BACEN/SICOR:</strong> ${tiConflitos.length} sobreposição(ões) com Terra(s) Indígenas: ${nomes}.`, 'warning');
      showToast(`<i class="bi bi-feather me-1"></i> ${tiConflitos.length} sobreposição(ões) com TI detectada(s).`, 'warning', 8000);
    } else {
      const note = result.fromCache ? ' <em>(cache)</em>' : '';
      showMessage(`<i class="bi bi-patch-check-fill me-1"></i> ${glebas.length} gleba(s) processada(s).${note}`, 'success', 3500);
    }

    if (opts.fecharModal) modals.hide(opts.fecharModal);
    if (opts.abrirResultados) modals.show('resultadosModal');

  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Validação inline ─────────────────────────────────────────────────────

async function validarInline() {
  if (state.isProcessing) return;
  state.isProcessing = true;
  const btn = el.btnValidar;
  if (btn) setButtonLoading(btn, 'Validando...');
  try {
    const result = validateCoordinates(getCoordText(), { validarPontos: state.validatePoints });
    if (!result.valid) { showMessage(result.errors, 'danger'); return; }
    let tiAvisos = 0;
    if (state.tiLoaded) result.data.forEach(g => { tiAvisos += checkGlebaTI(g).length; });
    const area = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(result.data.reduce((s, g) => s + g.area, 0));
    const tiMsg = tiAvisos ? `<br><i class="bi bi-exclamation-triangle-fill"></i> ${tiAvisos} sobreposição(ões) TI.` : '';
    showMessage(`<i class="bi bi-patch-check-fill me-1"></i> ${result.data.length} gleba(s) válida(s) — ${area} ha.${tiMsg}`, tiAvisos ? 'warning' : 'success');
  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Conformidade BACEN/SICOR ─────────────────────────────────────────────

async function runConformidade(glebas) {
  if (!glebas.length) { showToast('Adicione glebas antes de verificar.', 'warning'); return; }
  if (state.isProcessing) return;
  state.isProcessing = true;

  const btn = document.getElementById('btnConformidade');
  if (btn) setButtonLoading(btn, 'Verificando...');

  try {
    showToast('Verificando conformidade BACEN/SICOR. Pode levar alguns segundos...', 'info', 4000);

    const resultados = await Promise.allSettled(
      glebas.map(g => verificarConformidade(g, { skipApi: false }))
    );

    const aprovadas = resultados.filter(r => r.status === 'fulfilled' && !r.value.reprovada).length;
    const reprovadas = resultados.filter(r => r.status === 'fulfilled' && r.value.reprovada).length;
    const pendentes = resultados.filter(r => r.status === 'rejected').length;

    renderResultsTable(state.glebas);
    modals.show('resultadosModal');

    const msg = reprovadas > 0
      ? `<i class="bi bi-x-octagon-fill"></i> ${reprovadas} gleba(s) REPROVADA(s). ${aprovadas} aprovada(s). Veja detalhes na tabela.`
      : `<i class="bi bi-patch-check-fill"></i> ${aprovadas} gleba(s) sem bloqueios BACEN/SICOR.${pendentes ? ` <i class="bi bi-hourglass-split"></i> ${pendentes} verificação(ões) pendente(s) (API timeout).` : ''}`;

    showToast(msg, reprovadas > 0 ? 'danger' : 'success', 8000);

  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Modal de Conformidade ─────────────────────────────────────────────────

/**
 * Exibe o detalhe de conformidade de uma gleba no modal dedicado.
 * O painel CAR inclui:
 *   - Barra de cobertura visual (total + melhor imóvel individual)
 *   - Área descoberta em hectares (uncoveredHa)
 *   - Lista de imóveis com cobertura individual e link para o SICAR
 *   - Botão "Ver polígonos no mapa" (quando geometria disponível)
 *
 * @param {number} glebaId
 */
function showConformidadeDetalhe(glebaId) {
  const conf = state.conformidade.get(glebaId);
  const modal = document.getElementById('conformidadeModal');
  const body = document.getElementById('conformidadeBody');
  const title = document.getElementById('conformidadeModalLabel');
  if (!modal || !body) return;

  if (title) title.textContent = `Conformidade BACEN/SICOR — Gleba ${glebaId}`;

  if (!conf) {
    body.innerHTML = `<div class="alert alert-info">
      Execute "Verificar Conformidade BACEN/SICOR" para analisar esta gleba.
    </div>`;
    modals.show('conformidadeModal');
    return;
  }

  const rows = conf.itens.map(item => {
    const ico = {
      ok: '<i class="bi bi-patch-check-fill"></i>',
      info: '<i class="bi bi-info-circle-fill"></i>',
      alerta: '<i class="bi bi-exclamation-triangle-fill"></i>',
      bloqueio: '<i class="bi bi-x-octagon-fill"></i>',
      pendente: '<i class="bi bi-hourglass-split"></i>',
    }[item.status] ?? '—';
    const cls = {
      ok: 'success', info: 'info', alerta: 'warning',
      bloqueio: 'danger', pendente: 'secondary',
    }[item.status] ?? 'secondary';

    // Painel expandido apenas para o item CAR
    const extraInfo = item.id === 'car' && item.status !== 'pendente'
      ? buildCARPanel(item, conf.glebaId)
      : '';

    return `<tr>
      <td class="text-${cls} fw-semibold text-center" style="width:2.5rem">${ico}</td>
      <td>
        <strong>${item.label}</strong><br>
        <small class="text-muted font-monospace">${item.ref}</small>
      </td>
      <td>${item.mensagem}${extraInfo}</td>
    </tr>`;
  }).join('');

  const sintCls = conf.reprovada ? 'danger' : conf.temAlerta ? 'warning' : 'success';

  body.innerHTML = `
    <div class="alert alert-${sintCls} mb-3 d-flex align-items-center gap-2">
      <span class="fs-5">${conf.reprovada ? '🚫' : conf.temAlerta ? '⚠️' : '✅'}</span>
      <strong>${conf.sintese}</strong>
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-secondary">
          <tr>
            <th style="width:2.5rem"></th>
            <th>Verificação</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <small class="text-muted d-block mt-2">
      <i class="bi bi-clock me-1"></i>
      Verificado em: ${new Date(conf.timestamp).toLocaleString('pt-BR')}
    </small>`;

  modals.show('conformidadeModal');
}

/**
 * Constrói o painel HTML expandido do item CAR no modal de conformidade.
 *
 * Inclui:
 *   - Badges de cobertura total e por melhor imóvel individual
 *   - Barra de progresso visual da cobertura
 *   - Alerta de área descoberta (quando uncoveredHa > 0.01)
 *   - Lista de imóveis detectados com:
 *       · Cobertura individual em badge colorido
 *       · Link "Acessar no SICAR" (car.gov.br)
 *   - Botão "Ver polígonos no mapa" (quando há geometria)
 *
 * @param {CheckItem} item   - Item CAR do resultado de conformidade
 * @param {number}    glebaId
 * @returns {string}  HTML do painel
 */
function buildCARPanel(item, glebaId) {
  const {
    coverage = 0,
    coverageMelhorCAR = 0,
    uncoveredHa = 0,
    carAreaHa = 0,
    nCARs = 0,
    dados = [],
  } = item;

  if (!dados.length) return ''; // sem dados — nada a exibir além da mensagem

  const hasGeo = dados.some(d => d.geometry);

  // Cor da barra de cobertura baseada no percentual
  const barColor = coverage >= 98 ? 'success'
    : coverage >= 50 ? 'warning'
      : 'danger';

  // Cor do badge de cobertura individual
  const badgeCovColor = (cov) => cov >= 98 ? 'success' : cov >= 50 ? 'warning' : 'danger';

  // ── Barra de cobertura ──────────────────────────────────────────────
  const coverageBar = `
    <div class="mb-2">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <small class="text-muted fw-semibold">Cobertura da gleba pelos CARs</small>
        <span class="badge bg-${barColor}">${coverage}%</span>
      </div>
      <div class="progress" style="height:8px" title="Cobertura total: ${coverage}%">
        <div class="progress-bar bg-${barColor}"
             role="progressbar"
             style="width:${coverage}%"
             aria-valuenow="${coverage}"
             aria-valuemin="0" aria-valuemax="100">
        </div>
      </div>
      ${nCARs > 1 && coverageMelhorCAR !== coverage ? `
        <div class="d-flex justify-content-between align-items-center mt-1">
          <small class="text-muted">Melhor imóvel individual</small>
          <span class="badge bg-secondary">${coverageMelhorCAR}%</span>
        </div>` : ''}
    </div>`;

  // ── Alerta de área descoberta ───────────────────────────────────────
  const alertDescoberta = uncoveredHa > 0.01 ? `
    <div class="alert alert-warning py-1 px-2 mb-2 d-flex align-items-center gap-2" style="font-size:0.8rem">
      <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
      <span>
        <strong>${uncoveredHa.toFixed(2)} ha</strong> da gleba estão fora de qualquer CAR registrado
        (${(100 - coverage).toFixed(1)}% descobertos).
      </span>
    </div>` : '';

  // ── Lista de imóveis ────────────────────────────────────────────────
  const listaImoveis = dados.map((d, idx) => {
    const cov = d.coverageIndividual ?? 0;
    const isPrincipal = idx === 0 && nCARs > 1; // melhor match quando há múltiplos
    const linkSICAR = d.codigo && d.codigo !== '—'
      ? `<a href="https://www.car.gov.br/publico/imoveis/index?cod_imovel=${encodeURIComponent(d.codigo)}"
            target="_blank" rel="noopener noreferrer"
            class="btn btn-outline-primary btn-sm py-0 px-1 ms-1"
            title="Acessar imóvel no SICAR (site oficial)">
           <i class="bi bi-box-arrow-up-right" style="font-size:0.7rem"></i> SICAR
         </a>`
      : '';

    return `
      <li class="mb-2 pb-2 ${idx < dados.length - 1 ? 'border-bottom border-light-subtle' : ''}">
        <div class="d-flex align-items-start gap-1 flex-wrap">
          <code class="text-primary fw-bold" style="font-size:0.78rem">${d.codigo}</code>
          ${isPrincipal ? '<span class="badge bg-primary" style="font-size:0.6rem">principal</span>' : ''}
          ${linkSICAR}
        </div>
        <div class="text-muted" style="font-size:0.72rem">
          ${d.municipio}
          ${d.areaHa ? ` · ${Number(d.areaHa).toFixed(2)} ha` : ''}
          ${d.status ? ` · <em>${d.status}</em>` : ''}
        </div>
        ${nCARs > 1 && cov > 0 ? `
          <div class="d-flex align-items-center gap-1 mt-1">
            <div class="progress flex-grow-1" style="height:5px">
              <div class="progress-bar bg-${badgeCovColor(cov)}"
                   style="width:${cov}%"></div>
            </div>
            <span class="badge bg-${badgeCovColor(cov)}" style="font-size:0.65rem">${cov}%</span>
          </div>` : ''}
      </li>`;
  }).join('');

  // ── Botão "Ver no mapa" ─────────────────────────────────────────────
  const btnMapa = hasGeo
    ? `<button class="btn btn-sm btn-success w-100 btn-view-car-map mt-2 shadow-sm"
               data-gleba-id="${glebaId}">
         <i class="bi bi-map-fill me-1"></i> Ver Polígonos do CAR no Mapa
       </button>`
    : `<div class="small text-muted border p-1 rounded bg-light mt-2">
         <i class="bi bi-info-circle me-1"></i>
         Geometria indisponível — visualização no mapa não disponível.
       </div>`;

  return `
    <div class="mt-2 border rounded p-2 bg-light-subtle shadow-sm" style="font-size:0.82rem">

      ${coverageBar}
      ${alertDescoberta}

      <div class="fw-bold text-muted text-uppercase mb-1" style="font-size:0.65rem">
        ${nCARs} Imóvel(is) Detectado(s)
        ${carAreaHa ? `· Área total: ${carAreaHa.toFixed(2)} ha` : ''}
      </div>
      <ul class="list-unstyled mb-0">${listaImoveis}</ul>

      ${btnMapa}
    </div>`;
}

// ─── Editar gleba ─────────────────────────────────────────────────────────

function editarGleba(glebaId) {
  const g = state.glebas.find(g => g.glebaId === glebaId);
  if (!g) return;
  const lines = g.coords.map(([lat, lon], i) => `${glebaId} ${i + 1} ${lat.toFixed(6)} ${lon.toFixed(6)}`);
  if (el.glebaEditArea) el.glebaEditArea.value = lines.join('\n');
  if (el.editGlebaId) el.editGlebaId.value = String(glebaId);
  const lbl = document.getElementById('editarGlebaModalLabel');
  if (lbl) lbl.textContent = `Editar Gleba ${glebaId}`;
  modals.hide('resultadosModal');
  modals.show('editarGlebaModal');
}