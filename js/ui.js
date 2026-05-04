/**
 * ui.js — Manipulação de DOM, modais, feedback visual,
 *         tabela editável, dark mode e persistência via localStorage.
 *
 * v2 — Melhorias:
 *  - Sincronização bidirecional state ↔ textarea ↔ tabela
 *  - Painel lateral de glebas com edição individual
 *  - Tabela editável com add/remove de linhas
 *  - Upload melhorado (CSV, TXT, GeoJSON)
 *  - Gleba panel flutuante no mapa
 */

import {
  getGlebas, setGlebas, isDarkMode, setDarkMode,
  isProcessing, setProcessing, clearAll, glebasToText,
  subscribe, removeGleba, getGlebaById,
} from './state.js';

import { $, log, STORAGE_KEY, formatArea, formatPerimeter, glebaColor } from './utils.js';
import { parseFileContent, parseGeoJSONContent, getMunicipioNames } from './validation.js';

/* global bootstrap */

// ── Referências de DOM (cacheadas na inicialização) ─────────────────────────
let elMap, elCoordenadas, elMessageArea, elMostrarMarcadores;
let elResultadosTableBody, elCoordTableBody;
let modalAdicionar, modalResultados, modalCoordenadas;

/**
 * Inicializa referências de DOM e configura event listeners de UI.
 */
export function initUI() {
  elMap = $('map');
  elCoordenadas = $('coordenadas');
  elMessageArea = $('messageArea');
  elMostrarMarcadores = $('mostrarMarcadores');
  elResultadosTableBody = $('resultadosTableBody');
  elCoordTableBody = $('coordTableBody');

  // Bootstrap modais
  const modalAdicionarEl = $('adicionarGleba');
  const modalResultadosEl = $('resultadosModal');
  const modalCoordenadasEl = $('coordEditModal');

  if (modalAdicionarEl) modalAdicionar = new bootstrap.Modal(modalAdicionarEl);
  if (modalResultadosEl) modalResultados = new bootstrap.Modal(modalResultadosEl);
  if (modalCoordenadasEl) modalCoordenadas = new bootstrap.Modal(modalCoordenadasEl);

  // Dark mode: recuperar preferência salva
  const savedDark = localStorage.getItem('cgrn_darkmode');
  if (savedDark === 'true') {
    toggleDarkMode(true);
  }

  // Inscrever para mudanças no state de glebas → atualizar textarea e painel
  subscribe('glebas', (glebas) => {
    syncStateToTextarea();
    updateGlebaPanel(glebas);
  });

  log('ui: inicializado');
}

// ── Mensagens e Feedback ────────────────────────────────────────────────────

/**
 * Exibe uma mensagem alert na área de mensagens do modal.
 * @param {string} mensagem — Texto ou HTML
 * @param {'success'|'danger'|'warning'|'info'} tipo
 * @param {number} [autoHideMs=0] — Se > 0, esconde após N ms
 */
export function showMessage(mensagem, tipo, autoHideMs = 0) {
  if (!elMessageArea) return;
  elMessageArea.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show py-2 mb-2" role="alert">
      ${mensagem}
      <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert"></button>
    </div>`;
  if (autoHideMs > 0) {
    setTimeout(() => { if (elMessageArea) elMessageArea.innerHTML = ''; }, autoHideMs);
  }
}

/**
 * Exibe múltiplos erros de validação.
 * @param {string[]} errors
 */
export function showErrors(errors) {
  const html = errors.map(e => `<div class="mb-1"><i class="bi bi-x-circle-fill text-danger"></i> ${e}</div>`).join('');
  showMessage(html, 'danger');
}

/**
 * Exibe avisos de validação.
 * @param {string[]} warnings
 */
export function showWarnings(warnings) {
  const html = warnings.map(w => `<div class="mb-1"><i class="bi bi-exclamation-triangle-fill text-warning"></i> ${w}</div>`).join('');
  showMessage(html, 'warning', 8000);
}

/**
 * Limpa a área de mensagens.
 */
export function clearMessages() {
  if (elMessageArea) elMessageArea.innerHTML = '';
}

// ── Loader por ação ─────────────────────────────────────────────────────────

/**
 * Mostra loader inline em um botão e desabilita-o.
 * @param {HTMLButtonElement} btn
 * @param {string} [text='Processando...']
 * @returns {function} — Função para restaurar o botão
 */
export function startButtonLoader(btn, text = 'Processando...') {
  if (!btn) return () => { };
  const original = btn.innerHTML;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${text}`;
  setProcessing(true);

  return () => {
    btn.innerHTML = original;
    btn.disabled = wasDisabled;
    setProcessing(false);
  };
}

