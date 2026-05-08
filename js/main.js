/**
 * @file main.js — v3.6.4
 * @description Orquestrador principal da aplicação CGRN.
 *
 */

import { CONFIG } from './utils/config.js';
import { state } from './utils/state.js';
import {
  initMap, renderPolygons, renderMarkers, renderCentroids,
  clearMapLayers, zoomToGleba,
  setGlebasVisible, setMarkersVisible, setCentroidsVisible,
  renderValidationMarkers, renderCARLayer
} from './components/map.js';

import { validateCoordinates } from './services/validation.js';
import {
  showMessage, showToast, clearMessage,
  setButtonLoading, setButtonNormal,
  renderResultsTable, applyDarkMode, setSudeneStatus,
  getCoordText, setCoordText,
  updateStatusBar, el, log
} from './components/ui.js';
import {
  exportToCSV, exportToGeoJSON,
  exportToKML, exportMapImage, exportProject
} from './utils/export.js';
import { loadSudeneLayer } from './services/sudene.js';
import { initFileUpload } from './services/upload.js';
import {
  saveProject, loadProject,
  clearSavedProject, checkSavedProject
} from './services/persistence.js';
import {
  loadTerrasIndigenas, setTerrasIndigenasVisible,
  checkGlebaTI, buildTILegend
} from './services/terras_indigenas.js';
import { loadBioma, setBiomaVisible } from './services/bioma.js';
import {
  invalidarCacheCAR, findCARByCode
} from './services/camadas_externas.js';
import { loadICMBIO, setICMBioVisible } from './services/icmbio.js';
import { loadIBAMA, setIbamaVisible } from './services/ibama.js';
import { verificarConformidade, CHECKS } from './services/conformidade.js';
import { modals } from './components/modal.js';
const { COORD_PRECISION } = CONFIG.VALIDATION;
//let searchTimeout; - variável já declarada dentro de bindEvents()

