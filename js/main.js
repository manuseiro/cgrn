/**
 * @file main.js — v3.0
 * @description Orquestrador principal da aplicação CGRN.
 *
 * Novidades v3.0:
 *   - KML import/export
 *   - Módulo de conformidade BACEN/SICOR com verificações ambientais
 *   - Camadas externas: UC (ICMBio), IBAMA embargos, biomas
 *   - Terras Indígenas com URL primária leosil21 + fallback local
 */

import { CONFIG } from './config.js';
import { state } from './state.js';
import {
  initMap, renderPolygons, renderMarkers, renderCentroids,
  clearMapLayers, zoomToGleba,
  setGlebasVisible, setMarkersVisible, setCentroidsVisible
} from './map.js';
import { validateCoordinates } from './validation.js';
import {
  showMessage, showToast, clearMessage,
  setButtonLoading, setButtonNormal,
  renderResultsTable, applyDarkMode, setSudeneStatus,
  getCoordText, setCoordText, hideModal, showModal,
  updateStatusBar, el, log
} from './ui.js';
import {
  exportToCSV, exportToGeoJSON,
  exportToKML, exportMapImage
} from './export.js';
import { loadSudeneLayer } from './sudene.js';
import { initFileUpload } from './upload.js';
import {
  saveProject, loadProject,
  clearSavedProject, checkSavedProject
} from './persistence.js';
import {
  loadTerrasIndigenas, setTerrasIndigenasVisible,
  checkGlebaTI, buildTILegend
} from './terras_indigenas.js';
import {
  createUCLayer, createIBAMALayer,
  createBiomaLayer
} from './camadas_externas.js';
import { verificarConformidade, CHECKS } from './conformidade.js';

