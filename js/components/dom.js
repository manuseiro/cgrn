/**
 * @file dom.js
 * @description Referências centralizadas aos elementos do DOM para a aplicação CGRN.
 */

export const el = {
  // Modais
  get modalAdicionarGleba() { return document.getElementById('adicionarGleba'); },
  get modalResultados() { return document.getElementById('resultadosModal'); },
  get modalEditar() { return document.getElementById('editarGlebaModal'); },
  get modalProjeto() { return document.getElementById('projetoModal'); },
  get modalConformidade() { return document.getElementById('conformidadeModal'); },

  // Mensagens inline (IDs únicos por modal)
  get msgGleba() { return document.getElementById('msgGleba'); },
  get msgProjeto() { return document.getElementById('msgProjeto'); },

  // Inputs
  get coordenadas() { return document.getElementById('coordenadas'); },
  get glebaEditArea() { return document.getElementById('glebaEditArea'); },
  get editGlebaId() { return document.getElementById('editGlebaId'); },
  get projectName() { return document.getElementById('projectName'); },
  get fileUpload() { return document.getElementById('fileUpload'); },

  // Checkboxes de visualização
  get mostrarGlebas() { return document.getElementById('mostrarGlebas'); },
  get mostrarMarcadores() { return document.getElementById('mostrarMarcadores'); },
  get mostrarCentroids() { return document.getElementById('mostrarCentroids'); },
  get mostrarTI() { return document.getElementById('mostrarTI'); },
  get mostrarUC() { return document.getElementById('mostrarUC'); },
  get mostrarIbama() { return document.getElementById('mostrarIbama'); },
  get mostrarBioma() { return document.getElementById('mostrarBioma'); },
  get validarPontos() { return document.getElementById('validarPontos'); },

  // Botões — modal Adicionar Gleba
  get btnAdicionar() { return document.getElementById('adicionar-gleba-btn'); },
  get btnValidar() { return document.getElementById('validar-gleba-btn'); },
  get btnLimparMapa() { return document.getElementById('limparMapa'); },
  get btnInserirExemplo() { return document.getElementById('inserirExemplo'); },

  // Botões — navbar
  get btnCalcular() { return document.getElementById('calcularArea'); },
  get btnValidarNav() { return document.getElementById('validarGlebas'); },
  get btnDesenhar() { return document.getElementById('desenharGleba'); },
  get btnDarkMode() { return document.getElementById('toggleDarkMode'); },

  // Botões — projeto
  get btnSalvarProjeto() { return document.getElementById('salvarProjeto'); },
  get btnCarregarProjeto() { return document.getElementById('carregarProjeto'); },

  // Tabela de resultados
  get resultadosTableBody() { return document.getElementById('resultadosTableBody'); },

  // Barra de status
  get statusCoords() { return document.getElementById('statusCoords'); },
  get statusArea() { return document.getElementById('statusArea'); },
  get sudeneStatus() { return document.getElementById('sudeneStatus'); },
  get savedProjectInfo() { return document.getElementById('savedProjectInfo'); },
};

export const log = (...a) => (window.CGRN_DEBUG !== false) && console.log('[CGRN]', ...a);
export const warn = (...a) => (window.CGRN_DEBUG !== false) && console.warn('[CGRN]', ...a);
