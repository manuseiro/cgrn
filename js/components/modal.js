/**
 * @file modal.js
 * @description Gerenciador centralizado de modais para o CGRN v3.5.
 */

export class ModalManager {
  constructor() {
    this.modals = new Map();
  }

  /**
   * Inicializa o gerenciador e pré-registra modais do DOM.
   */
  init() {
    this._initListeners();
    document.querySelectorAll('.modal').forEach(el => {
      this.getOrCreate(el.id);
    });
    console.log('[ModalManager] Inicializado');
  }

  /**
   * Inicializa um modal do Bootstrap e o registra.
   * @param {string} id - ID do elemento HTML do modal.
   * @returns {bootstrap.Modal}
   */
  getOrCreate(id) {
    if (this.modals.has(id)) return this.modals.get(id);
    const el = document.getElementById(id);
    if (!el) return null;
    
    const instance = bootstrap.Modal.getOrCreateInstance(el);
    this.modals.set(id, instance);
    return instance;
  }

  /**
   * Abre um modal com dados opcionais.
   * @param {string} id - ID do modal.
   * @param {Object} data - Dados a serem passados para o modal.
   */
  open(id, data = null) {
    const modal = this.getOrCreate(id);
    if (!modal) return;

    const el = document.getElementById(id);
    if (data) {
      el.dataset.modalData = JSON.stringify(data);
      // Dispara evento customizado para preenchimento de dados
      el.dispatchEvent(new CustomEvent('modal:open', { 
        detail: data,
        bubbles: true 
      }));
    }

    modal.show();
  }

  /**
   * Fecha um modal.
   * @param {string} id 
   */
  close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
  }

  /**
   * Escuta cliques globais para abrir modais via data-attributes.
   */
  _initListeners() {
    document.addEventListener('click', (e) => {
      // Delegar abertura via data-modal-open
      const trigger = e.target.closest('[data-modal-open]');
      if (trigger) {
        e.preventDefault();
        const targetId = trigger.dataset.modalOpen;
        let data = null;
        try {
          data = trigger.dataset.modalData ? JSON.parse(trigger.dataset.modalData) : null;
        } catch (err) {
          console.error('[ModalManager] Erro ao parsear data-modal-data', err);
        }
        this.open(targetId, data);
      }
    });

    // Limpeza de dados ao fechar
    document.addEventListener('hidden.bs.modal', (e) => {
      delete e.target.dataset.modalData;
    });
  }

  /**
   * Atualiza o título de um modal.
   */
  setTitle(id, html) {
    const el = document.getElementById(id);
    const title = el?.querySelector('.modal-title');
    if (title) title.innerHTML = html;
  }

  /**
   * Atualiza o corpo de um modal.
   */
  setBody(id, html) {
    const el = document.getElementById(id);
    const body = el?.querySelector('.modal-body');
    if (body) body.innerHTML = html;
  }

  /**
   * Atualiza o rodapé de um modal.
   */
  setFooter(id, html) {
    const el = document.getElementById(id);
    const footer = el?.querySelector('.modal-footer');
    if (footer) footer.innerHTML = html;
  }
}

export const modals = new ModalManager();