// ─── Boot ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('CGRN v3.0 inicializando...');
  initMap();
  bindEvents();
  initFileUpload(el.fileUpload);
  checkSavedProject();
  initLegend();

  // Carregamentos em paralelo
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
    updateStatusBar([]);
    renderResultsTable([]);
    showToast('Mapa limpo.', 'info', 2000);
  });

  // Navbar
  el.btnCalcular?.addEventListener('click', e => { e.preventDefault(); processAndRender({ abrirResultados: true }); });
  el.btnValidarNav?.addEventListener('click', e => { e.preventDefault(); showModal('adicionarGleba'); setTimeout(validarInline, 350); });
  el.btnDesenhar?.addEventListener('click', e => {
    e.preventDefault();
    hideModal('adicionarGleba');
    new L.Draw.Polygon(state.map, state.drawControl.options.draw.polygon).enable();
    showToast('Clique no mapa para iniciar. Clique no 1º ponto para fechar.', 'info', 6000);
  });
  el.btnDarkMode?.addEventListener('click', () => { state.darkMode = !state.darkMode; applyDarkMode(state.darkMode); });

  // Botão de conformidade BACEN
  document.getElementById('btnConformidade')?.addEventListener('click', () => {
    runConformidade(state.glebas);
  });

  // Exportações (navbar + modal footer via data-export)
  document.querySelectorAll('[data-export="csv"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); exportToCSV(state.glebas); }));
  document.querySelectorAll('[data-export="geojson"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); exportToGeoJSON(state.glebas); }));
  document.querySelectorAll('[data-export="kml"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); exportToKML(state.glebas); }));
  document.querySelectorAll('[data-export="image"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); exportMapImage(); }));

  // Checkboxes de visualização
  el.mostrarGlebas?.addEventListener('change', e => setGlebasVisible(e.target.checked));
  el.mostrarMarcadores?.addEventListener('change', e => {
    // Bug corrigido: state.showMarkers deve ser atualizado SEMPRE
    // e a lógica precisa cobrir 3 casos:
    //   1) ativar sem glebas ainda → não faz nada (renderiza quando glebas chegarem)
    //   2) ativar com glebas mas sem layers criados → renderiza pela primeira vez
    //   3) ativar com layers já criados (foram ocultados) → apenas reexibe
    state.showMarkers = e.target.checked;
    if (e.target.checked) {
      if (!state.glebas.length) return; // sem glebas: processAndRender fará isso depois
      if (!state.markerLayers.length) renderMarkers(state.glebas); // caso 2
      else setMarkersVisible(true);                                 // caso 3
    } else {
      setMarkersVisible(false);
    }
  });
  el.mostrarCentroids?.addEventListener('change', e => {
    // Mesma lógica corrigida para centroids
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
    showModal('adicionarGleba');
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
    processAndRender();
  });

  // Tabela de resultados
  el.resultadosTableBody?.addEventListener('click', e => {
    const ed = e.target.closest('.btn-editar-gleba');
    const zm = e.target.closest('.btn-zoom-gleba');
    const cf = e.target.closest('.btn-conf-gleba');
    if (ed) editarGleba(+ed.dataset.glebaId);
    if (zm) { hideModal('resultadosModal'); zoomToGleba(+zm.dataset.glebaId); }
    if (cf) showConformidadeDetalhe(+cf.dataset.glebaId);
  });

  // Visualizar CAR no mapa (evento delegado para o body do modal de conformidade)
  document.getElementById('conformidadeBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-view-car-map');
    if (!btn) return;
    const gid = +btn.dataset.glebaId;
    const conf = state.conformidade.get(gid);
    const carItem = conf?.itens.find(i => i.id === 'car');
    if (carItem && carItem.dados) {
      hideModal('conformidadeModal');
      hideModal('resultadosModal');
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
    hideModal('editarGlebaModal');
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
  const map = { uc: 'ucLayer', ibama: 'ibamaLayer', bioma: 'biomeLayer' };
  const createMap = { uc: createUCLayer, ibama: createIBAMALayer, bioma: createBiomaLayer };
  const stateKey = map[key];

  if (visible) {
    if (!state[stateKey]) {
      state[stateKey] = createMap[key]();
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

    // Verifica TI (local, rápido)
    glebas.forEach(g => {
      g.tiIntersecoes = state.tiLoaded ? checkGlebaTI(g) : [];
    });

    state.glebas = glebas;
    renderPolygons(state.glebas);
    if (state.showMarkers) renderMarkers(state.glebas);
    if (state.showCentroids) renderCentroids(state.glebas);
    renderResultsTable(state.glebas);

    // Feedback TI imediato
    const tiConflitos = glebas.flatMap(g => g.tiIntersecoes);
    if (tiConflitos.length) {
      const nomes = [...new Set(tiConflitos.map(t => t.nome))].join(', ');
      showMessage(`<i class="bi bi-exclamation-triangle-fill"></i> <strong>Atenção BACEN/SICOR:</strong> ${tiConflitos.length} sobreposição(ões) com Terra(s) Indígenas: ${nomes}.`, 'warning');
      showToast(`<i class="bi bi-feather me-1"></i> ${tiConflitos.length} sobreposição(ões) com TI detectada(s).`, 'warning', 8000);
    } else {
      const note = result.fromCache ? ' <em>(cache)</em>' : '';
      showMessage(`<i class="bi bi-patch-check-fill me-1"></i> ${glebas.length} gleba(s) processada(s).${note}`, 'success', 3500);
    }

    if (opts.fecharModal) hideModal(opts.fecharModal);
    if (opts.abrirResultados) showModal('resultadosModal');

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

    // Executa em paralelo por gleba, com timeout por API
    const resultados = await Promise.allSettled(
      glebas.map(g => verificarConformidade(g, { skipApi: false }))
    );

    const aprovadas = resultados.filter(r => r.status === 'fulfilled' && !r.value.reprovada).length;
    const reprovadas = resultados.filter(r => r.status === 'fulfilled' && r.value.reprovada).length;
    const pendentes = resultados.filter(r => r.status === 'rejected').length;

    // Re-renderiza tabela com dados de conformidade
    renderResultsTable(state.glebas);
    showModal('resultadosModal');

    const msg = reprovadas > 0
      ? `<i class="bi bi-x-octagon-fill"></i> ${reprovadas} gleba(s) REPROVADA(s). ${aprovadas} aprovada(s). Veja detalhes na tabela.`
      : `<i class="bi bi-patch-check-fill"></i> ${aprovadas} gleba(s) sem bloqueios BACEN/SICOR.${pendentes ? ` <i class="bi bi-hourglass-split"></i> ${pendentes} verificação(ões) pendente(s) (API timeout).` : ''}`;

    showToast(msg, reprovadas > 0 ? 'danger' : 'success', 8000);

  } finally {
    if (btn) setButtonNormal(btn);
    state.isProcessing = false;
  }
}

/** Exibe detalhe de conformidade de uma gleba no modal dedicado */
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
  } else {
    const rows = conf.itens.map(item => {
      const ico = {
        ok: '<i class="bi bi-patch-check-fill"></i>',
        info: '<i class="bi bi-info-circle-fill"></i>',
        alerta: '<i class="bi bi-exclamation-triangle-fill"></i>',
        bloqueio: '<i class="bi bi-x-octagon-fill"></i>',
        pendente: '<i class="bi bi-hourglass-split"></i>'
      }[item.status] ?? '—';
      const cls = { ok: 'success', info: 'info', alerta: 'warning', bloqueio: 'danger', pendente: 'secondary' }[item.status] ?? 'secondary';

      // Adição de detalhes específicos para o CAR
      let extraInfo = '';
      if (item.id === 'car' && item.status !== 'pendente') {
        const hasGeo = item.dados?.some(d => d.geometry);
        const carCount = item.dados?.length ?? 0;

        if (item.coverage !== undefined) {
          extraInfo = `
            <div class="mt-2">
              <div class="mb-2">
                <span class="badge bg-light text-dark border">Cobertura: ${item.coverage}%</span>
                ${item.carAreaHa ? `<span class="badge bg-light text-dark border ms-1">Área Total CAR: ${item.carAreaHa.toFixed(2)} ha</span>` : ''}
              </div>
              
              ${carCount > 0 ? `
                <div class="card card-body p-2 bg-light-subtle border-0 small mb-2 shadow-sm">
                  <div class="fw-bold mb-1 text-muted text-uppercase" style="font-size:0.65rem">Imóvel(is) Detectado(s):</div>
                  <ul class="list-unstyled mb-0">
                    ${item.dados.map(d => `
                      <li class="mb-1 pb-1 border-bottom border-light-subtle">
                        <code class="text-primary fw-bold" style="font-size:0.75rem">${d.codigo}</code><br>
                        <span class="text-muted" style="font-size:0.7rem">${d.municipio} — ${d.areaHa.toFixed(2)} ha</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}

              ${hasGeo ? `
                <button class="btn btn-sm btn-success w-100 btn-view-car-map mt-1 shadow-sm" data-gleba-id="${conf.glebaId}">
                  <i class="bi bi-map-fill me-1"></i> Ver Polígonos do CAR no Mapa
                </button>
              ` : '<div class="small text-muted border p-1 rounded bg-light"><i class="bi bi-info-circle me-1"></i> Geometria indisponível para visualização direta.</div>'}
            </div>`;
        }
      }

      return `<tr>
        <td class="text-${cls} fw-semibold">${ico}</td>
        <td><strong>${item.label}</strong><br>
            <small class="text-muted font-monospace">${item.ref}</small></td>
        <td>${item.mensagem}${extraInfo}</td>
      </tr>`;
    }).join('');

    const sintCls = conf.reprovada ? 'danger' : conf.temAlerta ? 'warning' : 'success';
    body.innerHTML = `
      <div class="alert alert-${sintCls} mb-3"><strong>${conf.sintese}</strong></div>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle mb-0">
          <thead class="table-secondary">
            <tr><th style="width:2.5rem"></th><th>Verificação</th><th>Resultado</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <small class="text-muted d-block mt-2">
        Verificado em: ${new Date(conf.timestamp).toLocaleString('pt-BR')}
      </small>`;
  }

  showModal('conformidadeModal');
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
  hideModal('resultadosModal');
  showModal('editarGlebaModal');
}
