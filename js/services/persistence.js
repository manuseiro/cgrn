/**
 * @file persistence.js
 * @description Persistência de projetos via localStorage.
 * Usa showToast() (global) e showProjectMessage() (modal) — sem duplicar IDs.
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import {
  getCoordText, setCoordText,
  showMessage, showProjectMessage, log, warn,
  el
} from '../components/ui.js';

const STORAGE_KEY = CONFIG.STORAGE.KEY;

// ─── Salvar ───────────────────────────────────────────────────────────────

export function saveProject(projectName, glebaCount) {
  const coords = getCoordText().trim();
  if (!coords) {
    showProjectMessage('Sem coordenadas para salvar. Adicione glebas antes.', 'warning');
    return false;
  }

  const project = {
    name: projectName || 'Projeto CGRN',
    coords,
    glebaCount,
    savedAt: new Date().toISOString(),
    version: '2.0',
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    showProjectMessage(
      `Projeto "<strong>${project.name}</strong>" salvo (${glebaCount} gleba[s]).`,
      'success', 4000
    );
    showToast(`<i class="bi bi-floppy"></i> Projeto "${project.name}" salvo com sucesso.`, 'success', 3000);
    updateSavedInfo(project);
    log('Projeto salvo:', project.name);
    return true;
  } catch (e) {
    warn('Erro ao salvar:', e);
    const msg = e.name === 'QuotaExceededError'
      ? 'Armazenamento local cheio.'
      : 'Erro ao salvar: ' + e.message;
    showProjectMessage(msg, 'danger');
    return false;
  }
}

// ─── Carregar ─────────────────────────────────────────────────────────────

export function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      showProjectMessage('Nenhum projeto salvo encontrado.', 'info', 3000);
      return null;
    }

    const project = JSON.parse(raw);
    if (!project?.coords) {
      showProjectMessage('Dados do projeto corrompidos.', 'danger');
      return null;
    }

    setCoordText(project.coords);
    showProjectMessage(
      `Projeto "<strong>${project.name}</strong>" carregado.<br>` +
      `<small class="text-muted">Salvo em: ${fmtDate(project.savedAt)}</small>`,
      'info', 5000
    );
    showToast(`<i class="bi bi-folder-fill"></i> Projeto "${project.name}" carregado.`, 'info', 3000);
    log('Projeto carregado:', project.name);
    return project;
  } catch (e) {
    warn('Erro ao carregar:', e);
    showProjectMessage('Erro ao carregar: ' + e.message, 'danger');
    return null;
  }
}

// ─── Verificar ao iniciar ─────────────────────────────────────────────────

export function checkSavedProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const project = JSON.parse(raw);
    updateSavedInfo(project);
  } catch (_) { /* silencioso */ }
}

// ─── Limpar ───────────────────────────────────────────────────────────────

export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY);
  const info = el.savedProjectInfo;
  if (info) info.innerHTML = '<small class="text-muted">Nenhum projeto salvo.</small>';
  showProjectMessage('Projeto apagado.', 'info', 2000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function updateSavedInfo(project) {
  const info = el.savedProjectInfo;
  if (!info) return;
  info.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-floppy-fill text-primary"></i>
      <div>
        <div class="fw-semibold">${project.name}</div>
        <small class="text-muted">${project.glebaCount ?? '?'} gleba(s) • ${fmtDate(project.savedAt)}</small>
      </div>
    </div>`;
}

function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch (_) { return iso; }
}