/**
 * Mostra/esconde o loader global.
 * @param {boolean} show
 */
export function toggleGlobalLoader(show) {
  const el = $('loading');
  if (el) el.classList.toggle('d-none', !show);
}

// ── Tabela de Resultados ────────────────────────────────────────────────────

/**
 * Atualiza a tabela de resultados com os dados das glebas.
 * @param {Array} glebas
 */
export function updateResultsTable(glebas) {
  if (!elResultadosTableBody) return;

  elResultadosTableBody.innerHTML = glebas.map((g, idx) => {
    const color = glebaColor(idx);
    const munNames = getMunicipioNames(g.municipios);
    const munText = munNames.length > 0 ? munNames.join(', ') : 'N/D';
    return `
    <tr>
      <td>
        <span class="badge" style="background:${color}">G${g.gleba}</span>
      </td>
      <td>${formatArea(g.area)}</td>
      <td>${formatPerimeter(g.perimeter)}</td>
      <td>
        <span title="${munText}">${g.municipios.length} ${g.municipios.length === 1 ? 'município' : 'municípios'}</span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary result-edit-btn" data-gleba-id="${g.id}" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger result-remove-btn ms-1" data-gleba-id="${g.id}" title="Remover">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');

  // Totais
  const totalArea = glebas.reduce((s, g) => s + g.area, 0);
  elResultadosTableBody.innerHTML += `
    <tr class="table-active fw-bold">
      <td>TOTAL</td>
      <td>${formatArea(totalArea)}</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
    </tr>
  `;

  log('ui: tabela de resultados atualizada');
}

// ── Tabela Editável de Coordenadas ──────────────────────────────────────────

/**
 * Preenche a tabela editável de coordenadas a partir do state (glebas).
 * @param {number} [filterGleba] — Se informado, filtra por número da gleba
 */
export function populateCoordTable(filterGleba) {
  if (!elCoordTableBody) return;

  const glebas = getGlebas();
  if (glebas.length === 0) {
    // Fallback: ler do textarea
    const text = elCoordenadas?.value?.trim();
    if (!text) {
      elCoordTableBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">Nenhuma coordenada inserida</td></tr>';
      return;
    }
    populateCoordTableFromText(text, filterGleba);
    return;
  }

  // Populate do state
  const rows = [];
  glebas.forEach(g => {
    if (filterGleba && filterGleba !== 'all' && g.gleba !== Number(filterGleba)) return;
    const color = glebaColor(g.gleba - 1);
    g.rawCoords.forEach((coord, idx) => {
      const [lon, lat] = coord;
      rows.push(`
        <tr data-gleba="${g.gleba}" data-point="${idx}">
          <td>
            <div class="d-flex align-items-center gap-1">
              <span class="diag-gleba-color" style="background:${color};width:8px;height:8px"></span>
              <input type="number" class="form-control form-control-sm coord-input" data-col="0" value="${g.gleba}" step="1" min="1" readonly>
            </div>
          </td>
          <td><input type="number" class="form-control form-control-sm coord-input" data-col="1" value="${idx + 1}" step="1" min="1" readonly></td>
          <td><input type="number" class="form-control form-control-sm coord-input" data-col="2" value="${lat}" step="any"></td>
          <td><input type="number" class="form-control form-control-sm coord-input" data-col="3" value="${lon}" step="any"></td>
          <td>
            <button class="btn btn-sm btn-outline-danger coord-remove-row" title="Remover ponto">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `);
    });
  });

  elCoordTableBody.innerHTML = rows.join('');

  // Atualizar seletor de glebas
  updateCoordEditGlebaSelect();

  log('ui: tabela de coordenadas populada do state');
}

/**
 * Popula a tabela de coordenadas a partir de texto (fallback).
 */
function populateCoordTableFromText(text, filterGleba) {
  const lines = text.split('\n');
  const rows = [];

  lines.forEach((line, idx) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) return;
    if (filterGleba && filterGleba !== 'all' && Number(parts[0]) !== Number(filterGleba)) return;

    rows.push(`
      <tr data-row="${idx}">
        <td><input type="number" class="form-control form-control-sm coord-input" data-col="0" value="${parts[0]}" step="1" min="1"></td>
        <td><input type="number" class="form-control form-control-sm coord-input" data-col="1" value="${parts[1]}" step="1" min="1"></td>
        <td><input type="number" class="form-control form-control-sm coord-input" data-col="2" value="${parts[2]}" step="any"></td>
        <td><input type="number" class="form-control form-control-sm coord-input" data-col="3" value="${parts[3]}" step="any"></td>
        <td>
          <button class="btn btn-sm btn-outline-danger coord-remove-row" title="Remover ponto">
            <i class="bi bi-x"></i>
          </button>
        </td>
      </tr>
    `);
  });

  if (elCoordTableBody) {
    elCoordTableBody.innerHTML = rows.join('') || '<tr><td colspan="5" class="text-muted text-center">Nenhuma coordenada</td></tr>';
  }
}

/**
 * Atualiza o seletor de glebas no modal de edição de coordenadas.
 */
function updateCoordEditGlebaSelect() {
  const select = $('coordEditGlebaSelect');
  if (!select) return;

  const glebas = getGlebas();
  const currentVal = select.value;

  select.innerHTML = '<option value="all">Todas</option>';
  glebas.forEach((g, idx) => {
    const opt = document.createElement('option');
    opt.value = g.gleba;
    opt.textContent = `Gleba ${g.gleba}`;
    select.appendChild(opt);
  });

  // Restaurar seleção
  if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
    select.value = currentVal;
  }
}

/**
 * Sincroniza a tabela editável de volta para o textarea.
 * @returns {string} — Texto resultante
 */
export function syncTableToTextarea() {
  if (!elCoordTableBody || !elCoordenadas) return '';

  const rows = elCoordTableBody.querySelectorAll('tr[data-gleba], tr[data-row]');
  const lines = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll('.coord-input');
    if (inputs.length >= 4) {
      lines.push(Array.from(inputs).slice(0, 4).map(i => i.value).join(' '));
    }
  });

  const text = lines.join('\n');
  elCoordenadas.value = text;
  log('ui: textarea sincronizado da tabela');
  return text;
}

/**
 * Adiciona uma nova linha na tabela de coordenadas.
 */
export function addCoordRow() {
  if (!elCoordTableBody) return;

  const glebas = getGlebas();
  const lastGleba = glebas.length > 0 ? glebas[glebas.length - 1].gleba : 1;

  // Encontrar último ponto da última gleba na tabela
  const rows = elCoordTableBody.querySelectorAll('tr');
  let lastPoint = 0;
  rows.forEach(row => {
    const inputs = row.querySelectorAll('.coord-input');
    if (inputs.length >= 2) {
      const g = Number(inputs[0].value);
      const p = Number(inputs[1].value);
      if (g === lastGleba && p > lastPoint) lastPoint = p;
    }
  });

  const newRow = document.createElement('tr');
  newRow.setAttribute('data-row', 'new');
  newRow.innerHTML = `
    <td><input type="number" class="form-control form-control-sm coord-input" data-col="0" value="${lastGleba}" step="1" min="1"></td>
    <td><input type="number" class="form-control form-control-sm coord-input" data-col="1" value="${lastPoint + 1}" step="1" min="1"></td>
    <td><input type="number" class="form-control form-control-sm coord-input" data-col="2" value="" step="any" placeholder="-8.0"></td>
    <td><input type="number" class="form-control form-control-sm coord-input" data-col="3" value="" step="any" placeholder="-34.9"></td>
    <td>
      <button class="btn btn-sm btn-outline-danger coord-remove-row" title="Remover ponto">
        <i class="bi bi-x"></i>
      </button>
    </td>
  `;

  elCoordTableBody.appendChild(newRow);

  // Scroll ao novo row
  newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Focar no campo latitude
  const latInput = newRow.querySelector('[data-col="2"]');
  if (latInput) latInput.focus();
}

/**
 * Sincroniza state para textarea (state → textarea).
 */
export function syncStateToTextarea() {
  if (!elCoordenadas) return;
  const glebas = getGlebas();
  if (glebas.length === 0) return;
  elCoordenadas.value = glebasToText();
}

// ── Painel lateral de glebas ────────────────────────────────────────────────

/**
 * Atualiza o painel lateral de glebas.
 * @param {Array} glebas
 */
export function updateGlebaPanel(glebas) {
  const panel = $('glebaPanel');
  const body = $('glebaPanelBody');
  if (!panel || !body) return;

  if (glebas.length === 0) {
    panel.classList.add('d-none');
    return;
  }

  panel.classList.remove('d-none');

  body.innerHTML = glebas.map((g, idx) => {
    const color = glebaColor(idx);
    return `
      <div class="gleba-card" data-gleba-id="${g.id}">
        <div class="gleba-card-header">
          <span class="gleba-card-color" style="background:${color}"></span>
          <span class="fw-bold">G${g.gleba}</span>
          <span class="text-muted ms-auto" style="font-size:0.75rem">${formatArea(g.area)}</span>
        </div>
        <div class="gleba-card-details">
          <div><i class="bi bi-rulers"></i> ${formatPerimeter(g.perimeter)}</div>
          <div><i class="bi bi-geo-alt"></i> ${g.municipios.length} mun.</div>
        </div>
        <div class="gleba-card-actions">
          <button class="btn btn-sm btn-outline-primary panel-edit-btn" data-gleba-id="${g.id}" title="Editar visualmente">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-info panel-zoom-btn" data-gleba-id="${g.id}" title="Zoom">
            <i class="bi bi-zoom-in"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger panel-remove-btn" data-gleba-id="${g.id}" title="Remover">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Modais ──────────────────────────────────────────────────────────────────

export function hideAdicionarModal() {
  modalAdicionar?.hide();
}

export function showResultadosModal() {
  modalResultados?.show();
}

export function showCoordEditModal() {
  populateCoordTable();
  modalCoordenadas?.show();
}

// ── Textarea e Upload ───────────────────────────────────────────────────────

/**
 * Obtém o texto de coordenadas do textarea.
 * @returns {string}
 */
export function getCoordenadasText() {
  return elCoordenadas?.value?.trim() || '';
}

/**
 * Define o texto do textarea de coordenadas.
 * @param {string} text
 */
export function setCoordenadasText(text) {
  if (elCoordenadas) elCoordenadas.value = text;
}

/**
 * Verifica se "mostrar marcadores" está ativado.
 * @returns {boolean}
 */
export function isMostrarMarcadores() {
  return elMostrarMarcadores?.checked || false;
}

/**
 * Limpa o formulário (textarea + mensagens).
 */
export function clearForm() {
  if (elCoordenadas) elCoordenadas.value = '';
  clearMessages();
}

/**
 * Configura o handler de upload de arquivo.
 * Suporta CSV, TXT e GeoJSON.
 * @param {function(string): void} onFileLoaded — Callback com conteúdo parseado
 */
export function setupFileUpload(onFileLoaded) {
  const fileInput = $('fileUpload');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target.result;
      let normalized = null;

      // Tentar GeoJSON primeiro se extensão compatível
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'geojson' || ext === 'json') {
        normalized = parseGeoJSONContent(raw);
        if (!normalized) {
          showMessage('Formato GeoJSON inválido. Verifique o arquivo.', 'danger');
          return;
        }
      }

      // Fallback para CSV/TXT
      if (!normalized) {
        normalized = parseFileContent(raw);
      }

      if (normalized) {
        setCoordenadasText(normalized);
        const lineCount = normalized.split('\n').length;
        showMessage(`
          <i class="bi bi-check-circle-fill"></i> Arquivo "<b>${file.name}</b>" importado com sucesso!
          <span class="text-muted">(${lineCount} coordenadas)</span>
        `, 'success', 4000);
        onFileLoaded(normalized);
      } else {
        showMessage('Não foi possível ler coordenadas do arquivo. Formatos suportados: CSV, TXT, GeoJSON.', 'warning');
      }
    };
    reader.onerror = () => {
      showMessage('Erro ao ler o arquivo. Tente novamente.', 'danger');
    };
    reader.readAsText(file);

    // Reset para permitir re-upload do mesmo arquivo
    fileInput.value = '';
  });
}

