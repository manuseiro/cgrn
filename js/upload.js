/**
 * @file upload.js
 * @description Importação de coordenadas via arquivos CSV ou TXT.
 * Suporta o mesmo formato da textarea: "glebaId pontoId lat lon" por linha.
 * Também aceita CSV com delimitador vírgula/ponto-e-vírgula.
 */

import { setCoordText, showMessage, log, warn } from './ui.js';

/**
 * Inicializa o listener no input de upload de arquivo.
 * @param {HTMLInputElement} fileInput - Elemento <input type="file">
 */
export function initFileUpload(fileInput) {
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'txt'].includes(ext)) {
      showMessage('Formato não suportado. Use arquivos .csv ou .txt', 'warning');
      fileInput.value = '';
      return;
    }

    try {
      const text = await readFileAsText(file);
      const normalized = normalizeFileContent(text, ext);

      if (!normalized.trim()) {
        showMessage('Arquivo vazio ou sem coordenadas reconhecíveis.', 'warning');
        return;
      }

      setCoordText(normalized);
      showMessage(
        `Arquivo "${file.name}" importado com sucesso. Clique em "Adicionar Gleba" para processar.`,
        'success',
        4000
      );
      log('Arquivo importado:', file.name, '—', normalized.split('\n').filter(Boolean).length, 'linhas');

    } catch (err) {
      warn('Erro ao ler arquivo:', err);
      showMessage('Erro ao ler o arquivo: ' + err.message, 'danger');
    } finally {
      // Reset para permitir reimportar o mesmo arquivo
      fileInput.value = '';
    }
  });
}

// ─── Utilitários ──────────────────────────────────────────────────────────

/**
 * Lê um File como texto (UTF-8).
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Falha na leitura do arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Normaliza o conteúdo do arquivo para o formato da textarea.
 * Suporta:
 *   - Espaço ou tab como separador (formato nativo da aplicação)
 *   - CSV com vírgula: "1,1,-8.05,-34.95"
 *   - CSV com ponto-e-vírgula: "1;1;-8,05;-34,95" (Excel brasileiro)
 *
 * @param {string} raw - Conteúdo bruto do arquivo
 * @param {string} ext - Extensão do arquivo ('csv' | 'txt')
 * @returns {string} Texto normalizado no formato da textarea
 */
function normalizeFileContent(raw, ext) {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const normalized = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // ignora comentários e vazios

    let parts;

    if (ext === 'csv') {
      // Tenta detectar separador
      if (trimmed.includes(';')) {
        // CSV ponto-e-vírgula (estilo Excel BR)
        parts = trimmed
          .split(';')
          .map(v => v.trim().replace(',', '.')); // vírgula decimal → ponto
      } else {
        // CSV vírgula
        parts = trimmed.split(',').map(v => v.trim());
      }
    } else {
      // TXT: espaço ou tab
      parts = trimmed.split(/\s+/);
    }

    // Remove aspas (campos CSV com aspas)
    parts = parts.map(v => v.replace(/^["']|["']$/g, '').trim());

    // Ignora cabeçalho (linha onde os valores não são numéricos)
    if (parts.some(v => isNaN(Number(v)))) {
      // Pode ser cabeçalho — tenta detectar e pular
      if (parts.some(v => /gleba|ponto|lat|lon|coord/i.test(v))) {
        continue;
      }
    }

    if (parts.length >= 4) {
      // Pega apenas os 4 primeiros valores esperados
      normalized.push(parts.slice(0, 4).join(' '));
    }
  }

  return normalized.join('\n');
}