// ─── Boot ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('CGRN v3.6.3 inicializando...');
  modals.init();
  initMap();
  bindEvents();
  initFileUpload(el.fileUpload);
  checkSavedProject();
  initLegend();

  setSudeneStatus('loading');
  await Promise.allSettled([
    loadSudeneLayer(),
    loadTerrasIndigenas(),
    loadICMBIO(),
    loadIBAMA(),
    loadBioma(),   // ← novo
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

  // Busca por código CAR com Debounce + Máscara
  let searchTimeout;

  el.carSearchCode?.addEventListener('input', (e) => {
    // Máscara simples: permite apenas letras, números e hífen
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    e.target.value = val;

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchCARByCode, 650);
  });

  el.btnSearchCAR?.addEventListener('click', searchCARByCode);

  // Navbar
  el.btnCalcular?.addEventListener('click', e => { e.preventDefault(); processAndRender({ abrirResultados: true }); });
  el.btnValidarNav?.addEventListener('click', e => { e.preventDefault(); modals.open('adicionarGleba'); setTimeout(validarInline, 350); });
  el.btnDesenhar?.addEventListener('click', e => {
    e.preventDefault();
    modals.close('adicionarGleba');
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
  // Toggle do painel flutuante de camadas
  document.getElementById('btnToggleLayerPanel')?.addEventListener('click', () => {
    const body = document.getElementById('layerPanelBody');
    const icon = document.getElementById('layerPanelIcon');
    const panel = document.getElementById('layerControlPanel');
    const collapsed = body.classList.toggle('collapsed');
    panel.classList.toggle('expanded', !collapsed);
    if (icon) icon.className = collapsed ? 'bi bi-chevron-down ms-auto' : 'bi bi-chevron-up ms-auto';
    localStorage.setItem('cgrn_layer_panel_collapsed', collapsed ? '1' : '0');
  });
  const panelWasCollapsed = localStorage.getItem('cgrn_layer_panel_collapsed') === '1';
  if (panelWasCollapsed) {
    document.getElementById('layerPanelBody')?.classList.add('collapsed');
    document.getElementById('layerControlPanel')?.classList.remove('expanded');
    const icon = document.getElementById('layerPanelIcon');
    if (icon) icon.className = 'bi bi-chevron-down ms-auto';
  }
  // Sincroniza o painel flutuante com o mostrarTI (que também controla a legenda)
  document.getElementById('mostrarTI')?.addEventListener('change', e => {
    setTerrasIndigenasVisible(e.target.checked);
    document.getElementById('tiLegendPanel')?.classList.toggle('d-none', !e.target.checked);
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
  el.mostrarUC?.addEventListener('change', e => setICMBioVisible(e.target.checked));
  el.mostrarIbama?.addEventListener('change', e => setIbamaVisible(e.target.checked));
  el.mostrarBioma?.addEventListener('change', e => setBiomaVisible(e.target.checked));
  el.validarRegras?.addEventListener('change', e => {
    state.validatePoints = e.target.checked;
    state.cache.clear();     // Cache limpo ao trocar validarRegras
    processAndRender();
    invalidarCacheCAR(); // Também invalida o cache CAR se as regras mudarem
  });

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
    const current = getCoordText();
    const pts = e.layer.getLatLngs()[0];
    if (!pts || !pts.length) return;

    const nextGid = state.glebas.reduce((max, g) => g.glebaId > max ? g.glebaId : max, 0) + 1;
    const lines = pts.map((ll, i) => `${nextGid} ${i + 1} ${ll.lat.toFixed(COORD_PRECISION)} ${ll.lng.toFixed(COORD_PRECISION)}`);
    // Fecha o polígono
    lines.push(`${nextGid} ${lines.length + 1} ${pts[0].lat.toFixed(COORD_PRECISION)} ${pts[0].lng.toFixed(COORD_PRECISION)}`);

    setCoordText(current ? current.trim() + '\n' + lines.join('\n') : lines.join('\n'));
    clearMessage();
    modals.open('adicionarGleba');
  });
  state.map.on('draw:edited', e => {
    const lines = [];
    state.drawnItems.eachLayer(l => {
      const gid = l._glebaId ?? null;
      if (gid === null) return;
      const pts = l.getLatLngs()[0];
      if (!pts || !pts.length) return;

      // Leaflet.Draw às vezes retorna array aninhado dependendo do tipo de edição
      const latlngs = Array.isArray(pts[0]) ? pts[0] : pts;

      latlngs.forEach((ll, i) => lines.push(
        `${gid} ${i + 1} ${ll.lat.toFixed(COORD_PRECISION)} ${ll.lng.toFixed(COORD_PRECISION)}`
      ));
      // Garante fechamento do polígono
      lines.push(`${gid} ${latlngs.length + 1} ${latlngs[0].lat.toFixed(COORD_PRECISION)} ${latlngs[0].lng.toFixed(COORD_PRECISION)}`);
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
    if (zm) { modals.close('resultadosModal'); zoomToGleba(+zm.dataset.glebaId); }
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
      modals.close('conformidadeModal');
      modals.close('resultadosModal');
      renderCARLayer(carItem.dados);
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
    modals.close('editarGlebaModal');
    processAndRender({ abrirResultados: true });
  });

  // Projeto
  el.btnSalvarProjeto?.addEventListener('click', () => saveProject(el.projectName?.value?.trim() || 'Projeto CGRN', state.glebas.length));
  el.btnCarregarProjeto?.addEventListener('click', () => { const p = loadProject(); if (p && el.projectName) el.projectName.value = p.name; });
  document.getElementById('btnLimparProjeto')?.addEventListener('click', () => { if (confirm('Apagar projeto salvo?')) clearSavedProject(); });

  // Limpar Cache CAR
  document.getElementById('btnLimparCacheCAR')?.addEventListener('click', () => {
    invalidarCacheCAR();
    showToast('Cache do SICAR limpo.', 'success');
  });

  // Delegação de eventos para botões dinâmicos do CAR Search
  document.getElementById('carSearchResult')?.addEventListener('click', e => {
    const btnImport = e.target.closest('#btnImportarCAR');
    const btnVer = e.target.closest('#btnVerNoMapaCAR');

    if (btnImport) {
      const carData = state.lastCarSearch; // Precisamos guardar o resultado no state
      if (!carData?.geometry) { showToast('Geometria indisponível para este imóvel.', 'warning'); return; }

      const feat = carData.geometry.type === 'MultiPolygon' ? carData.geometry.coordinates[0][0] : carData.geometry.coordinates[0];
      const nextGid = state.glebas.reduce((max, g) => g.glebaId > max ? g.glebaId : max, 0) + 1;
      const lines = feat.map((ll, i) => `${nextGid} ${i + 1} ${ll[1].toFixed(COORD_PRECISION)} ${ll[0].toFixed(COORD_PRECISION)}`);

      const f = feat[0], l = feat[feat.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) {
        lines.push(`${nextGid} ${lines.length + 1} ${f[1].toFixed(COORD_PRECISION)} ${f[0].toFixed(COORD_PRECISION)}`);
      }
      const current = getCoordText();
      setCoordText(current ? current + '\n' + lines.join('\n') : lines.join('\n'));

      const manualTab = document.getElementById('tab-manual-btn');
      if (manualTab) bootstrap.Tab.getOrCreateInstance(manualTab).show();
      showToast(`Imóvel ${carData.codigo} importado com sucesso.`, 'success');
    }

    if (btnVer) {
      const carData = state.lastCarSearch;
      if (!carData?.geometry) { showToast('Geometria indisponível.', 'warning'); return; }
      renderCARLayer([carData]);
      modals.close('adicionarGleba');
      showToast(`Visualizando CAR ${carData.codigo} no mapa.`, 'info');
    }
  });

  log('Eventos vinculados ✅');
}

// ─── Camadas externas on/off ───────────────────────────────────────────────


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
      const errList = result.errors.length > 8
        ? [...result.errors.slice(0, 7), `... e mais ${result.errors.length - 7} erros.`]
        : result.errors;

      if (modalAberto?.id === 'adicionarGleba') showMessage(errList, 'danger');
      else showToast(['Verifique os dados:', ...errList], 'danger', 8000);
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

    if (state.validatePoints) {
      renderValidationMarkers(state.glebas, result.overlapFeatures);
    }

    // Feedback e Avisos (TI, Sobreposições, etc)
    const tiConflitos = glebas.flatMap(g => g.tiIntersecoes);
    const warnings = result.warnings || [];
    const hasIssues = tiConflitos.length > 0 || warnings.length > 0;

    if (hasIssues) {
      let msgLista = [];
      if (tiConflitos.length) {
        const nomes = [...new Set(tiConflitos.map(t => t.nome))].join(', ');
        msgLista.push(`<i class="bi bi-exclamation-triangle-fill"></i> <strong>Atenção BACEN/SICOR:</strong> ${tiConflitos.length} sobreposição(ões) com Terra(s) Indígenas: ${nomes}.`);
      }
      if (warnings.length > 0) msgLista.push(...warnings);

      // Se vai fechar o modal, mostra no Toast para não perder o aviso
      if (opts.fecharModal) {
        showToast(['Atenção nas glebas:', ...msgLista], 'warning', 10000);
      } else {
        showMessage([`<i class="bi bi-patch-check-fill me-1 text-success"></i> ${glebas.length} gleba(s) processada(s).`, ...msgLista], 'warning', 10000);
      }
    } else {
      const note = result.fromCache ? ' <em>(cache)</em>' : '';
      const msgSucesso = `<i class="bi bi-patch-check-fill me-1"></i> ${glebas.length} gleba(s) processada(s).${note}`;

      if (opts.fecharModal) showToast(msgSucesso, 'success', 3500);
      else showMessage(msgSucesso, 'success', 3500);
    }

    if (opts.fecharModal) modals.close(opts.fecharModal);
    if (opts.abrirResultados) {
      modals.open('resultadosModal');
      // Automatização: Verificar conformidade ao abrir resultados
      setTimeout(() => runConformidade(state.glebas), 500);
    }

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
    const result = validateCoordinates(getCoordText(), {
      validarPontos: state.validatePoints ?? true
    });

    if (!result.valid) {
      showMessage(result.errors, 'danger');
      return;
    }

    // Atualiza marcadores de erro no mapa mesmo no modo apenas validação
    if (state.validatePoints) {
      renderValidationMarkers(result.data, result.overlapFeatures);
    }

    // Feedback de sucesso + todos os warnings
    const totalArea = result.data.reduce((s, g) => s + g.area, 0);
    let mensagens = [
      `<i class="bi bi-patch-check-fill me-1 text-success"></i> ${result.data.length} gleba(s) processada(s) — ${totalArea.toFixed(2)} ha.`
    ];

    // Avisos de TI
    const tiTotal = result.data.reduce((s, g) => s + (g.tiIntersecoes?.length || 0), 0);
    if (tiTotal > 0) {
      mensagens.push(`<i class="bi bi-exclamation-triangle-fill text-warning"></i> ${tiTotal} sobreposição(ões) com Terra Indígena detectada(s).`);
    }

    // Avisos gerais (duplicatas, autointerseções, etc.)
    if (result.warnings && result.warnings.length > 0) {
      mensagens = [...mensagens, ...result.warnings];
    }

    const tipo = (tiTotal > 0 || result.warnings?.length > 0) ? 'warning' : 'success';
    showMessage(mensagens, tipo, 8000);

  } catch (e) {
    warn(e);  // era: console.error(e)
    showMessage('Erro inesperado durante a validação.', 'danger');
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

  const loadingToast = showToast('Verificando conformidade BACEN/SICOR. Isso consulta bases nacionais (ICMBio, IBAMA, SICAR) e pode levar alguns segundos...', 'info', 0);

  try {
    const resultados = await Promise.allSettled(
      glebas.map(g => verificarConformidade(g, { skipApi: false }))
    );

    const aprovadas = resultados.filter(r => r.status === 'fulfilled' && !r.value.reprovada).length;
    const reprovadas = resultados.filter(r => r.status === 'fulfilled' && r.value.reprovada).length;
    const pendentes = resultados.filter(r => r.status === 'rejected').length;

    renderResultsTable(state.glebas);
    modals.open('resultadosModal');

    const msg = reprovadas > 0
      ? `<i class="bi bi-x-octagon-fill"></i> ${reprovadas} gleba(s) REPROVADA(s). ${aprovadas} aprovada(s). Veja detalhes na tabela.`
      : `<i class="bi bi-patch-check-fill"></i> ${aprovadas} gleba(s) sem bloqueios BACEN/SICOR.${pendentes ? ` <i class="bi bi-hourglass-split"></i> ${pendentes} verificação(ões) pendente(s) (API timeout).` : ''}`;

    showToast(msg, reprovadas > 0 ? 'danger' : 'success', 8000);

  } finally {
    if (loadingToast?.hide) loadingToast.hide(); // Fecha o toast de loading
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
    modals.open('conformidadeModal');
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

  modals.open('conformidadeModal');
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
      ? `<a href="https://car.gov.br/#/consultar/${encodeURIComponent(d.codigo)}"
            target="_blank" rel="noopener noreferrer"
            class="btn btn-outline-primary btn-sm py-0 px-1 ms-1"
            title="Consultar demonstrativo do CAR (site oficial)">
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
          ${d.municipio} · <span class="badge bg-light text-dark border-0 p-0 fw-normal">${d.tipoImovel}</span>
          ${d.areaHa ? ` · ${Number(d.areaHa).toFixed(2)} ha` : ''}
          ${d.areaModulos ? ` · <strong>${Number(d.areaModulos).toFixed(2)} MF</strong>` : ''}
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

// ─── Busca por Código CAR ──────────────────────────────────────────────────

async function searchCARByCode() {
  const input = document.getElementById('carSearchCode');
  const code = input?.value?.trim();
  const btn = document.getElementById('btnSearchCAR');
  const resultDiv = document.getElementById('carSearchResult');

  if (!code) { showToast('Informe o código do CAR.', 'warning'); return; }
  if (state.isProcessing) return;

  state.isProcessing = true;
  setButtonLoading(btn, 'Buscando...');
  resultDiv.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

  try {
    const car = await findCARByCode(code);
    if (!car) {
      resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">Imóvel ${code} não encontrado na base do SICAR.</div>`;
      return;
    }

    state.lastCarSearch = car; // Armazena no state para a delegação de eventos

    resultDiv.innerHTML = `
      <div class="card card-body border-primary bg-primary bg-opacity-10 p-2 small">
        <div class="fw-bold text-primary mb-1">${car.codigo}</div>
        <div>${car.municipio} · ${car.areaHa.toFixed(2)} ha</div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-sm btn-primary flex-grow-1" id="btnImportarCAR">
            <i class="bi bi-download me-1"></i>Importar para Glebas
          </button>
          <button class="btn btn-sm btn-outline-primary" id="btnVerNoMapaCAR">
            <i class="bi bi-map me-1"></i>Ver
          </button>
        </div>
      </div>`;

  } catch (e) {
    resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">Erro na consulta: ${e.message}</div>`;
  } finally {
    setButtonNormal(btn);
    state.isProcessing = false;
  }
}

// ─── Editar gleba ─────────────────────────────────────────────────────────

function editarGleba(glebaId) {
  const g = state.glebas.find(g => g.glebaId === glebaId);
  if (!g) return;
  const lines = g.coords.map(([lat, lon], i) => `${glebaId} ${i + 1} ${lat.toFixed(COORD_PRECISION)} ${lon.toFixed(COORD_PRECISION)}`);
  if (el.glebaEditArea) el.glebaEditArea.value = lines.join('\n');
  if (el.editGlebaId) el.editGlebaId.value = String(glebaId);
  const lbl = document.getElementById('editarGlebaModalLabel');
  if (lbl) lbl.textContent = `Editar Gleba ${glebaId}`;
  modals.close('resultadosModal');
  modals.open('editarGlebaModal');
}