// ── Dark Mode ───────────────────────────────────────────────────────────────

/**
 * Alterna ou define o dark mode.
 * @param {boolean} [force] — Se informado, define o valor em vez de alternar
 */
export function toggleDarkMode(force) {
  const newValue = force !== undefined ? force : !isDarkMode();
  setDarkMode(newValue);

  document.documentElement.setAttribute('data-bs-theme', newValue ? 'dark' : 'light');
  document.body.classList.toggle('dark-mode', newValue);

  // Atualizar ícone do botão
  const btn = $('darkModeToggle');
  if (btn) {
    btn.innerHTML = newValue ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
    btn.title = newValue ? 'Modo Claro' : 'Modo Escuro';
  }

  localStorage.setItem('cgrn_darkmode', String(newValue));
  log('ui: dark mode =', newValue);
}

// ── Persistência (localStorage) ─────────────────────────────────────────────

/**
 * Salva o projeto atual no localStorage.
 * @param {string} [name] — Nome do projeto
 */
export function saveProject(name) {
  const projectName = name || prompt('Nome do projeto:', `Projeto_${Date.now()}`);
  if (!projectName) return;

  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  projects[projectName] = {
    coordenadas: getCoordenadasText(),
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  showMessage(`<i class="bi bi-check-circle-fill"></i> Projeto "<b>${projectName}</b>" salvo com sucesso!`, 'success', 3000);
  log('ui: projeto salvo:', projectName);
  updateProjectList();
}

/**
 * Carrega um projeto do localStorage.
 * @param {string} name
 * @param {function} onLoad — Callback após carregar
 */
export function loadProject(name, onLoad) {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const project = projects[name];
  if (!project) {
    showMessage(`Projeto "${name}" não encontrado.`, 'warning');
    return;
  }
  setCoordenadasText(project.coordenadas);
  showMessage(`<i class="bi bi-check-circle-fill"></i> Projeto "<b>${name}</b>" carregado.`, 'success', 3000);
  log('ui: projeto carregado:', name);
  onLoad?.(project.coordenadas);
}

/**
 * Exclui um projeto do localStorage.
 * @param {string} name
 */
export function deleteProject(name) {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  delete projects[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  showMessage(`Projeto "${name}" excluído.`, 'info', 3000);
  updateProjectList();
}

/**
 * Atualiza a lista de projetos salvos no dropdown.
 */
export function updateProjectList() {
  const list = $('projectList');
  if (!list) return;

  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const names = Object.keys(projects);

  if (names.length === 0) {
    list.innerHTML = '<li><span class="dropdown-item text-muted">Nenhum projeto salvo</span></li>';
    return;
  }

  list.innerHTML = names.map(name => {
    const date = new Date(projects[name].timestamp).toLocaleDateString('pt-BR');
    return `
      <li class="d-flex align-items-center px-2">
        <a class="dropdown-item flex-grow-1 project-load" href="#" data-name="${name}">
          ${name} <small class="text-muted">(${date})</small>
        </a>
        <button class="btn btn-sm btn-outline-danger ms-1 project-delete" data-name="${name}" title="Excluir">✕</button>
      </li>
    `;
  }).join('');
}

/**
 * Insere o exemplo de coordenadas no textarea.
 */
export function insertExample() {
  setCoordenadasText('1 1 -8.05428 -34.95132\n1 2 -8.10215 -34.95132\n1 3 -8.10215 -34.90217\n1 4 -8.05428 -34.90217\n1 5 -8.05428 -34.95132');
}
